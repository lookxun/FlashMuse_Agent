import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { assertUserCanUseCredits, chargeCredits, isUnauthenticatedError, UNAUTHENTICATED_ERROR_MESSAGE } from "@/lib/credits";
import { createOpenRouterVideoTask, getBytePlusEffectiveReferenceImages, getOpenRouterVideoTask, type VideoReferenceMode } from "@/lib/openrouter-video";
import { createCodedApiError } from "@/lib/error-code";
import { isTransientServerError } from "@/lib/transient-error";
import { getBytePlusProviderKey } from "@/lib/byteplus-provider-key";
import { normalizeReferenceAssetUrl, normalizeReferenceAssetUrls } from "@/lib/reference-asset-url";
import { GENERIC_MEDIA_ERROR_MESSAGE } from "@/lib/error-message";
import { getUploadRule, validateReferenceImageCount, validateReferenceTotalDuration, validateVideoReferenceCombination } from "@/lib/upload-rules";
import { enqueueRemoteAssetSave } from "@/lib/media-save-queue";
import { getMediaSaveStatuses } from "@/lib/media-save-queue";
import { upsertVideoManifestEntry } from "@/lib/video-manifest";
import { getUploadRuleOverrides, isAgentVideoModelEnabled, isConversationVideoModelEnabled } from "@/lib/system-settings";
import { prisma } from "@/lib/prisma";
import { appendUploadRuleFeedbackLog } from "@/lib/upload-rule-feedback-log";
import { appendVideoDiagnosticsLog, summarizeVideoReference } from "@/lib/video-diagnostics-log";
import { appendGenerationDiagnosticsLog, summarizeGeneratedReference } from "@/lib/generation-diagnostics-log";
import { createBytePlusAsset, getBytePlusAsset } from "@/lib/byteplus-assets";
import { recordGenerationEvent } from "@/lib/analytics-events";
import { createVideoJob } from "@/lib/generation-jobs";
import { getBytePlusVideoPricePerMillionUsd, validateVideoDurationWithReferences } from "@/lib/models";
import { Prisma } from "@prisma/client";
import { validateMediaUploadMetadata } from "@/lib/media-upload-validation";
import { validateVideoReferenceImages, videoModelEnforcesReferenceImageSizeRules } from "@/lib/video-reference-image-rules";

type UsageMeta = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  usd?: number;
};

function withChargedUsage(usage: UsageMeta | undefined, credit: Awaited<ReturnType<typeof chargeCredits>> | undefined) {
  if (!credit || credit.skipped) return usage;
  return { ...(usage ?? {}), usd: credit.chargedUsd, cny: credit.chargedCny };
}

function getFiniteNumber(value: unknown) {
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function getUsageMeta(value: unknown): UsageMeta | undefined {
  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  const usage = record.usage && typeof record.usage === "object" ? record.usage as Record<string, unknown> : record;
  const promptTokens = Math.max(0, Math.floor(getFiniteNumber(usage.promptTokens ?? usage.prompt_tokens) ?? 0));
  const completionTokens = Math.max(0, Math.floor(getFiniteNumber(usage.completionTokens ?? usage.completion_tokens) ?? 0));
  const totalTokens = Math.max(0, Math.floor(getFiniteNumber(usage.totalTokens ?? usage.total_tokens) ?? promptTokens + completionTokens));
  const usd = getFiniteNumber(usage.usd ?? usage.cost ?? usage.totalCost ?? usage.total_cost ?? usage.amount);

  if (totalTokens > 0 || usd !== undefined) return { promptTokens, completionTokens, totalTokens, usd };

  for (const key of ["data", "result", "task", "content", "payload"]) {
    const nestedUsage = getUsageMeta(record[key]);
    if (nestedUsage) return nestedUsage;
  }

  return undefined;
}

function withBytePlusVideoUsd(usage: UsageMeta | undefined, model: string | undefined, settings?: { resolution?: string }, hasVideoInput = false) {
  if (!usage || usage.usd !== undefined || !model?.startsWith("byteplus:video.")) return usage;
  const outputTokens = Math.max(0, usage.completionTokens ?? usage.totalTokens ?? 0);
  const pricePerMillion = getBytePlusVideoPricePerMillionUsd(model, settings?.resolution, hasVideoInput);
  return { ...usage, usd: (outputTokens / 1_000_000) * pricePerMillion };
}

function isBytePlusVideoModel(model?: string) {
  return Boolean(model?.startsWith("byteplus:video."));
}

function getUploadRuleVideoReferenceMode(mode?: VideoReferenceMode) {
  return mode === "first_last_frame" || mode === "first_frame" ? mode : undefined;
}

function getBytePlusReferenceRole(index: number, mode?: VideoReferenceMode) {
  if (mode === "first_last_frame") {
    if (index === 0) return "first_frame";
    if (index === 1) return "last_frame";
  }
  if (mode === "first_frame" && index === 0) return "first_frame";
  return "reference_image";
}

function summarizeVideoReferencesForLog(references: string[], mode?: VideoReferenceMode) {
  return references.map((url, index) => summarizeVideoReference(url, index, getBytePlusReferenceRole(index, mode)));
}

function isBytePlusHumanReferenceError(value: unknown) {
  const message = value instanceof Error ? value.message : typeof value === "string" ? value : JSON.stringify(value ?? "");
  return /input(?:image|video|audio)?sensitivecontentdetected|privacyinformation|input (?:image|video|audio).*real person|real person|privacy information|真人|隐私/i.test(message) && !/output|copyright|版权/i.test(message);
}

/**
 * 我们库里记着的「审核通行证」（bytePlusAssetId）在平台侧已经不存在了。
 * 平台原文形如：`The specified asset asset-20260716010752-xmgm6 is not found.`
 * 这类必须把库里的失效凭证清掉、重新送审，否则同一张图会一直用死凭证、永远失败。
 */
function isBytePlusAssetNotFoundError(value: unknown) {
  const message = value instanceof Error ? value.message : typeof value === "string" ? value : JSON.stringify(value ?? "");
  return /specified asset\s+\S+\s+is not found|asset\s+asset-[\w-]+\s+is not found/i.test(message);
}

/** 从平台报错原文里取出所有失效的 assetId（可能一次报多个）。 */
function getBytePlusMissingAssetIds(value: unknown) {
  const message = value instanceof Error ? value.message : typeof value === "string" ? value : JSON.stringify(value ?? "");
  return Array.from(new Set((message.match(/asset-[A-Za-z0-9-]+/g) ?? [])));
}

/** 清掉失效的审核凭证（下次会自动重新送审并重新记住新的凭证）。 */
async function clearStaleBytePlusAssetCards(userId: string | undefined, assetIds: string[]) {
  if (!userId || assetIds.length === 0) return 0;
  const result = await prisma.userAssetState.updateMany({
    where: { userId, bytePlusAssetId: { in: assetIds } },
    data: { bytePlusAssetId: null, bytePlusAssetGroupId: null, bytePlusAssetStatus: null, bytePlusAssetError: null, bytePlusAssetUpdatedAt: new Date() },
  }).catch(() => ({ count: 0 }));
  return result.count;
}

// 输入参考素材（图/视频/音频）被平台真人/隐私/敏感/版权检测拦截时，可通过
// "先把素材上传为 Skip 审核素材、再以 asset:// 引用" 绕过（与图片走同一套自动审核机制）。
// 仅输出侧（生成结果本身）的版权/敏感问题无法靠重传输入素材解决，视为不可恢复。
function isBytePlusRecoverableReferenceError(value: unknown) {
  if (isBytePlusHumanReferenceError(value)) return true;
  // 审核凭证在平台侧失效 = 重新送审就能救回来（清凭证 + 重新建素材）。
  if (isBytePlusAssetNotFoundError(value)) return true;
  const message = value instanceof Error ? value.message : typeof value === "string" ? value : JSON.stringify(value ?? "");
  if (/\boutput\b/i.test(message)) return false;
  return /input(?:image|video|audio)?sensitivecontentdetected|copyright|版权/i.test(message);
}

// 服务端断线重连：视频"创建任务"调用对瞬时可恢复错误（网络/网关5xx/部署重启窗口/
// 平台抓我们素材临时失败/事务超时）自动退避重试，用户无感。真人/版权/参数等永久错误
// 由 isTransientServerError 判为 false → 不重试，交给上层 auto-review / 报错处理。
async function createVideoTaskWithTransientRetry(
  ...args: Parameters<typeof createOpenRouterVideoTask>
): ReturnType<typeof createOpenRouterVideoTask> {
  const maxAttempts = 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await createOpenRouterVideoTask(...args);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isTransientServerError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
  throw lastError;
}

function normalizeMediaUrlForMatch(value: string) {
  return value.split("?")[0].split("#")[0].replace(/^https?:\/\/[^/]+/, "");
}

function getAssetString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

const BYTEPLUS_REVIEW_ATTEMPT_PREFIX = "__byteplus_review_attempts=";
const MAX_BYTEPLUS_REFERENCE_REVIEW_ATTEMPTS = 3;

function parseBytePlusReviewError(value: string) {
  const match = value.match(/^__byteplus_review_attempts=(\d+)__\s*/);
  const attempts = match ? Math.max(0, Math.floor(Number(match[1]) || 0)) : value ? 1 : 0;
  return { attempts, message: value.replace(/^__byteplus_review_attempts=\d+__\s*/, "").trim() };
}

function formatBytePlusReviewError(message: string, attempts: number) {
  return `${BYTEPLUS_REVIEW_ATTEMPT_PREFIX}${Math.max(0, Math.floor(attempts))}__ ${message}`;
}

async function getWorkspaceAssets(userId: string | undefined) {
  if (!userId) return [];
  const assetStates = await prisma.userAssetState.findMany({
    where: { userId, hiddenAt: null, mediaAsset: { archivedAt: null } },
    select: { currentName: true, bytePlusAssetId: true, bytePlusAssetGroupId: true, bytePlusAssetStatus: true, bytePlusAssetError: true, bytePlusAssetUpdatedAt: true, mediaAsset: { select: { url: true, normalizedUrl: true, systemName: true, initialName: true } } },
  }).catch(() => []);
  return assetStates.map((state) => ({
    url: state.mediaAsset.url,
    normalizedUrl: state.mediaAsset.normalizedUrl,
    name: state.currentName || state.mediaAsset.systemName || state.mediaAsset.initialName,
    bytePlusAssetId: state.bytePlusAssetId,
    bytePlusAssetGroupId: state.bytePlusAssetGroupId,
    bytePlusAssetStatus: state.bytePlusAssetStatus,
    bytePlusAssetError: state.bytePlusAssetError,
    bytePlusAssetUpdatedAt: state.bytePlusAssetUpdatedAt?.getTime(),
  }));
}

async function resolveBytePlusReviewedReferences(userId: string | undefined, model: string | undefined, references: string[], assets?: Record<string, unknown>[]) {
  if (!userId || !isBytePlusVideoModel(model) || references.length === 0) return references;

  const workspaceAssets = assets ?? await getWorkspaceAssets(userId);
  if (workspaceAssets.length === 0) return references;

  const assetIdByUrl = new Map<string, string>();
  for (const record of workspaceAssets) {
    const url = getAssetString(record, "url");
    const bytePlusAssetId = getAssetString(record, "bytePlusAssetId");
    const status = getAssetString(record, "bytePlusAssetStatus");
    if (!url || !bytePlusAssetId || status !== "Active") continue;
    assetIdByUrl.set(normalizeMediaUrlForMatch(url), bytePlusAssetId);
  }

  let replacedCount = 0;
  const nextReferences = references.map((url) => {
    if (url.startsWith("asset://")) return url;
    const assetId = assetIdByUrl.get(normalizeMediaUrlForMatch(url));
    if (!assetId) return url;
    replacedCount += 1;
    return `asset://${assetId}`;
  });

  if (replacedCount > 0) {
    logVideoTiming("BytePlus asset references applied", { model, referenceCount: references.length, replacedCount });
  }

  return nextReferences;
}

function toPublicAssetUrl(value: string) {
  // 送审/建任务给平台的必须是**文件静态直链**：先过唯一权威归一化（剥自家主机前缀、把
  // `/api/media-thumbnail?url=` 动态缩略图接口还原成原图），再按当前环境拼公网 base。
  const url = normalizeReferenceAssetUrl(value);
  if (!url || url.startsWith("asset://")) return "";
  if (url.startsWith("/generated/")) {
    const base = (process.env.NEXT_PUBLIC_PRIMARY_BASE_URL || process.env.NEXT_PUBLIC_UPLOAD_BASE_URL || "https://main.venusface.com").replace(/\/$/, "");
    return `${base}${url}`;
  }
  if (/^https?:\/\//i.test(url)) return url;
  return "";
}

async function toReviewablePublicAssetUrl(value: string, userId?: string) {
  const url = value.trim();
  if (/^https?:\/\//i.test(url)) {
    const saved = (await getMediaSaveStatuses([url], userId)).find((job) => job.status === "saved" && job.localUrl);
    if (saved?.localUrl) return toPublicAssetUrl(saved.localUrl);
    throw new Error("review reference unavailable");
  }
  return toPublicAssetUrl(url);
}

async function waitForBytePlusAssetActive(assetId: string) {
  const startedAt = Date.now();
  let lastAsset: Awaited<ReturnType<typeof getBytePlusAsset>> | undefined;
  let lastQueryError: unknown;
  // 只有平台明确返回 Failed 或超过总时限才算失败；
  // 期间任何查询瞬态错误（刚创建时 GetAsset 尚未同步而 "not found"、网络抖动等）
  // 都当作"还没就绪"，继续轮询，直到 Active / Failed / 超时。
  while (Date.now() - startedAt < 180_000) {
    try {
      lastAsset = await getBytePlusAsset(assetId);
    } catch (error) {
      lastQueryError = error;
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      continue;
    }
    if (lastAsset.Status === "Active") return lastAsset;
    if (lastAsset.Status === "Failed") throw new Error(lastAsset.Error?.Message || "参考图审核未通过，无法作为该视频模型的真人参考图使用。");
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  const timeoutDetail = lastAsset?.Error?.Message || (lastQueryError instanceof Error ? lastQueryError.message : lastQueryError ? String(lastQueryError) : "");
  throw new Error(timeoutDetail ? `参考图审核仍在处理中，请稍后重试。（${timeoutDetail}）` : "参考图审核仍在处理中，请稍后重试。");
}

async function patchWorkspaceBytePlusAssets(userId: string | undefined, updates: AutoBytePlusAssetReviewItem[]) {
  if (!userId || updates.length === 0) return;
  for (const update of updates) {
    const normalizedUrl = normalizeMediaUrlForMatch(update.url);
    await prisma.userAssetState.updateMany({
      where: { userId, mediaAsset: { normalizedUrl } },
      data: {
        bytePlusAssetId: update.assetId,
        bytePlusAssetGroupId: update.groupId,
        bytePlusAssetStatus: update.status,
        bytePlusAssetError: update.error,
        bytePlusAssetUpdatedAt: new Date(),
      },
    }).catch(() => undefined);
  }
}

type AutoBytePlusAssetReviewItem = {
  url: string;
  assetId: string;
  groupId?: string;
  status: "Active" | "Processing" | "Failed";
  error?: string;
};

type BytePlusReviewReferenceKind = "image" | "video" | "audio";
type BytePlusReviewReference = { url: string; kind: BytePlusReviewReferenceKind; role: string };

function getBytePlusAssetType(kind: BytePlusReviewReferenceKind) {
  return kind === "video" ? "Video" : kind === "audio" ? "Audio" : "Image";
}

function summarizeReviewReferences(references: BytePlusReviewReference[]) {
  return references.map((reference, index) => summarizeVideoReference(reference.url, index, reference.role));
}

async function autoReviewBytePlusVideoReferences(input: { userId: string | undefined; model: string | undefined; referenceImages: string[]; referenceVideos: string[]; referenceAudios: string[]; requestId?: string; referenceMode?: VideoReferenceMode; settings?: unknown; conversationId?: string; conversationTitle?: string; reuseOnly?: boolean }) {
  const { userId, model, referenceImages, referenceVideos, referenceAudios, requestId, referenceMode, settings, conversationId, conversationTitle, reuseOnly } = input;
  const reviewReferences: BytePlusReviewReference[] = [
    ...referenceImages.map((url, index) => ({ url, kind: "image" as const, role: getBytePlusReferenceRole(index, referenceMode) })),
    ...referenceVideos.map((url) => ({ url, kind: "video" as const, role: "reference_video" })),
    ...referenceAudios.map((url) => ({ url, kind: "audio" as const, role: "reference_audio" })),
  ].filter((reference) => Boolean(reference.url));
  if (!userId || !isBytePlusVideoModel(model) || reviewReferences.length === 0) return undefined;

  void appendVideoDiagnosticsLog({
    event: reuseOnly ? "byteplus-auto-review-reuse-check-start" : "byteplus-auto-review-start",
    requestId,
    conversationId,
    conversationTitle,
    model,
    provider: "byteplus",
    referenceMode,
    referenceCount: reviewReferences.length,
    settings,
    references: summarizeReviewReferences(reviewReferences),
  });

  const workspaceAssets = await getWorkspaceAssets(userId);
  const assetByUrl = new Map<string, Record<string, unknown>>();
  for (const record of workspaceAssets) {
    const url = normalizeMediaUrlForMatch(getAssetString(record, "url"));
    if (url) assetByUrl.set(url, record);
  }
  const updates: AutoBytePlusAssetReviewItem[] = [];
  const references: BytePlusReviewReference[] = [];
  let triggered = false;
  // ⭐ 本次把多少条原始 url 换成了「已过审的 asset:// 通行证」（复用旧证 或 新送审拿到的证）。
  // 这个计数决定了"值不值得再创建一次任务"：只要换到了证，就必须拿去重试，绝不能白白放弃。
  let convertedCount = 0;

  for (const referenceItem of reviewReferences) {
    const reference = referenceItem.url;
    if (!reference || reference.startsWith("asset://")) {
      void appendVideoDiagnosticsLog({ event: "byteplus-auto-review-skip-asset-reference", requestId, model, provider: "byteplus", referenceMode, references: [summarizeVideoReference(reference, references.length, referenceItem.role)] });
      references.push(referenceItem);
      continue;
    }

    const matchedAsset = assetByUrl.get(normalizeMediaUrlForMatch(reference));
    let assetId = matchedAsset ? getAssetString(matchedAsset, "bytePlusAssetId") : "";
    let groupId = matchedAsset ? getAssetString(matchedAsset, "bytePlusAssetGroupId") : "";
    let status = matchedAsset ? getAssetString(matchedAsset, "bytePlusAssetStatus") : "";
    const previousReviewError = matchedAsset ? getAssetString(matchedAsset, "bytePlusAssetError") : "";
    const previousAttempts = parseBytePlusReviewError(previousReviewError).attempts;

    if (assetId && status === "Active") {
      void appendVideoDiagnosticsLog({ event: "byteplus-auto-review-reuse-active-asset", requestId, model, provider: "byteplus", referenceMode, references: [{ ...summarizeVideoReference(reference, references.length, referenceItem.role), status, assetId }] });
      references.push({ ...referenceItem, url: `asset://${assetId}` });
      convertedCount += 1;
      continue;
    }

    if (status === "Failed") {
      assetId = "";
      groupId = "";
      status = "";
    }

    triggered = true;
    // ⭐ reuseOnly = 只用"以前已经过审、库里记着的通行证"，不做任何上传/等待。
    // 一旦发现有素材必须重新送审，就整体放弃（交给后面的完整送审流程去做，那条路才需要给用户弹审核提示）。
    if (reuseOnly) {
      void appendVideoDiagnosticsLog({ event: "byteplus-auto-review-reuse-check-needs-review", requestId, model, provider: "byteplus", referenceMode, references: [summarizeVideoReference(reference, references.length, referenceItem.role)] });
      return undefined;
    }
    if (!assetId) {
      let publicUrl = "";
      try {
        publicUrl = await toReviewablePublicAssetUrl(reference, userId);
        if (!publicUrl) throw new Error("参考素材不是可审核的公网地址。");
        void appendVideoDiagnosticsLog({ event: "byteplus-auto-review-public-url-resolved", requestId, model, provider: "byteplus", referenceMode, references: [summarizeVideoReference(publicUrl, references.length, referenceItem.role)] });
      } catch (error) {
        void appendVideoDiagnosticsLog({ event: "byteplus-auto-review-public-url-failed", requestId, model, provider: "byteplus", referenceMode, references: [{ ...summarizeVideoReference(reference, references.length, referenceItem.role), error }] });
        throw error;
      }
      const created = await createBytePlusAsset({ url: publicUrl, name: matchedAsset ? getAssetString(matchedAsset, "name") || "FlashMuse reference" : "FlashMuse reference", assetType: getBytePlusAssetType(referenceItem.kind), moderationStrategy: "Skip" });
      assetId = created.id;
      groupId = created.groupId;
      status = "Processing";
      void appendVideoDiagnosticsLog({ event: "byteplus-auto-review-asset-created", requestId, model, provider: "byteplus", referenceMode, references: [{ ...summarizeVideoReference(reference, references.length, referenceItem.role), status, assetId }] });
    }

    let activeAsset: Awaited<ReturnType<typeof waitForBytePlusAssetActive>>;
    try {
      activeAsset = await waitForBytePlusAssetActive(assetId);
    } catch (error) {
      const failureMessage = error instanceof Error ? error.message : String(error);
      const failedUpdate: AutoBytePlusAssetReviewItem = { url: reference, assetId, groupId, status: "Failed", error: formatBytePlusReviewError(failureMessage, previousAttempts + 1) };
      await patchWorkspaceBytePlusAssets(userId, [failedUpdate]).catch((patchError) => logVideoTiming("BytePlus failed asset patch failed", { error: patchError instanceof Error ? patchError.message : String(patchError) }));
      void appendVideoDiagnosticsLog({ event: "byteplus-auto-review-asset-failed", requestId, model, provider: "byteplus", referenceMode, references: [{ ...summarizeVideoReference(reference, references.length, referenceItem.role), status, assetId, error }] });
      throw error;
    }
    const update: AutoBytePlusAssetReviewItem = { url: reference, assetId, groupId: groupId || activeAsset.GroupId, status: "Active" };
    updates.push(update);
    references.push({ ...referenceItem, url: `asset://${assetId}` });
    convertedCount += 1;
    void appendVideoDiagnosticsLog({ event: "byteplus-auto-review-asset-active", requestId, model, provider: "byteplus", referenceMode, references: [{ ...summarizeVideoReference(reference, references.length - 1, referenceItem.role), status: "Active", assetId }] });
  }

  // ⭐ 只有"一条通行证都没换到"才算送审没做成事（原来这里写的是 `if (!triggered)`：
  // 当所有参考图早就过审、只走了"复用旧证"分支时 triggered 一直是 false →
  // 已经拼好的 asset:// 引用被整份丢掉、直接放弃重试 → 用户白白看到"服务器繁忙"。这是个真 bug，已修）。
  if (convertedCount === 0) return undefined;
  await patchWorkspaceBytePlusAssets(userId, updates).catch((error) => logVideoTiming("BytePlus asset workspace patch failed", { error: error instanceof Error ? error.message : String(error) }));
  void appendVideoDiagnosticsLog({
    event: "byteplus-auto-review-complete",
    requestId,
    conversationId,
    conversationTitle,
    model,
    provider: "byteplus",
    referenceMode,
    referenceCount: reviewReferences.length,
    assetReferenceCount: references.filter((reference) => reference.url.startsWith("asset://")).length,
    settings,
    references: summarizeReviewReferences(references),
    autoReview: { updateCount: updates.length, convertedCount, reusedOnly: !triggered },
  });
  return {
    referenceImages: references.filter((reference) => reference.kind === "image").map((reference) => reference.url),
    referenceVideos: references.filter((reference) => reference.kind === "video").map((reference) => reference.url),
    referenceAudios: references.filter((reference) => reference.kind === "audio").map((reference) => reference.url),
    updates,
  };
}

function logVideoTiming(label: string, data: Record<string, unknown>) {
  console.log(`[video-generation] ${label}`, data);
}

function getCreateTaskId(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  const preferredKeys = ["taskId", "task_id", "taskID", "id", "generationId", "generation_id"];

  for (const key of preferredKeys) {
    const item = record[key];
    if (typeof item === "string" && item.trim()) return item.trim();
    if (typeof item === "number") return String(item);
  }

  const priorityContainers = ["data", "result", "task", "content", "payload"];
  for (const key of priorityContainers) {
    const taskId = getCreateTaskId(record[key]);
    if (taskId) return taskId;
  }

  return undefined;
}

function normalizeVideoStatus(status: unknown) {
  if (typeof status === "number") {
    if (status === 0) return "queued";
    if (status === 1) return "running";
    if (status === 2) return "succeeded";
    if (status === 3) return "failed";
    if (status === 4) return "cancelled";
  }

  if (typeof status === "string") {
    const value = status.trim().toLowerCase();
    if (value === "pending") return "queued";
    if (value === "in_progress" || value === "processing") return "running";
    if (value === "completed" || value === "complete" || value === "done") return "succeeded";
    return value;
  }

  return undefined;
}

function getVideoErrorMessage(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  const success = record.success;
  const code = record.code;
  const message = record.msg ?? record.message ?? record.error;

  if (success === false || (typeof code === "string" && code !== "0" && code !== "200")) {
    return [
      typeof code === "string" || typeof code === "number" ? `code=${code}` : "",
      typeof message === "string" ? message : "视频平台返回失败",
    ]
      .filter(Boolean)
      .join("，");
  }

  if (typeof message === "string" && message.trim()) return message.trim();
  if (message && typeof message === "object" && typeof (message as { message?: unknown }).message === "string") return (message as { message: string }).message;

  for (const key of ["data", "result", "task", "content", "payload"]) {
    const nestedMessage = getVideoErrorMessage(record[key]);
    if (nestedMessage) return nestedMessage;
  }

  return undefined;
}

function getTaskStatus(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  const status = normalizeVideoStatus(record.status ?? record.state ?? record.taskStatus ?? record.task_status);
  if (status) return status;

  for (const key of ["data", "result", "task", "content", "payload"]) {
    const nestedStatus = getTaskStatus(record[key]);
    if (nestedStatus) return nestedStatus;
  }

  return undefined;
}

function getVideoUrl(value: unknown): string | undefined {
  if (typeof value === "string" && /^https?:\/\//.test(value) && /(\.mp4|\.mov|\.webm)(\?|$)/i.test(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string" && /^https?:\/\//.test(item)) return item;

      const videoUrl = getVideoUrl(item);
      if (videoUrl) return videoUrl;
    }

    return undefined;
  }

  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  const keys = ["video_url", "videoUrl", "url", "video", "outputUrl", "output_url", "message", "unsigned_urls", "urls"];

  for (const key of keys) {
    const item = record[key];
    if (typeof item === "string" && item.trim()) return item.trim();
  }

  for (const item of Object.values(record)) {
    const videoUrl = getVideoUrl(item);
    if (videoUrl) return videoUrl;
  }

  return undefined;
}

export async function POST(request: Request) {
  const routeStartedAt = Date.now();
  let body: {
    prompt?: string;
    model?: string;
    taskId?: string;
    referenceImages?: string[];
    referenceImageNames?: string[];
    referenceVideos?: string[];
    referenceAudios?: string[];
    settings?: { ratio?: string; resolution?: string; duration?: string };
    conversationId?: string;
    conversationTitle?: string;
    conversationCode?: string;
    requestId?: string;
    usage?: UsageMeta;
    metadata?: { creditSource?: string };
    autoBytePlusAssetReview?: boolean;
    referenceMode?: VideoReferenceMode;
    flow?: "conversation" | "workflow";
    workflowId?: string;
    workflowNodeId?: string;
    itemIndex?: number;
    sourcePrompt?: string;
  } | undefined;

  try {
    body = (await request.json()) as {
      prompt?: string;
      model?: string;
      taskId?: string;
      referenceImages?: string[];
      referenceImageNames?: string[];
      referenceVideos?: string[];
      referenceAudios?: string[];
      settings?: { ratio?: string; resolution?: string; duration?: string };
      conversationId?: string;
      conversationTitle?: string;
      conversationCode?: string;
      requestId?: string;
      usage?: UsageMeta;
      metadata?: { creditSource?: string };
      autoBytePlusAssetReview?: boolean;
      referenceMode?: VideoReferenceMode;
      flow?: "conversation" | "workflow";
      workflowId?: string;
      workflowNodeId?: string;
      itemIndex?: number;
      sourcePrompt?: string;
    };

    const taskId = body.taskId?.trim();
    const prompt = body.prompt?.trim();
    const requestId = body.requestId?.trim();

    // Hardening: requestId is the stable per-generation credit-dedup key. Without it, the charge
    // path would silently fall back to taskId, risking a double-charge if create/poll requests for
    // the same generation are inconsistent about sending requestId. All real callers always send it.
    if (!requestId) {
      return NextResponse.json({ status: "failed", error: { message: "缺少 requestId，无法安全计费。" }, errorCode: "MISSING_REQUEST_ID" }, { status: 400 });
    }

    if (taskId) {
      const startedAt = Date.now();
      void appendGenerationDiagnosticsLog({ event: "video-route-poll-start", requestId: body.requestId ?? taskId, conversationId: body.conversationId, conversationTitle: body.conversationTitle, mode: "video", provider: isBytePlusVideoModel(body.model) ? "byteplus" : "openrouter", model: body.model, taskId, settings: body.settings });
      const task = await getOpenRouterVideoTask(taskId);
      const queryDoneAt = Date.now();
      const videoError = getVideoErrorMessage(task);

      if (videoError) {
        if (isBytePlusVideoModel(body.model)) {
          void appendVideoDiagnosticsLog({
            event: "byteplus-polling-error",
            requestId: body.requestId ?? taskId,
            conversationId: body.conversationId,
            conversationTitle: body.conversationTitle,
            model: body.model,
            provider: "byteplus",
            taskId,
            settings: body.settings,
            error: videoError,
            extra: { queryMs: queryDoneAt - startedAt },
          });
        }
        const codedError = await createCodedApiError(new Error(videoError), GENERIC_MEDIA_ERROR_MESSAGE, "video task polling failed");
        void appendGenerationDiagnosticsLog({ event: "video-route-poll-failed", requestId: body.requestId ?? taskId, conversationId: body.conversationId, conversationTitle: body.conversationTitle, mode: "video", provider: isBytePlusVideoModel(body.model) ? "byteplus" : "openrouter", model: body.model, taskId, settings: body.settings, durationMs: Date.now() - startedAt, error: videoError, upstream: task, extra: { errorCode: codedError.errorCode, userError: codedError.error } });
        void recordGenerationEvent({ userId: (await getCurrentUser())?.id, requestId, kind: "video", creditSource: body.metadata?.creditSource, model: body.model, provider: isBytePlusVideoModel(body.model) ? "byteplus" : "openrouter", status: "failed", failureReason: codedError.error, failureCode: codedError.errorCode });
        return NextResponse.json({ ...task, status: "failed", error: { message: codedError.error }, errorCode: codedError.errorCode });
      }

      const status = getTaskStatus(task) ?? normalizeVideoStatus(task.status) ?? "running";
      const videoUrl = getVideoUrl(task);

      if ((status === "succeeded" || status === "success" || status === "completed" || status === "complete") && videoUrl) {
        const user = await getCurrentUser();
        const needsOpenRouterAuth = videoUrl.startsWith("https://openrouter.ai/api/v1/videos/");
        const saveJob = await enqueueRemoteAssetSave({
          remoteUrl: videoUrl,
          type: "video",
          authProvider: needsOpenRouterAuth ? "openrouter" : undefined,
          videoTaskId: taskId,
          requestId: body.requestId ?? taskId,
          model: body.model,
          prompt: body.prompt ?? "",
          userId: user?.id,
        });
        const saveQueuedAt = Date.now();

        logVideoTiming(isBytePlusVideoModel(body.model) ? "BytePlus completed" : "OpenRouter completed", {
          requestId: body.requestId ?? taskId,
          model: body.model,
          taskId,
          status,
          queryMs: queryDoneAt - startedAt,
          saveQueueMs: saveQueuedAt - queryDoneAt,
          totalMs: saveQueuedAt - startedAt,
          mediaSaveJobId: saveJob?.id,
          savedLocal: saveJob?.status === "saved",
          saveStatus: saveJob?.status,
          saveAttempts: saveJob?.attempts,
        });
        if (isBytePlusVideoModel(body.model)) {
          void appendVideoDiagnosticsLog({
            event: "byteplus-polling-succeeded",
            requestId: body.requestId ?? taskId,
            conversationId: body.conversationId,
            conversationTitle: body.conversationTitle,
            model: body.model,
            provider: "byteplus",
            taskId,
            settings: body.settings,
            extra: {
              status,
              queryMs: queryDoneAt - startedAt,
              saveQueueMs: saveQueuedAt - queryDoneAt,
              mediaSaveJobId: saveJob?.id,
              saveStatus: saveJob?.status,
              savedLocal: saveJob?.status === "saved",
            },
          });
        }

        await upsertVideoManifestEntry({ taskId, prompt: body.prompt ?? "", localVideoUrl: saveJob?.localUrl ?? videoUrl, remoteVideoUrl: videoUrl, posterUrl: saveJob?.posterUrl });

        const usage = withBytePlusVideoUsd(getUsageMeta(task) ?? body.usage, body.model, body.settings, Array.isArray(body.referenceVideos) && body.referenceVideos.some((url) => typeof url === "string" && url.trim().length > 0));
        const credit = user ? await chargeCredits(user.id, "video", usage, { conversationId: body.conversationId, conversationTitle: body.conversationTitle, requestId, label: "视频生成", model: body.model, videoCount: 1, metadata: { ...body.metadata, settings: body.settings, ratio: body.settings?.ratio, resolution: body.settings?.resolution, duration: body.settings?.duration, originalPrompt: body.prompt, mediaUrls: [saveJob?.localUrl ?? videoUrl], remoteMediaUrls: [videoUrl], posterUrl: saveJob?.posterUrl, delivered: true, savedLocal: saveJob?.status === "saved", localSaveStatus: saveJob?.status ?? "pending", mediaSaveJobId: saveJob?.id } }) : undefined;
        void appendGenerationDiagnosticsLog({ event: "video-route-poll-completed", requestId: body.requestId ?? taskId, conversationId: body.conversationId, conversationTitle: body.conversationTitle, userId: user?.id, mode: "video", provider: isBytePlusVideoModel(body.model) ? "byteplus" : "openrouter", model: body.model, taskId, settings: body.settings, prompt: body.prompt, references: [summarizeGeneratedReference(videoUrl, 0, "remote_video")], durationMs: Date.now() - startedAt, extra: { status, saveJob, credit } });
        void recordGenerationEvent({ userId: user?.id, requestId, kind: "video", creditSource: body.metadata?.creditSource, model: body.model, provider: isBytePlusVideoModel(body.model) ? "byteplus" : "openrouter", status: "success" });

        return NextResponse.json({
          ...task,
          status: "succeeded",
          usage: withChargedUsage(usage, credit),
          credit,
          content: {
            ...task.content,
            video_url: saveJob?.localUrl ?? videoUrl,
            remote_video_url: videoUrl,
            poster_url: saveJob?.posterUrl,
            local_save_status: saveJob?.status ?? "pending",
            media_save_job_id: saveJob?.id,
          },
        });
      }

      if (status === "succeeded" || status === "success" || status === "completed" || status === "complete") {
        if (isBytePlusVideoModel(body.model)) {
          void appendVideoDiagnosticsLog({
            event: "byteplus-polling-completed-without-url",
            requestId: body.requestId ?? taskId,
            conversationId: body.conversationId,
            conversationTitle: body.conversationTitle,
            model: body.model,
            provider: "byteplus",
            taskId,
            settings: body.settings,
            extra: { status, queryMs: queryDoneAt - startedAt },
          });
        }
        const codedError = await createCodedApiError(new Error("视频平台返回已完成，但没有返回视频地址。"), GENERIC_MEDIA_ERROR_MESSAGE, "video task completed without url");
        void appendGenerationDiagnosticsLog({ event: "video-route-completed-without-url", requestId: body.requestId ?? taskId, conversationId: body.conversationId, conversationTitle: body.conversationTitle, mode: "video", provider: isBytePlusVideoModel(body.model) ? "byteplus" : "openrouter", model: body.model, taskId, settings: body.settings, durationMs: Date.now() - startedAt, error: codedError.error, upstream: task });
        void recordGenerationEvent({ requestId, kind: "video", creditSource: body.metadata?.creditSource, model: body.model, provider: isBytePlusVideoModel(body.model) ? "byteplus" : "openrouter", status: "failed", failureReason: codedError.error, failureCode: codedError.errorCode });
        return NextResponse.json({ ...codedError, raw: task }, { status: 502 });
      }

      if (isBytePlusVideoModel(body.model)) {
        logVideoTiming("BytePlus polling", {
          model: body.model,
          taskId,
          status,
          queryMs: queryDoneAt - startedAt,
          hasVideoUrl: Boolean(videoUrl),
        });
      }

      return NextResponse.json({ ...task, status, usage: getUsageMeta(task), content: { ...task.content, video_url: videoUrl } });
    }

    if (!prompt) {
      return NextResponse.json({ error: "缺少提示词" }, { status: 400 });
    }
    const creditSource = body.metadata?.creditSource;
    if (body.model && !(creditSource === "agent_video_generation" ? (isAgentVideoModelEnabled(body.model) || isConversationVideoModelEnabled(body.model)) : isConversationVideoModelEnabled(body.model))) return NextResponse.json({ error: "连接不到模型，请联系管理员！" }, { status: 400 });
    // 参考素材统一归一化：剥自家主机绝对前缀 / 把 `/api/media-thumbnail?url=` 还原成原图静态直链
    // （否则平台来拉我们的动态缩略图接口会超时，整个任务失败）。唯一权威见 lib/reference-asset-url.ts。
    let referenceImages = normalizeReferenceAssetUrls(body.referenceImages);
    const referenceVideos = normalizeReferenceAssetUrls(body.referenceVideos);
    const referenceAudios = normalizeReferenceAssetUrls(body.referenceAudios);
    const uploadRuleOverrides = getUploadRuleOverrides();
    const uploadRuleVideoReferenceMode = getUploadRuleVideoReferenceMode(body.referenceMode);
    const uploadRule = getUploadRule({ mode: "video", modelId: body.model, transportMode: "local-base64", videoReferenceMode: uploadRuleVideoReferenceMode }, uploadRuleOverrides);
    const referenceComboError = validateVideoReferenceCombination({ modelId: body.model, referenceMode: body.referenceMode, imageCount: referenceImages.length, videoCount: referenceVideos.length, audioCount: referenceAudios.length });
    if (referenceComboError) return NextResponse.json({ error: referenceComboError }, { status: 400 });
    if (referenceVideos.length > uploadRule.video.maxCount) return NextResponse.json({ error: `当前模型最多支持 ${uploadRule.video.maxCount} 个参考视频` }, { status: 400 });
    if (referenceAudios.length > uploadRule.audio.maxCount) return NextResponse.json({ error: `当前模型最多支持 ${uploadRule.audio.maxCount} 个参考音频` }, { status: 400 });
    if (isBytePlusVideoModel(body.model) && body.referenceMode === "first_frame" && referenceImages.length < 1) return NextResponse.json({ error: "首帧生视频需要至少一张参考图" }, { status: 400 });
    if (isBytePlusVideoModel(body.model) && body.referenceMode === "first_last_frame" && referenceImages.length < 2) return NextResponse.json({ error: "首尾帧生视频需要至少两张参考图" }, { status: 400 });
    const referenceLimitError = validateReferenceImageCount({ mode: "video", modelId: body.model, transportMode: "local-base64", videoReferenceMode: uploadRuleVideoReferenceMode }, referenceImages.length, uploadRuleOverrides);
    if (referenceLimitError) return NextResponse.json({ error: referenceLimitError }, { status: 400 });

    const user = await getCurrentUser();
    await assertUserCanUseCredits(user, "video");
    // 参考图槽只接受真正的图片资产：@引用/附加时若把音频/视频（尤其历史 .bin 扩展名的音频）漏进了
    // referenceImages，这里按库里真实 mediaType 剔除，避免当图片发给 BytePlus（content[N].image_url
    // not an image）。对话流/工作流共用本路由，统一在服务端权威按 kind 归位，不靠文件扩展名猜。
    if (user?.id && referenceImages.length > 0) {
      const plainImageUrls = referenceImages.filter((url) => typeof url === "string" && !url.startsWith("asset://") && !url.startsWith("data:"));
      if (plainImageUrls.length > 0) {
        const nonImageAssets = await prisma.mediaAsset.findMany({
          where: { userId: user.id, mediaType: { in: ["video", "audio"] }, normalizedUrl: { in: plainImageUrls.map(normalizeMediaUrlForMatch) } },
          select: { normalizedUrl: true },
        });
        if (nonImageAssets.length > 0) {
          const nonImageSet = new Set(nonImageAssets.map((asset) => asset.normalizedUrl));
          referenceImages = referenceImages.filter((url) => typeof url === "string" && (url.startsWith("asset://") || url.startsWith("data:") || !nonImageSet.has(normalizeMediaUrlForMatch(url))));
        }
      }
    }
    // Reference video/audio URLs must be assets owned by this user. Do not trust client-side
    // metadata or arbitrary URLs; persisted upload metadata is the generation authority.
    const validateOwnedReferences = async (urls: string[], kind: "video" | "audio") => {
      if (!user?.id || urls.length === 0) return undefined;
      const plainUrls = urls.filter((url) => !url.startsWith("asset://"));
      const assetIds = urls.filter((url) => url.startsWith("asset://")).map((url) => url.slice("asset://".length));
      const assets = await prisma.mediaAsset.findMany({
        where: { userId: user.id, mediaType: kind, archivedAt: null, normalizedUrl: { in: plainUrls.map(normalizeMediaUrlForMatch) }, userStates: { some: { userId: user.id, deletedAt: null, hiddenAt: null } } },
        select: { normalizedUrl: true, durationSeconds: true, width: true, height: true },
      });
      if (assets.length !== plainUrls.length) return `参考${kind === "video" ? "视频" : "音频"}必须来自当前账号已上传的资产`;
      if (assetIds.length > 0) {
        const ownedAssetCount = await prisma.userAssetState.count({ where: { userId: user.id, deletedAt: null, hiddenAt: null, bytePlusAssetId: { in: assetIds }, mediaAsset: { mediaType: kind, archivedAt: null } } });
        if (ownedAssetCount !== assetIds.length) return `参考${kind === "video" ? "视频" : "音频"}必须来自当前账号已上传的资产`;
      }
      const totalDurationError = validateReferenceTotalDuration(kind, assets.map((asset) => asset.durationSeconds));
      if (totalDurationError) return totalDurationError;
      for (const asset of assets) {
        const error = validateMediaUploadMetadata(kind, { durationSeconds: asset.durationSeconds ?? undefined, width: asset.width ?? undefined, height: asset.height ?? undefined });
        if (error) return error;
      }
      return undefined;
    };
    const ownedVideoError = await validateOwnedReferences(referenceVideos, "video");
    if (ownedVideoError) return NextResponse.json({ error: ownedVideoError }, { status: 400 });
    const ownedAudioError = await validateOwnedReferences(referenceAudios, "audio");
    if (ownedAudioError) return NextResponse.json({ error: ownedAudioError }, { status: 400 });
    const referenceMode = body.referenceMode;
    // 服务端兜底：参考图尺寸/比例不合规的直接 400 拦掉（对话流/工作流已在发送前拦，
    // 这里保证 Agent、资产库、任何入口都拦得住）。规则唯一来源 video-reference-image-rules，
    // 受约束的模型集合也由它唯一判定（BytePlus Seedance + Kling）。
    // ⚠️ 这道兜底靠 MediaAsset.width/height 查库，历史资产这两列常常是 null（查不到就不拦），
    // 真正拦得住的是前端那道"现场量图"——所以两道都要在，别以为有服务端就够了。
    if (videoModelEnforcesReferenceImageSizeRules(body.model) && referenceImages.length > 0) {
      const localReferenceImages = referenceImages.filter((url) => !url.startsWith("asset://"));
      if (localReferenceImages.length > 0) {
        const dimensionRows = await prisma.mediaAsset.findMany({
          where: { normalizedUrl: { in: localReferenceImages.map((url) => normalizeMediaUrlForMatch(url)) } },
          select: { normalizedUrl: true, width: true, height: true, systemName: true },
        }).catch(() => []);
        const dimensionByUrl = new Map(dimensionRows.map((row) => [row.normalizedUrl, row]));
        const sizeError = validateVideoReferenceImages(localReferenceImages.map((url) => {
          const row = dimensionByUrl.get(normalizeMediaUrlForMatch(url));
          return { name: row?.systemName ?? undefined, url, width: row?.width ?? undefined, height: row?.height ?? undefined };
        }));
        if (sizeError) {
          void appendGenerationDiagnosticsLog({ event: "video-route-reference-image-size-rejected", requestId: body.requestId, conversationId: body.conversationId, userId: user?.id, mode: "video", model: body.model, error: sizeError, extra: { referenceImageCount: referenceImages.length } });
          return NextResponse.json({ error: sizeError }, { status: 400 });
        }
      }
    }
    // ⭐ 服务端兜底：某些模型「带参考图」时可用时长被上游收窄（如 Veo 3.1 只允许 8 秒）。
    // 规则唯一来源 models.ts；这里保证 Agent、资产库、任何入口都拦得住。
    const referenceDurationError = validateVideoDurationWithReferences(body.model, body.settings?.duration, referenceImages.length);
    if (referenceDurationError) {
      void appendGenerationDiagnosticsLog({ event: "video-route-reference-duration-rejected", requestId: body.requestId, conversationId: body.conversationId, userId: user?.id, mode: "video", model: body.model, error: referenceDurationError, settings: body.settings, extra: { referenceImageCount: referenceImages.length } });
      return NextResponse.json({ error: referenceDurationError }, { status: 400 });
    }
    void appendGenerationDiagnosticsLog({
      event: "video-route-create-start",
      requestId: body.requestId,
      conversationId: body.conversationId,
      conversationTitle: body.conversationTitle,
      userId: user?.id,
      mode: "video",
      provider: isBytePlusVideoModel(body.model) ? "byteplus" : "openrouter",
      model: body.model,
      prompt,
      settings: body.settings,
      references: [
        ...referenceImages.map((url, index) => summarizeGeneratedReference(url, index, getBytePlusReferenceRole(index, referenceMode))),
        ...referenceVideos.map((url, index) => summarizeGeneratedReference(url, index, "reference_video")),
        ...referenceAudios.map((url, index) => summarizeGeneratedReference(url, index, "reference_audio")),
      ],
      extra: { referenceMode, creditSource, referenceImageCount: referenceImages.length, referenceVideoCount: referenceVideos.length, referenceAudioCount: referenceAudios.length },
    });
    const effectiveReferenceImages = isBytePlusVideoModel(body.model) ? getBytePlusEffectiveReferenceImages(referenceImages, body.referenceMode) : referenceImages;
    const modelReferenceImages = await resolveBytePlusReviewedReferences(user?.id, body.model, effectiveReferenceImages);
    const modelReferenceVideos = await resolveBytePlusReviewedReferences(user?.id, body.model, referenceVideos);
    const modelReferenceAudios = await resolveBytePlusReviewedReferences(user?.id, body.model, referenceAudios);
    if (isBytePlusVideoModel(body.model)) {
      void appendVideoDiagnosticsLog({
        event: "byteplus-create-request",
        requestId: body.requestId,
        conversationId: body.conversationId,
        conversationTitle: body.conversationTitle,
        model: body.model,
        provider: "byteplus",
        referenceMode: body.referenceMode,
        referenceCount: effectiveReferenceImages.length + referenceVideos.length + referenceAudios.length,
        assetReferenceCount: [...modelReferenceImages, ...modelReferenceVideos, ...modelReferenceAudios].filter((url) => url.startsWith("asset://")).length,
        settings: body.settings,
        promptLength: prompt.length,
        references: [
          ...summarizeVideoReferencesForLog(modelReferenceImages, body.referenceMode),
          ...modelReferenceVideos.map((url, index) => summarizeVideoReference(url, index, "reference_video")),
          ...modelReferenceAudios.map((url, index) => summarizeVideoReference(url, index, "reference_audio")),
        ],
        extra: {
          creditSource,
          autoBytePlusAssetReview: Boolean(body.autoBytePlusAssetReview),
          originalReferenceCount: referenceImages.length + referenceVideos.length + referenceAudios.length,
          ignoredReferenceCount: Math.max(0, referenceImages.length - effectiveReferenceImages.length),
        },
      });
    }

    const createStartedAt = Date.now();
    let autoBytePlusAssetReview: Awaited<ReturnType<typeof autoReviewBytePlusVideoReferences>> | undefined;
    let task: Awaited<ReturnType<typeof createOpenRouterVideoTask>>;
    try {
      task = await createVideoTaskWithTransientRetry(prompt, modelReferenceImages, body.settings, body.model, { bytePlusProviderKey: getBytePlusProviderKey(body.model, creditSource), referenceMode: body.referenceMode, referenceVideos: modelReferenceVideos, referenceAudios: modelReferenceAudios, requestId: body.requestId });
    } catch (error) {
      // 我们记的审核通行证在平台侧已失效 → 先把死凭证从库里清掉，后面的送审会重新拿一张新的。
      if (isBytePlusAssetNotFoundError(error)) {
        const staleAssetIds = getBytePlusMissingAssetIds(error);
        const clearedCount = await clearStaleBytePlusAssetCards(user?.id, staleAssetIds);
        void appendVideoDiagnosticsLog({ event: "byteplus-stale-asset-card-cleared", requestId: body.requestId, model: body.model, provider: "byteplus", referenceMode: body.referenceMode, extra: { staleAssetIds, clearedCount } });
      }
      if (!isBytePlusRecoverableReferenceError(error) || (effectiveReferenceImages.length === 0 && referenceVideos.length === 0 && referenceAudios.length === 0)) throw error;
      void appendVideoDiagnosticsLog({
        event: "byteplus-create-human-reference-error",
        requestId: body.requestId,
        conversationId: body.conversationId,
        conversationTitle: body.conversationTitle,
        model: body.model,
        provider: "byteplus",
        referenceMode: body.referenceMode,
        referenceCount: effectiveReferenceImages.length + referenceVideos.length + referenceAudios.length,
        settings: body.settings,
        references: [
          ...summarizeVideoReferencesForLog(modelReferenceImages, body.referenceMode),
          ...modelReferenceVideos.map((url, index) => summarizeVideoReference(url, index, "reference_video")),
          ...modelReferenceAudios.map((url, index) => summarizeVideoReference(url, index, "reference_audio")),
        ],
        error,
        extra: { autoReviewRequested: Boolean(body.autoBytePlusAssetReview) },
      });
      // ⭐ 第一步：如果这些参考素材**以前就已经过审**（库里有 Active 通行证），直接拿旧证当场重试，
      // 不上传、不等待、也不给用户弹"检测到真人图片，需要审核"的提示——用户完全无感。
      // 只有确实存在"必须重新送审"的素材，才走下面的完整送审流程（那条路才需要弹提示）。
      const reusedReview = await autoReviewBytePlusVideoReferences({ userId: user?.id, model: body.model, referenceImages: effectiveReferenceImages, referenceVideos, referenceAudios, requestId: body.requestId, referenceMode: body.referenceMode, settings: body.settings, conversationId: body.conversationId, conversationTitle: body.conversationTitle, reuseOnly: true });
      if (reusedReview) {
        logVideoTiming("BytePlus reusing approved asset cards", { model: body.model, requestId: body.requestId, referenceCount: effectiveReferenceImages.length + referenceVideos.length + referenceAudios.length });
        autoBytePlusAssetReview = reusedReview;
        task = await createVideoTaskWithTransientRetry(prompt, reusedReview.referenceImages, body.settings, body.model, { bytePlusProviderKey: getBytePlusProviderKey(body.model, creditSource), referenceMode: body.referenceMode, referenceVideos: reusedReview.referenceVideos, referenceAudios: reusedReview.referenceAudios, requestId: body.requestId });
      } else {
        if (!body.autoBytePlusAssetReview) return NextResponse.json({ status: "reviewing", autoBytePlusAssetReview: { triggered: true } });
        logVideoTiming("BytePlus human reference auto review started", { model: body.model, requestId: body.requestId, referenceCount: effectiveReferenceImages.length + referenceVideos.length + referenceAudios.length });
        autoBytePlusAssetReview = await autoReviewBytePlusVideoReferences({ userId: user?.id, model: body.model, referenceImages: effectiveReferenceImages, referenceVideos, referenceAudios, requestId: body.requestId, referenceMode: body.referenceMode, settings: body.settings, conversationId: body.conversationId, conversationTitle: body.conversationTitle });
        if (!autoBytePlusAssetReview) throw error;
        task = await createVideoTaskWithTransientRetry(prompt, autoBytePlusAssetReview.referenceImages, body.settings, body.model, { bytePlusProviderKey: getBytePlusProviderKey(body.model, creditSource), referenceMode: body.referenceMode, referenceVideos: autoBytePlusAssetReview.referenceVideos, referenceAudios: autoBytePlusAssetReview.referenceAudios, requestId: body.requestId });
        logVideoTiming("BytePlus human reference auto review completed", { model: body.model, requestId: body.requestId, reviewedCount: autoBytePlusAssetReview.updates.length });
      }
    }
    const createDoneAt = Date.now();
    const videoError = getVideoErrorMessage(task);

    if (videoError) {
      if (isBytePlusVideoModel(body.model)) {
        void appendVideoDiagnosticsLog({
          event: "byteplus-create-returned-error",
          requestId: body.requestId,
          conversationId: body.conversationId,
          conversationTitle: body.conversationTitle,
          model: body.model,
          provider: "byteplus",
          referenceMode: body.referenceMode,
          referenceCount: effectiveReferenceImages.length + referenceVideos.length + referenceAudios.length,
          settings: body.settings,
          references: [
            ...summarizeVideoReferencesForLog(modelReferenceImages, body.referenceMode),
            ...modelReferenceVideos.map((url, index) => summarizeVideoReference(url, index, "reference_video")),
            ...modelReferenceAudios.map((url, index) => summarizeVideoReference(url, index, "reference_audio")),
          ],
          error: videoError,
        });
      }
      if (isBytePlusAssetNotFoundError(videoError)) {
        const staleAssetIds = getBytePlusMissingAssetIds(videoError);
        const clearedCount = await clearStaleBytePlusAssetCards(user?.id, staleAssetIds);
        void appendVideoDiagnosticsLog({ event: "byteplus-stale-asset-card-cleared", requestId: body.requestId, model: body.model, provider: "byteplus", referenceMode: body.referenceMode, extra: { staleAssetIds, clearedCount, phase: "create-returned-error" } });
      }
      if (isBytePlusRecoverableReferenceError(videoError) && (effectiveReferenceImages.length > 0 || referenceVideos.length > 0 || referenceAudios.length > 0)) {
        // 同上：先试"复用已过审通行证"当场重试（用户无感、不弹审核提示）。
        const reusedReview = await autoReviewBytePlusVideoReferences({ userId: user?.id, model: body.model, referenceImages: effectiveReferenceImages, referenceVideos, referenceAudios, requestId: body.requestId, referenceMode: body.referenceMode, settings: body.settings, conversationId: body.conversationId, conversationTitle: body.conversationTitle, reuseOnly: true });
        if (reusedReview) {
          logVideoTiming("BytePlus reusing approved asset cards", { model: body.model, requestId: body.requestId, referenceCount: effectiveReferenceImages.length + referenceVideos.length + referenceAudios.length });
          autoBytePlusAssetReview = reusedReview;
          task = await createVideoTaskWithTransientRetry(prompt, reusedReview.referenceImages, body.settings, body.model, { bytePlusProviderKey: getBytePlusProviderKey(body.model, creditSource), referenceMode: body.referenceMode, referenceVideos: reusedReview.referenceVideos, referenceAudios: reusedReview.referenceAudios, requestId: body.requestId });
        } else {
          if (!body.autoBytePlusAssetReview) return NextResponse.json({ status: "reviewing", autoBytePlusAssetReview: { triggered: true } });
          logVideoTiming("BytePlus human reference auto review started", { model: body.model, requestId: body.requestId, referenceCount: effectiveReferenceImages.length + referenceVideos.length + referenceAudios.length });
          autoBytePlusAssetReview = await autoReviewBytePlusVideoReferences({ userId: user?.id, model: body.model, referenceImages: effectiveReferenceImages, referenceVideos, referenceAudios, requestId: body.requestId, referenceMode: body.referenceMode, settings: body.settings, conversationId: body.conversationId, conversationTitle: body.conversationTitle });
          if (autoBytePlusAssetReview) {
            task = await createVideoTaskWithTransientRetry(prompt, autoBytePlusAssetReview.referenceImages, body.settings, body.model, { bytePlusProviderKey: getBytePlusProviderKey(body.model, creditSource), referenceMode: body.referenceMode, referenceVideos: autoBytePlusAssetReview.referenceVideos, referenceAudios: autoBytePlusAssetReview.referenceAudios, requestId: body.requestId });
            logVideoTiming("BytePlus human reference auto review completed", { model: body.model, requestId: body.requestId, reviewedCount: autoBytePlusAssetReview.updates.length });
          }
        }
      }

      const retryVideoError = getVideoErrorMessage(task);
      if (retryVideoError && isBytePlusVideoModel(body.model)) {
        void appendVideoDiagnosticsLog({
          event: "byteplus-create-after-auto-review-error",
          requestId: body.requestId,
          conversationId: body.conversationId,
          conversationTitle: body.conversationTitle,
          model: body.model,
          provider: "byteplus",
          referenceMode: body.referenceMode,
          referenceCount: effectiveReferenceImages.length + referenceVideos.length + referenceAudios.length,
          settings: body.settings,
          references: [
            ...summarizeVideoReferencesForLog(autoBytePlusAssetReview?.referenceImages ?? modelReferenceImages, body.referenceMode),
            ...(autoBytePlusAssetReview?.referenceVideos ?? modelReferenceVideos).map((url, index) => summarizeVideoReference(url, index, "reference_video")),
            ...(autoBytePlusAssetReview?.referenceAudios ?? modelReferenceAudios).map((url, index) => summarizeVideoReference(url, index, "reference_audio")),
          ],
          autoReview: autoBytePlusAssetReview ? { updateCount: autoBytePlusAssetReview.updates.length } : undefined,
          error: retryVideoError,
        });
      }
      if (!retryVideoError) {
        const retryId = task.polling_url ?? task.pollingUrl ?? getCreateTaskId(task);
        if (!retryId) {
          const codedError = await createCodedApiError(new Error("Missing video task id"), GENERIC_MEDIA_ERROR_MESSAGE, "video task id missing after auto review");
          void appendGenerationDiagnosticsLog({ event: "video-route-create-missing-task-id-after-review", requestId: body.requestId, conversationId: body.conversationId, conversationTitle: body.conversationTitle, userId: user?.id, mode: "video", provider: isBytePlusVideoModel(body.model) ? "byteplus" : "openrouter", model: body.model, prompt, settings: body.settings, durationMs: Date.now() - routeStartedAt, error: codedError.error, upstream: task });
          return NextResponse.json({ ...codedError, raw: task }, { status: 502 });
        }
        await upsertVideoManifestEntry({ taskId: retryId, prompt, model: body.model, settings: body.settings });
        const job = await createVideoJob({
          userId: user!.id,
          requestId,
          providerTaskId: retryId,
          prompt,
          model: body.model,
          settings: body.settings,
          referenceImages,
          referenceVideos,
          referenceAudios,
          referenceMode: body.referenceMode,
          conversationId: body.conversationId,
          conversationTitle: body.conversationTitle,
          conversationCode: body.conversationCode,
          workflowId: body.workflowId,
          workflowNodeId: body.workflowNodeId,
          itemIndex: body.itemIndex,
          flow: body.flow ?? (body.metadata?.creditSource === "workflow_video_generation" ? "workflow" : "conversation"),
          creditSource,
          usage: getUsageMeta(task) as Record<string, unknown> | undefined,
          metadata: body.metadata as Prisma.InputJsonValue | undefined,
          extra: { cleanPrompt: body.sourcePrompt ?? prompt, autoReviewTriggered: Boolean(autoBytePlusAssetReview) },
        });
        void appendGenerationDiagnosticsLog({ event: "video-route-create-success-after-review", requestId: body.requestId, conversationId: body.conversationId, conversationTitle: body.conversationTitle, userId: user?.id, mode: "video", provider: isBytePlusVideoModel(body.model) ? "byteplus" : "openrouter", model: body.model, taskId: retryId, prompt, settings: body.settings, durationMs: Date.now() - routeStartedAt, upstream: task, extra: { autoReviewTriggered: Boolean(autoBytePlusAssetReview), usage: getUsageMeta(task) } });
        return NextResponse.json({ ...task, id: retryId, job_id: getCreateTaskId(task), usage: getUsageMeta(task), reservedNames: job.reservedNames ?? undefined, autoBytePlusAssetReview: autoBytePlusAssetReview ? { triggered: true, assets: autoBytePlusAssetReview.updates } : undefined });
      }

      if (referenceImages.length > 0) {
        void appendUploadRuleFeedbackLog({
          source: "video",
          mode: "video",
          model: body.model,
          requestId: body.requestId,
          conversationId: body.conversationId,
          conversationTitle: body.conversationTitle,
          error: retryVideoError,
          referenceImageCount: referenceImages.length,
          imageCount: referenceImages.length,
          settings: body.settings,
        });
      }
      const codedError = await createCodedApiError(new Error(retryVideoError), GENERIC_MEDIA_ERROR_MESSAGE, "video task create failed");
      void appendGenerationDiagnosticsLog({ event: "video-route-create-returned-error", requestId: body.requestId, conversationId: body.conversationId, conversationTitle: body.conversationTitle, userId: user?.id, mode: "video", provider: isBytePlusVideoModel(body.model) ? "byteplus" : "openrouter", model: body.model, prompt, settings: body.settings, durationMs: Date.now() - routeStartedAt, error: retryVideoError, upstream: task, extra: { errorCode: codedError.errorCode, userError: codedError.error } });
      void recordGenerationEvent({ userId: user?.id, requestId, kind: "video", creditSource, model: body.model, provider: isBytePlusVideoModel(body.model) ? "byteplus" : "openrouter", status: "failed", failureReason: codedError.error, failureCode: codedError.errorCode, referenceImageCount: referenceImages.length, referenceVideoCount: referenceVideos.length, referenceAudioCount: referenceAudios.length });
      return NextResponse.json({ ...codedError, raw: task }, { status: 502 });
    }

    const id = task.polling_url ?? task.pollingUrl ?? getCreateTaskId(task);

    if (!id) {
      if (referenceImages.length > 0) {
        void appendUploadRuleFeedbackLog({
          source: "video",
          mode: "video",
          model: body.model,
          requestId: body.requestId,
          conversationId: body.conversationId,
          conversationTitle: body.conversationTitle,
          error: "Missing video task id",
          referenceImageCount: referenceImages.length,
          imageCount: referenceImages.length,
          settings: body.settings,
        });
      }
      const codedError = await createCodedApiError(new Error("Missing video task id"), GENERIC_MEDIA_ERROR_MESSAGE, "video task id missing");
      void appendGenerationDiagnosticsLog({ event: "video-route-create-missing-task-id", requestId: body.requestId, conversationId: body.conversationId, conversationTitle: body.conversationTitle, userId: user?.id, mode: "video", provider: isBytePlusVideoModel(body.model) ? "byteplus" : "openrouter", model: body.model, prompt, settings: body.settings, durationMs: Date.now() - routeStartedAt, error: codedError.error, upstream: task });
      void recordGenerationEvent({ userId: user?.id, requestId, kind: "video", creditSource, model: body.model, provider: isBytePlusVideoModel(body.model) ? "byteplus" : "openrouter", status: "failed", failureReason: codedError.error, failureCode: codedError.errorCode, referenceImageCount: referenceImages.length, referenceVideoCount: referenceVideos.length, referenceAudioCount: referenceAudios.length });
      return NextResponse.json({ ...codedError, raw: task }, { status: 502 });
    }

    await upsertVideoManifestEntry({ taskId: id, prompt, model: body.model, settings: body.settings });
    const job = await createVideoJob({
      userId: user!.id,
      requestId,
      providerTaskId: id,
      prompt,
      model: body.model,
      settings: body.settings,
      referenceImages,
      referenceVideos,
      referenceAudios,
      referenceMode: body.referenceMode,
      conversationId: body.conversationId,
      conversationTitle: body.conversationTitle,
      conversationCode: body.conversationCode,
      workflowId: body.workflowId,
      workflowNodeId: body.workflowNodeId,
      itemIndex: body.itemIndex,
      flow: body.flow ?? (body.metadata?.creditSource === "workflow_video_generation" ? "workflow" : "conversation"),
      creditSource,
      usage: getUsageMeta(task) as Record<string, unknown> | undefined,
      metadata: body.metadata as Prisma.InputJsonValue | undefined,
      extra: { cleanPrompt: body.sourcePrompt ?? prompt, autoReviewTriggered: Boolean(autoBytePlusAssetReview) },
    });

    if (isBytePlusVideoModel(body.model)) {
      logVideoTiming("BytePlus created", {
        model: body.model,
        taskId: id,
        createMs: createDoneAt - createStartedAt,
        ratio: body.settings?.ratio,
        resolution: body.settings?.resolution,
        duration: body.settings?.duration,
        referenceMode: body.referenceMode,
        referenceCount: modelReferenceImages.length + modelReferenceVideos.length + modelReferenceAudios.length,
        assetReferenceCount: [...modelReferenceImages, ...modelReferenceVideos, ...modelReferenceAudios].filter((url) => url.startsWith("asset://")).length,
      });
      void appendVideoDiagnosticsLog({
        event: "byteplus-create-success",
        requestId: body.requestId,
        conversationId: body.conversationId,
        conversationTitle: body.conversationTitle,
        model: body.model,
        provider: "byteplus",
        taskId: id,
        referenceMode: body.referenceMode,
        referenceCount: modelReferenceImages.length + modelReferenceVideos.length + modelReferenceAudios.length,
        assetReferenceCount: [...modelReferenceImages, ...modelReferenceVideos, ...modelReferenceAudios].filter((url) => url.startsWith("asset://")).length,
        settings: body.settings,
        promptLength: prompt.length,
        references: [
          ...summarizeVideoReferencesForLog(modelReferenceImages, body.referenceMode),
          ...modelReferenceVideos.map((url, index) => summarizeVideoReference(url, index, "reference_video")),
          ...modelReferenceAudios.map((url, index) => summarizeVideoReference(url, index, "reference_audio")),
        ],
        autoReview: autoBytePlusAssetReview ? { updateCount: autoBytePlusAssetReview.updates.length } : undefined,
        extra: { createMs: createDoneAt - createStartedAt },
      });
    }

    void appendGenerationDiagnosticsLog({ event: "video-route-create-success", requestId: body.requestId, conversationId: body.conversationId, conversationTitle: body.conversationTitle, userId: user?.id, mode: "video", provider: isBytePlusVideoModel(body.model) ? "byteplus" : "openrouter", model: body.model, taskId: id, prompt, settings: body.settings, durationMs: Date.now() - routeStartedAt, upstream: task, extra: { autoReviewTriggered: Boolean(autoBytePlusAssetReview), usage: getUsageMeta(task) } });
    return NextResponse.json({ ...task, id, job_id: getCreateTaskId(task), usage: getUsageMeta(task), reservedNames: job.reservedNames ?? undefined, autoBytePlusAssetReview: autoBytePlusAssetReview ? { triggered: true, assets: autoBytePlusAssetReview.updates } : undefined });
  } catch (error) {
    // ⭐ 登录状态已失效：回 401，前端会直接跳首页；且**不记 GenerationEvent**（这不是生成失败）。详见 credits.ts 注释。
    if (isUnauthenticatedError(error)) return NextResponse.json({ error: UNAUTHENTICATED_ERROR_MESSAGE }, { status: 401 });
    const referenceImageCount = Array.isArray(body?.referenceImages) ? body.referenceImages.length : 0;
    if (referenceImageCount > 0) {
      void appendUploadRuleFeedbackLog({
        source: "video",
        mode: "video",
        model: body?.model,
        requestId: body?.requestId ?? body?.taskId,
        conversationId: body?.conversationId,
        conversationTitle: body?.conversationTitle,
        error,
        referenceImageCount,
        imageCount: referenceImageCount,
        settings: body?.settings,
      });
    }
    if (isBytePlusVideoModel(body?.model) || body?.referenceMode === "first_frame" || body?.referenceMode === "last_frame" || body?.referenceMode === "first_last_frame") {
      void appendVideoDiagnosticsLog({
        event: "video-request-error",
        requestId: body?.requestId ?? body?.taskId,
        conversationId: body?.conversationId,
        conversationTitle: body?.conversationTitle,
        model: body?.model,
        provider: isBytePlusVideoModel(body?.model) ? "byteplus" : "openrouter",
        referenceMode: body?.referenceMode,
        referenceCount: referenceImageCount,
        settings: body?.settings,
        references: summarizeVideoReferencesForLog(Array.isArray(body?.referenceImages) ? body.referenceImages : [], body?.referenceMode),
        error,
      });
    }
    const codedError = await createCodedApiError(error, GENERIC_MEDIA_ERROR_MESSAGE, "video request failed");
    void appendGenerationDiagnosticsLog({ event: "video-route-failed", requestId: body?.requestId ?? body?.taskId, conversationId: body?.conversationId, conversationTitle: body?.conversationTitle, mode: "video", provider: isBytePlusVideoModel(body?.model) ? "byteplus" : "openrouter", model: body?.model, taskId: body?.taskId, prompt: body?.prompt, settings: body?.settings, references: Array.isArray(body?.referenceImages) ? body.referenceImages.map((url, index) => summarizeGeneratedReference(url, index, getBytePlusReferenceRole(index, body?.referenceMode))) : undefined, durationMs: Date.now() - routeStartedAt, error, extra: { errorCode: codedError.errorCode, userError: codedError.error, referenceImageCount } });
    // 仅在创建阶段(无 taskId)记录失败；轮询阶段(有 taskId)多为可恢复的瞬时网络错误，不计入失败率。
    if (body && !body.taskId && body.requestId) {
      void recordGenerationEvent({ requestId: body.requestId, kind: "video", creditSource: body.metadata?.creditSource, model: body.model, provider: isBytePlusVideoModel(body.model) ? "byteplus" : "openrouter", status: "failed", failureReason: codedError.error, failureCode: codedError.errorCode, referenceImageCount, referenceVideoCount: Array.isArray(body.referenceVideos) ? body.referenceVideos.length : 0, referenceAudioCount: Array.isArray(body.referenceAudios) ? body.referenceAudios.length : 0 });
    }
    return NextResponse.json(codedError, { status: 500 });
  }
}
