import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { chargeCredits } from "@/lib/credits";
import { generateOpenRouterImage } from "@/lib/openrouter";
import { createCodedApiError } from "@/lib/error-code";
import { isTransientServerError } from "@/lib/transient-error";
import { getBytePlusProviderKey } from "@/lib/byteplus-provider-key";
import { GENERIC_MEDIA_ERROR_MESSAGE } from "@/lib/error-message";
import { getExpectedImageDimensions } from "@/lib/models";
import { getVideoUsageMeta, withChargedVideoUsage, withVideoUsdFallback, type VideoUsageMeta } from "@/lib/video-usage-cost";
import { recordGenerationEvent } from "@/lib/analytics-events";
import { appendGenerationDiagnosticsLog, summarizeGeneratedReference } from "@/lib/generation-diagnostics-log";
import { resolvePersistableMediaAssetUrl } from "@/lib/media-assets";
import { buildMediaAssetRecord, buildUserAssetStateRecord, classifyAsset, getCommonRatioLabel, getVideoResolutionFromDimensions, type AssetGenerationKind } from "@/lib/media-asset-record";
import { getOpenRouterVideoTask } from "@/lib/openrouter-video";
import { enqueueRemoteAssetSave, waitForMediaSaveJob } from "@/lib/media-save-queue";
import { upsertVideoManifestEntry } from "@/lib/video-manifest";
import { saveDataUrlAsset } from "@/lib/local-assets";
import { normalizeReferenceAssetUrl, normalizeReferenceAssetUrls } from "@/lib/reference-asset-url";
import { resolveUnlockLimitsForUser } from "@/lib/account-features";
import { applyWorkflowJobResultToCanvas } from "@/lib/workspace-workflows";

// 编辑类功能（去背景/高清/快捷编辑/橡皮/编辑元素）失败时，尽量透出真实原因（中文优先）。
// error-message 已把常见上游报错（如"当前模型不支持所请求的参数"）映射成中文；这里作为兜底文案，
// 避免统一被吞成"服务器繁忙"。
function editErrorFallback(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const reason = raw
    .replace(/^\(B_\d+\)\s*/, "")
    .replace(/^(?:图片|视频)?(?:平台|模型|供应商)?(?:图片|视频)?(?:生成|任务|请求)?失败[：:]\s*/i, "")
    .replace(/\bRequest\s*id\s*:\s*[0-9a-f]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return reason ? `编辑失败：${reason.slice(0, 180)}` : "编辑失败，请稍后再试。";
}

/**
 * 后端持久生成任务（GenerationJob）。原则：模型申请一旦提交，后端就负责跑到底
 * （生成/存盘/扣费/落状态），前端断开/刷新/退出/服务重启都不影响。前端只做提交与展示。
 * 使用原始 SQL 读写，避免本地 Windows 常锁定 Prisma 查询引擎导致 `prisma generate` 失败
 * （与 GenerationEvent / GptImagePromptOptimizationCase 相同思路）。
 */

export type GenerationJobStatus = "queued" | "running" | "succeeded" | "failed";
export type GenerationJobKind = "image" | "video";

export type GenerationJobRow = {
  id: string;
  userId: string;
  requestId: string;
  kind: GenerationJobKind;
  status: GenerationJobStatus;
  flow: string | null;
  creditSource: string | null;
  model: string | null;
  provider: string | null;
  prompt: string | null;
  settingsJson: { ratio?: string; resolution?: string; quality?: string; duration?: string } | null;
  referenceImages: string[] | null;
  referenceVideos: string[] | null;
  referenceAudios: string[] | null;
  referenceNames: Record<string, string> | null;
  referenceMode: string | null;
  conversationId: string | null;
  conversationTitle: string | null;
  messageId: string | null;
  workflowId: string | null;
  workflowNodeId: string | null;
  itemIndex: number | null;
  count: number;
  providerTaskId: string | null;
  reservedNames: string[] | null;
  resultUrls: string[] | null;
  resultDimensions: Record<string, { width: number; height: number; durationSeconds?: number }> | null;
  posterUrl: string | null;
  usageJson: Record<string, unknown> | null;
  creditJson: Record<string, unknown> | null;
  metadataJson: Record<string, unknown> | null;
  extraJson: Record<string, unknown> | null;
  error: string | null;
  errorCode: string | null;
  attempts: number;
  leaseAt: Date | null;
  nextRunAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function jsonParam(value: unknown): string | null {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

function assetNameSuffix(source: string | null | undefined) {
  return source === "scene_image_generation" ? "scene" : source === "prop_image_generation" ? "prop" : source === "shot_image_generation" ? "storyboard" : "role";
}

async function reserveJobNames(tx: Prisma.TransactionClient, input: { userId: string; kind: GenerationJobKind; count: number; flow?: string; workflowId?: string; conversationId?: string; conversationCode?: string; creditSource?: string }) {
  const assetFlow = isAssetImageCreditSource(input.creditSource);
  const scope = assetFlow ? `asset:${input.userId}` : input.flow === "workflow" && input.workflowId ? `workflow:${input.userId}:${input.workflowId}:${input.kind}` : `conversation:${input.userId}:${input.conversationId ?? "d0"}:${input.kind}`;
  // The caller keeps this lock until the job row containing the reservation is inserted.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${scope}))`;
  const [jobs, workflow] = await Promise.all([
    tx.$queryRaw<Array<{ reservedNames: string[] | null }>>`SELECT "reservedNames" FROM "GenerationJob" WHERE "userId" = ${input.userId} AND "status" IN ('queued', 'running')`,
    input.flow === "workflow" && input.workflowId ? tx.workspaceWorkflow.findUnique({ where: { userId_workflowId: { userId: input.userId, workflowId: input.workflowId } }, select: { workflowCode: true, title: true, nextImageNumber: true, nextVideoNumber: true } }) : null,
  ]);
  const usedByJobs = new Set<string>();
  for (const job of jobs) for (const name of job.reservedNames ?? []) usedByJobs.add(name);
  let code: string;
  let numberHint = 1;
  if (input.flow === "workflow") {
    code = deriveWorkflowCode(workflow?.workflowCode ?? null, workflow?.title ?? null);
    numberHint = input.kind === "video" ? (workflow?.nextVideoNumber ?? 1) : (workflow?.nextImageNumber ?? 1);
  } else {
    // 对话流：用会话稳定编号 conversationCode（image_序号_d编号）。优先取调用方传入，
    // 缺失时回退读 WorkspaceSession.summaryJson.conversationCode，都没有才 d0。
    code = input.conversationCode?.trim() || "";
    // 会话行总是读一次：既要兜底 conversationCode，也要取计数器起点提示。
    const session = !assetFlow && input.conversationId
      ? await tx.workspaceSession.findUnique({
          where: { userId_sessionId: { userId: input.userId, sessionId: input.conversationId } },
          select: { summaryJson: true },
        })
      : null;
    const summaryJson = session && typeof session.summaryJson === "object" && session.summaryJson
      ? (session.summaryJson as Record<string, unknown>)
      : undefined;
    if (!code) {
      const summaryCode = summaryJson?.conversationCode;
      if (typeof summaryCode === "string" && summaryCode.trim()) code = summaryCode.trim();
    }
    if (!code) code = "d0";
    // 计数器只当"起点提示"用（历史教训：不能只信它，重试/失败会让它漂移）——
    // 真正的防撞靠下面的定点存在性检查。
    const summaryCounter = input.kind === "video" ? summaryJson?.nextVideoNumber : summaryJson?.nextImageNumber;
    if (typeof summaryCounter === "number" && Number.isFinite(summaryCounter)) numberHint = Math.max(1, Math.floor(summaryCounter));
  }
  const suffix = assetNameSuffix(input.creditSource);
  const prefix = assetFlow ? "asset" : input.kind;

  // ⭐ 2026-08-02 审计 1.2：不再全表扫该用户所有 MediaAsset 来起名（每次生成搬 N 行、还占着 advisory 锁）。
  //   新做法 = 「计数器起点提示 + 候选名定点存在性检查」（走 (userId, systemName) 索引，每批只查几个候选）。
  //   历史教训「不能只信计数器」由存在性检查兜底：提示偏了就跳过已占用的号，绝不重名。
  //   ⛔ asset 流（资产库角色图，低频）没有服务端计数器，仍走原来的全量扫描（量小，不值得为它加计数器）。
  if (assetFlow) {
    const assets = await tx.mediaAsset.findMany({ where: { userId: input.userId }, select: { systemName: true, initialName: true } });
    const used = new Set<string>(usedByJobs);
    for (const asset of assets) for (const name of [asset.systemName, asset.initialName]) if (name) used.add(name);
    const names: string[] = [];
    let number = 1;
    while (names.length < input.count) {
      const name = `asset_${number}_${suffix}`;
      if (!used.has(name)) {
        names.push(name);
        used.add(name);
      }
      number += 1;
    }
    return names;
  }

  const buildName = (n: number) => `${prefix}_${n}_${code}`;
  const names: string[] = [];
  let number = Math.max(1, numberHint);
  while (names.length < input.count) {
    const batchSize = Math.max(8, (input.count - names.length) * 2);
    const candidates: string[] = [];
    for (let i = 0; i < batchSize; i += 1) candidates.push(buildName(number + i));
    const [bySystemName, byInitialName] = await Promise.all([
      tx.mediaAsset.findMany({ where: { userId: input.userId, systemName: { in: candidates } }, select: { systemName: true } }),
      tx.mediaAsset.findMany({ where: { userId: input.userId, initialName: { in: candidates } }, select: { initialName: true } }),
    ]);
    const taken = new Set<string>(usedByJobs);
    for (const row of bySystemName) if (row.systemName) taken.add(row.systemName);
    for (const row of byInitialName) if (row.initialName) taken.add(row.initialName);
    for (const name of names) taken.add(name);
    for (const candidate of candidates) {
      number += 1;
      if (names.length >= input.count) break;
      if (!taken.has(candidate)) names.push(candidate);
    }
  }
  return names;
}

async function ensureJobReservedNames(job: GenerationJobRow) {
  if (job.reservedNames?.length) return job.reservedNames;
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ reservedNames: string[] | null }>>`SELECT "reservedNames" FROM "GenerationJob" WHERE "id" = ${job.id} FOR UPDATE`;
    if (rows[0]?.reservedNames?.length) return rows[0].reservedNames;
    const names = await reserveJobNames(tx, { userId: job.userId, kind: job.kind, count: Math.max(1, job.count), flow: job.flow ?? undefined, workflowId: job.workflowId ?? undefined, conversationId: job.conversationId ?? undefined, conversationCode: typeof job.extraJson?.conversationCode === "string" ? job.extraJson.conversationCode : undefined, creditSource: job.creditSource ?? undefined });
    await tx.$executeRaw`UPDATE "GenerationJob" SET "reservedNames" = ${jsonParam(names)}::jsonb, "updatedAt" = NOW() WHERE "id" = ${job.id}`;
    return names;
  });
}

export type CreateImageJobInput = {
  userId: string;
  requestId: string;
  prompt: string;
  model?: string;
  referenceImages?: string[];
  settings?: { ratio?: string; resolution?: string; quality?: string };
  count?: number;
  candidateMode?: "all" | "best";
  creditSource?: string;
  conversationId?: string;
  conversationTitle?: string;
  conversationCode?: string;
  messageId?: string;
  workflowId?: string;
  workflowNodeId?: string;
  itemIndex?: number;
  flow?: "conversation" | "workflow";
  metadata?: Prisma.InputJsonValue;
  extra?: Record<string, unknown>;
  transparent?: boolean;
  // 本地抠图（去背景 / 编辑元素透明主体层）：为 true 时跳过出图 provider，直接对参考图跑本地抠图模型产真透明 PNG。
  bgRemove?: boolean;
  // 编辑类功能（去背景/高清/快捷编辑/橡皮/编辑元素）标记：失败时透出真实原因（中文），不套用通用"服务器繁忙"文案。
  editFunction?: boolean;
};

export type CreateVideoJobInput = {
  userId: string;
  requestId: string;
  providerTaskId: string;
  prompt: string;
  model?: string;
  referenceImages?: string[];
  referenceVideos?: string[];
  referenceAudios?: string[];
  referenceMode?: string;
  settings?: { ratio?: string; resolution?: string; duration?: string };
  creditSource?: string;
  conversationId?: string;
  conversationTitle?: string;
  conversationCode?: string;
  messageId?: string;
  workflowId?: string;
  workflowNodeId?: string;
  itemIndex?: number;
  flow?: "conversation" | "workflow";
  usage?: Record<string, unknown>;
  metadata?: Prisma.InputJsonValue;
  extra?: Record<string, unknown>;
};

/**
 * 把参考素材里的 `asset://<bytePlusAssetId>`（对话流为省流量对已上传/库内资产的引用）解析回真实可显示 url。
 * 真实 url / data: / http 原样返回；解析不到的 asset:// 也原样保留。统一在建 job 时解析，保证 referenceImages
 * 存的是可显示 url（否则后台弹窗/使用提示词只能显示成破图），并让 resolveReferenceNames 能反查到名字。
 *
 * ⭐ 同时做 url 归一化（`normalizeReferenceAssetUrl`）：剥掉自家主机绝对前缀、把
 * `/api/media-thumbnail?url=` 这种**动态缩略图接口地址**还原成原图静态直链 —— 否则平台（BytePlus）
 * 来拉这个接口会超时，整个任务失败（2026-07-28 排查到 18 条线上失败就是这个）。
 */
async function resolveReferenceUrls(userId: string, urls: string[]): Promise<string[]> {
  const normalized = normalizeReferenceAssetUrls(urls);
  const assetIds = Array.from(new Set(normalized.filter((url) => url.startsWith("asset://")).map((url) => url.slice("asset://".length)).filter(Boolean)));
  if (assetIds.length === 0) return normalized;
  const urlByAssetId = new Map<string, string>();
  try {
    const rows = await prisma.$queryRaw<Array<{ bytePlusAssetId: string; url: string }>>`
      SELECT uas."bytePlusAssetId", ma."url"
      FROM "UserAssetState" uas JOIN "MediaAsset" ma ON ma."id" = uas."mediaAssetId"
      WHERE uas."userId" = ${userId} AND uas."bytePlusAssetId" IN (${Prisma.join(assetIds)})
    `;
    for (const row of rows) if (row.bytePlusAssetId && row.url) urlByAssetId.set(row.bytePlusAssetId, row.url);
  } catch (error) {
    console.warn("[generation-jobs] resolveReferenceUrls failed", { error: error instanceof Error ? error.message : String(error) });
  }
  return normalized.map((url) => (url.startsWith("asset://") ? normalizeReferenceAssetUrl(urlByAssetId.get(url.slice("asset://".length)) ?? url) : url));
}

/**
 * Resolve display names for reference URLs from the authoritative asset tables, keyed by url.
 * Name = 改名(UserAssetState.currentName) || 终身ID(MediaAsset.initialName) || systemName. Matched on both
 * `url` and `normalizedUrl`. Stored on the job at creation so "使用提示词" needs no per-click lookup and the
 * prompt's @mentions can turn blue again. Best-effort: URLs without a MediaAsset row are simply omitted.
 */
async function resolveReferenceNames(userId: string, urls: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(urls.filter((url) => typeof url === "string" && Boolean(url))));
  if (unique.length === 0) return {};
  const nameByUrl: Record<string, string> = {};
  try {
    const rows = await prisma.$queryRaw<Array<{ url: string; normalizedUrl: string; systemName: string | null; initialName: string | null; currentName: string | null }>>`
      SELECT ma."url", ma."normalizedUrl", ma."systemName", ma."initialName", uas."currentName"
      FROM "MediaAsset" ma
      LEFT JOIN "UserAssetState" uas ON uas."mediaAssetId" = ma."id" AND uas."userId" = ma."userId"
      WHERE ma."userId" = ${userId} AND (ma."url" IN (${Prisma.join(unique)}) OR ma."normalizedUrl" IN (${Prisma.join(unique)}))
    `;
    for (const row of rows) {
      const name = (row.currentName ?? row.initialName ?? row.systemName ?? "").trim();
      if (!name) continue;
      if (row.url) nameByUrl[row.url] ??= name;
      if (row.normalizedUrl) nameByUrl[row.normalizedUrl] ??= name;
    }
  } catch (error) {
    console.warn("[generation-jobs] resolveReferenceNames failed", { error: error instanceof Error ? error.message : String(error) });
  }
  return nameByUrl;
}

/**
 * 参考视频/音频的「时长 + 宽高」权威取值（按 url 反查 MediaAsset）。
 *
 * ⛔ 为什么必须有这个（2026-08-05 修的线上 bug）：工作流「使用提示词」还原出来的参考素材
 * 原来只带 `{url, name, kind}`，**没有 durationSeconds / dimensions** —— 而工作流发送前的
 * `validateWorkflowUploadsForSubmit` 会逐个校验参考视频的时长和尺寸，读不到就返回
 * 「视频时长读取失败」**把发送永久拦死**（用户只能删掉素材重新 @ 一次）。
 * 时长/宽高本来就在 MediaAsset 上（上传走 media-upload-probe、生成走 video-poster 都会写），
 * 所以这里从库里直出，别让前端去猜。
 *
 * best-effort：查不到的 url 直接不出现在返回里（前端会在浏览器里再读一次兜底）。
 * 匹配 `url` 和 `normalizedUrl` 两列，口径与 `resolveReferenceNames` 完全一致。
 */
export type ReferenceMediaMetadata = { durationSeconds?: number; width?: number; height?: number };
export async function resolveReferenceMediaMetadata(userId: string, urls: string[]): Promise<Record<string, ReferenceMediaMetadata>> {
  const unique = Array.from(new Set(urls.filter((url) => typeof url === "string" && Boolean(url))));
  if (unique.length === 0) return {};
  const metaByUrl: Record<string, ReferenceMediaMetadata> = {};
  try {
    const rows = await prisma.$queryRaw<Array<{ url: string; normalizedUrl: string; durationSeconds: number | null; width: number | null; height: number | null }>>`
      SELECT "url", "normalizedUrl", "durationSeconds", "width", "height"
      FROM "MediaAsset"
      WHERE "userId" = ${userId} AND ("url" IN (${Prisma.join(unique)}) OR "normalizedUrl" IN (${Prisma.join(unique)}))
    `;
    for (const row of rows) {
      const meta: ReferenceMediaMetadata = {
        durationSeconds: typeof row.durationSeconds === "number" && row.durationSeconds > 0 ? row.durationSeconds : undefined,
        width: typeof row.width === "number" && row.width > 0 ? row.width : undefined,
        height: typeof row.height === "number" && row.height > 0 ? row.height : undefined,
      };
      if (meta.durationSeconds === undefined && meta.width === undefined && meta.height === undefined) continue;
      if (row.url) metaByUrl[row.url] ??= meta;
      if (row.normalizedUrl) metaByUrl[row.normalizedUrl] ??= meta;
    }
  } catch (error) {
    console.warn("[generation-jobs] resolveReferenceMediaMetadata failed", { error: error instanceof Error ? error.message : String(error) });
  }
  return metaByUrl;
}

/** 建一条排队中的图片任务（幂等：同 requestId 已存在则直接返回原任务）。 */
export async function createImageJob(input: CreateImageJobInput): Promise<GenerationJobRow> {
  const existing = await getGenerationJobByRequestId(input.requestId);
  if (existing) return existing;

  const id = randomUUID();
  const provider = input.model?.startsWith("byteplus:") ? "byteplus" : "openrouter";
  const count = Math.min(4, Math.max(1, Math.floor(input.count ?? 1)));
  const extra = { ...(input.extra ?? {}), ...(input.candidateMode ? { candidateMode: input.candidateMode } : {}), ...(input.conversationCode ? { conversationCode: input.conversationCode } : {}), ...(input.transparent ? { transparent: true } : {}), ...(input.bgRemove ? { bgRemove: true } : {}), ...(input.editFunction ? { editFunction: true } : {}) };
  const referenceImages = await resolveReferenceUrls(input.userId, input.referenceImages ?? []);
  const referenceNames = await resolveReferenceNames(input.userId, referenceImages);
  await prisma.$transaction(async (tx) => {
    const reservedNames = await reserveJobNames(tx, { userId: input.userId, kind: "image", count, flow: input.flow, workflowId: input.workflowId, conversationId: input.conversationId, conversationCode: input.conversationCode, creditSource: input.creditSource });
    await tx.$executeRaw`
    INSERT INTO "GenerationJob" (
      "id", "userId", "requestId", "kind", "status", "flow", "creditSource", "model", "provider",
      "prompt", "settingsJson", "referenceImages", "referenceNames", "conversationId", "conversationTitle",
       "messageId", "workflowId", "workflowNodeId", "itemIndex", "count", "reservedNames", "metadataJson", "extraJson",
      "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${input.userId}, ${input.requestId}, 'image', 'queued', ${input.flow ?? null}, ${input.creditSource ?? null}, ${input.model ?? null}, ${provider},
      ${input.prompt}, ${jsonParam(input.settings)}::jsonb, ${jsonParam(referenceImages)}::jsonb, ${jsonParam(referenceNames)}::jsonb, ${input.conversationId ?? null}, ${input.conversationTitle ?? null},
       ${input.messageId ?? null}, ${input.workflowId ?? null}, ${input.workflowNodeId ?? null}, ${input.itemIndex ?? null}, ${count}, ${jsonParam(reservedNames)}::jsonb, ${jsonParam(input.metadata)}::jsonb, ${jsonParam(extra)}::jsonb,
      NOW(), NOW()
    )
    ON CONFLICT ("requestId") DO NOTHING
    `;
  });
  const created = await getGenerationJobByRequestId(input.requestId);
  if (!created) throw new Error("创建生成任务失败");
  // 立即触发 worker，尽快开始（worker 内有 lease 防重复）。
  void import("@/lib/generation-worker").then((mod) => mod.nudgeGenerationWorker()).catch(() => undefined);
  return created;
}

/** 创建一条视频轮询任务（创建阶段仍由 /api/video 处理，worker 只负责轮询到完成）。 */
export async function createVideoJob(input: CreateVideoJobInput): Promise<GenerationJobRow> {
  const existing = await getGenerationJobByRequestId(input.requestId);
  if (existing) return existing;

  const id = randomUUID();
  const provider = input.model?.startsWith("byteplus:video.") ? "byteplus" : "openrouter";
  const extra = { ...(input.extra ?? {}), ...(input.conversationCode ? { conversationCode: input.conversationCode } : {}) };
  const referenceImages = await resolveReferenceUrls(input.userId, input.referenceImages ?? []);
  const referenceVideos = await resolveReferenceUrls(input.userId, input.referenceVideos ?? []);
  const referenceAudios = await resolveReferenceUrls(input.userId, input.referenceAudios ?? []);
  const referenceNames = await resolveReferenceNames(input.userId, [...referenceImages, ...referenceVideos, ...referenceAudios]);
  await prisma.$transaction(async (tx) => {
    const reservedNames = await reserveJobNames(tx, { userId: input.userId, kind: "video", count: 1, flow: input.flow, workflowId: input.workflowId, conversationId: input.conversationId, conversationCode: input.conversationCode, creditSource: input.creditSource });
    await tx.$executeRaw`
    INSERT INTO "GenerationJob" (
      "id", "userId", "requestId", "kind", "status", "flow", "creditSource", "model", "provider",
      "prompt", "settingsJson", "referenceImages", "referenceVideos", "referenceAudios", "referenceNames", "referenceMode",
       "conversationId", "conversationTitle", "messageId", "workflowId", "workflowNodeId", "itemIndex", "count", "reservedNames", "providerTaskId",
      "usageJson", "metadataJson", "extraJson", "nextRunAt", "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${input.userId}, ${input.requestId}, 'video', 'running', ${input.flow ?? null}, ${input.creditSource ?? null}, ${input.model ?? null}, ${provider},
      ${input.prompt}, ${jsonParam(input.settings)}::jsonb, ${jsonParam(referenceImages)}::jsonb, ${jsonParam(referenceVideos)}::jsonb, ${jsonParam(referenceAudios)}::jsonb, ${jsonParam(referenceNames)}::jsonb, ${input.referenceMode ?? null},
       ${input.conversationId ?? null}, ${input.conversationTitle ?? null}, ${input.messageId ?? null}, ${input.workflowId ?? null}, ${input.workflowNodeId ?? null}, ${input.itemIndex ?? null}, 1, ${jsonParam(reservedNames)}::jsonb, ${input.providerTaskId},
      ${jsonParam(input.usage)}::jsonb, ${jsonParam(input.metadata)}::jsonb, ${jsonParam(extra)}::jsonb, NOW(), NOW(), NOW()
    )
    ON CONFLICT ("requestId") DO NOTHING
    `;
  });
  const created = await getGenerationJobByRequestId(input.requestId);
  if (!created) throw new Error("创建视频生成任务失败");
  void import("@/lib/generation-worker").then((mod) => mod.nudgeGenerationWorker()).catch(() => undefined);
  return created;
}

export async function getGenerationJobByRequestId(requestId: string): Promise<GenerationJobRow | undefined> {
  const rows = await prisma.$queryRaw<GenerationJobRow[]>`SELECT * FROM "GenerationJob" WHERE "requestId" = ${requestId} LIMIT 1`;
  return rows[0];
}

export async function getGenerationJobsByRequestIds(userId: string, requestIds: string[]): Promise<GenerationJobRow[]> {
  const ids = requestIds.filter((id) => typeof id === "string" && id).slice(0, 200);
  if (ids.length === 0) return [];
  return prisma.$queryRaw<GenerationJobRow[]>`SELECT * FROM "GenerationJob" WHERE "userId" = ${userId} AND "requestId" IN (${Prisma.join(ids)})`;
}

/**
 * 唯一权威：把一条 GenerationJob 的参考素材（图/视频/音频 url + referenceNames 显示名）拍平成
 * `{url, name, kind}[]`。前端"使用提示词"接口、后台媒体弹窗都必须复用它，禁止各写一份。
 */
export type GenerationReferenceItem = { url: string; name?: string; kind: "image" | "video" | "audio" };
export function buildJobReferenceItems(job: { referenceImages?: unknown; referenceVideos?: unknown; referenceAudios?: unknown; referenceNames?: unknown }): GenerationReferenceItem[] {
  const names = (job.referenceNames && typeof job.referenceNames === "object" && !Array.isArray(job.referenceNames)) ? job.referenceNames as Record<string, string> : {};
  const build = (urls: unknown, kind: GenerationReferenceItem["kind"]): GenerationReferenceItem[] =>
    (Array.isArray(urls) ? urls : []).filter((url): url is string => typeof url === "string" && Boolean(url)).map((url) => ({ url, name: names[url], kind }));
  return [...build(job.referenceImages, "image"), ...build(job.referenceVideos, "video"), ...build(job.referenceAudios, "audio")];
}

export function parseStoredInputReferences(value: unknown): GenerationReferenceItem[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.inputReferences)) {
    return record.inputReferences.flatMap((item): GenerationReferenceItem[] => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const row = item as Record<string, unknown>;
      const url = typeof row.url === "string" ? row.url : "";
      const kind = row.kind === "video" || row.kind === "audio" || row.kind === "image" ? row.kind : null;
      if (!url || !kind) return [];
      return [{ url, kind, name: typeof row.name === "string" && row.name ? row.name : undefined }];
    });
  }
  const audios = Array.isArray(record.referenceAudios) ? record.referenceAudios : [];
  return audios.filter((url): url is string => typeof url === "string" && Boolean(url)).map((url) => ({ url, kind: "audio" as const }));
}

export function mergeInputReferencesIntoSettings(settings: unknown, refs: GenerationReferenceItem[]): Prisma.InputJsonValue | undefined {
  const base = settings && typeof settings === "object" && !Array.isArray(settings) ? { ...(settings as Record<string, unknown>) } : {};
  if (refs.length > 0) base.inputReferences = refs;
  return Object.keys(base).length > 0 ? base as Prisma.InputJsonValue : undefined;
}

// ⛔ 原来这里有个 `getLatestSucceededJobForWorkflowNode`（`SELECT *` 取整行 job）已删除：
// 唯一调用者是「使用提示词」接口，已换成下面的窄查询 `getWorkflowPromptReferenceRow`。别把它捡回来。

/**
 * ⭐ 「使用提示词」专用的**窄查询**（`/api/workflow-generation-references` 唯一调用者）。
 *
 * 为什么不复用上面两个函数：它们都是 `SELECT *`，会把 `settingsJson`/`metadataJson`/`extraJson`/`prompt`
 * 这几个大 JSON 列整行拉回来，而这个接口**只用到 6 个字段**；而且它们是串行 `?? await`，
 * 命中不了节点时还要再连着走 2~3 个往返。用户点「使用提示词」是**交互路径**，跨境每个往返都要 ~0.4s。
 *
 * 这里做三件事：① 只查用得到的列（`extraJson->>'cleanPrompt'` 在库里就把大 JSON 里那一个字段抽出来）；
 * ② 「按节点找」和「按媒体 url 找 requestId」**并发**发出（原来是串行）；
 * ③ 兜底那条「裸 requestId → `xxx:image:0`」用 `= 或 LIKE` 合成一条语句，不再多一个往返。
 * 结果：命中常见路径 1 个往返、最坏 2 个（原来最坏 4 个）。
 *
 * ⛔ 别把这个函数改成通用工具去别处复用：它的返回是"够这个接口用"的窄形状，不是完整 job 行。
 * 参考素材拍平仍统一走唯一实现 `buildJobReferenceItems`。
 */
export type WorkflowPromptReferenceRow = {
  referenceImages: unknown;
  referenceVideos: unknown;
  referenceAudios: unknown;
  referenceNames: unknown;
  referenceMode: string | null;
  cleanPrompt: string | null;
};

const workflowPromptReferenceColumns = Prisma.sql`
  "referenceImages", "referenceVideos", "referenceAudios", "referenceNames", "referenceMode",
  "extraJson"->>'cleanPrompt' AS "cleanPrompt"
`;

export async function getWorkflowPromptReferenceRow(userId: string, workflowId: string, workflowNodeId: string, mediaUrl: string): Promise<WorkflowPromptReferenceRow | undefined> {
  const cleanMediaUrl = mediaUrl ? mediaUrl.split("?")[0].split("#")[0].replace(/^https?:\/\/[^/]+/, "") : "";
  const [nodeRows, assetRows] = await Promise.all([
    prisma.$queryRaw<WorkflowPromptReferenceRow[]>`
      SELECT ${workflowPromptReferenceColumns}
      FROM "GenerationJob"
      WHERE "userId" = ${userId} AND "workflowId" = ${workflowId} AND "workflowNodeId" = ${workflowNodeId} AND "status" = 'succeeded'
      ORDER BY "updatedAt" DESC
      LIMIT 1
    `,
    // 本工作流节点没有对应 job（从资产库导入的、在对话流/别的工作流生成的）时才用得上；
    // 但它和上面那条互不依赖，所以并发发出，不要等上面那条落空了再发。
    mediaUrl
      ? prisma.$queryRaw<Array<{ requestId: string | null }>>`
          SELECT "requestId" FROM "MediaAsset"
          WHERE "userId" = ${userId} AND ("url" = ${mediaUrl} OR "url" = ${cleanMediaUrl} OR "normalizedUrl" = ${cleanMediaUrl})
            AND "requestId" IS NOT NULL AND "requestId" <> ''
          LIMIT 1
        `
      : Promise.resolve([] as Array<{ requestId: string | null }>),
  ]);
  if (nodeRows[0]) return nodeRows[0];

  const requestId = assetRows[0]?.requestId ?? undefined;
  if (!requestId) return undefined;
  // 兼容对话流历史裸 requestId（job 的 requestId 是 `<裸>:image|video:0`）：
  // 精确命中排前面，不再分两次查。
  const rows = await prisma.$queryRaw<WorkflowPromptReferenceRow[]>`
    SELECT ${workflowPromptReferenceColumns}
    FROM "GenerationJob"
    WHERE "userId" = ${userId} AND ("requestId" = ${requestId} OR "requestId" LIKE ${requestId + ":%"})
    ORDER BY ("requestId" = ${requestId}) DESC, "createdAt" DESC
    LIMIT 1
  `;
  return rows[0];
}

/**
 * 按某个生成媒体的 url 找它「原始生成任务」（供从资产库导入的节点"使用提示词"还原参考素材）。
 * 导入的资产可能是对话流/别的工作流生成的，本工作流节点没有对应 job，故改按媒体 url→MediaAsset.requestId→job 找。
 * 兼容对话流历史裸 requestId（job 是 `<裸>:image|video:0`）：直查不到就按前缀再找一次。
 */
export async function getGenerationJobByMediaUrl(userId: string, mediaUrl: string): Promise<GenerationJobRow | undefined> {
  if (!mediaUrl) return undefined;
  const clean = mediaUrl.split("?")[0].split("#")[0].replace(/^https?:\/\/[^/]+/, "");
  const assetRows = await prisma.$queryRaw<Array<{ requestId: string | null }>>`
    SELECT "requestId" FROM "MediaAsset"
    WHERE "userId" = ${userId} AND ("url" = ${mediaUrl} OR "url" = ${clean} OR "normalizedUrl" = ${clean})
      AND "requestId" IS NOT NULL AND "requestId" <> ''
    LIMIT 1
  `;
  const requestId = assetRows[0]?.requestId ?? undefined;
  if (!requestId) return undefined;
  const direct = await getGenerationJobByRequestId(requestId);
  if (direct) return direct;
  const prefixed = await prisma.$queryRaw<GenerationJobRow[]>`
    SELECT * FROM "GenerationJob" WHERE "userId" = ${userId} AND "requestId" LIKE ${requestId + ":%"} ORDER BY "createdAt" DESC LIMIT 1
  `;
  return prefixed[0];
}

export async function getMediaInputReferences(userId: string, mediaUrl: string): Promise<GenerationReferenceItem[]> {
  if (!mediaUrl) return [];
  const clean = mediaUrl.split("?")[0].split("#")[0].replace(/^https?:\/\/[^/]+/, "");
  const assetRows = await prisma.$queryRaw<Array<{ generationSettings: unknown }>>`
    SELECT "generationSettings" FROM "MediaAsset"
    WHERE "userId" = ${userId} AND ("url" = ${mediaUrl} OR "url" = ${clean} OR "normalizedUrl" = ${clean})
    LIMIT 1
  `;
  const stored = parseStoredInputReferences(assetRows[0]?.generationSettings);
  if (stored.length > 0) return stored;
  const job = await getGenerationJobByMediaUrl(userId, mediaUrl);
  return job ? buildJobReferenceItems(job) : [];
}

/** 拉取该用户所有仍在进行 + 最近完成的任务，供前端加载/重连时对齐展示。 */
export async function getActiveGenerationJobs(userId: string, sinceMs = 6 * 60 * 60 * 1000): Promise<GenerationJobRow[]> {
  const since = new Date(Date.now() - sinceMs);
  return prisma.$queryRaw<GenerationJobRow[]>`
    SELECT * FROM "GenerationJob"
    WHERE "userId" = ${userId}
      AND ("status" IN ('queued','running') OR "updatedAt" >= ${since})
    ORDER BY "updatedAt" DESC
    LIMIT 200
  `;
}

/**
 * ⭐ 「哪些工作流正在生成中」的唯一权威来源（服务端算，前端只读）。
 *
 * 以前这是前端**扫一遍所有工作流的所有节点**找 `data.isRunning` 得出的
 * （chat-workbench.tsx 的 hasAnyWorkflowGenerating），这带来两个问题：
 *   ① 逼着接口把所有工作流的画布都下发（工作流一多就卡，这是按需加载的最后一道阻力）；
 *   ② `isRunning` 是画布里的**持久化标记**，你切走后后台生成完了它也不会清 →
 *      侧边栏那颗跳动的点会一直亮着，其实早就跑完了。
 * 改由服务端查 GenerationJob 表后，两个问题一起没了，而且比前端准。
 */
export async function getRunningWorkflowIds(userId: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ workflowId: string | null }>>`
    SELECT DISTINCT "workflowId" FROM "GenerationJob"
    WHERE "userId" = ${userId} AND "status" IN ('queued','running') AND "workflowId" IS NOT NULL
    LIMIT 200
  `;
  return rows.map((row) => row.workflowId).filter((id): id is string => Boolean(id));
}

// ---- image helpers (mirrors src/app/api/image/route.ts, kept in sync) ----

function isAssetImageCreditSource(source: string | null | undefined) {
  return source === "character_image_generation" || source === "scene_image_generation" || source === "prop_image_generation" || source === "shot_image_generation";
}

function isSameImageDimensions(a: { width: number; height: number } | undefined, b: { width: number; height: number } | undefined) {
  return Boolean(a && b && a.width === b.width && a.height === b.height);
}

function pickRequestedImages(images: string[], dimensions: Record<string, { width: number; height: number }> | undefined, requestedCount: number, model: string | undefined, settings: { ratio?: string; resolution?: string } | undefined) {
  const expected = getExpectedImageDimensions(model, settings?.resolution, settings?.ratio);
  if (!expected.width || !expected.height || !dimensions) return images.slice(0, requestedCount);
  const matched = images.filter((url) => isSameImageDimensions(dimensions[url], expected));
  return (matched.length > 0 ? matched : images).slice(0, requestedCount);
}

function pickImageDimensions(dimensions: Record<string, { width: number; height: number }> | undefined, urls: string[]) {
  if (!dimensions) return dimensions;
  return Object.fromEntries(urls.map((url) => [url, dimensions[url]]).filter((item): item is [string, { width: number; height: number }] => Boolean(item[1])));
}

function getImageCreditParameterMetadata(settings: { ratio?: string; resolution?: string } | undefined, dimensions: Record<string, { width: number; height: number }> | undefined): Prisma.InputJsonObject {
  const sizes = Object.values(dimensions ?? {}).map((item) => `${item.width}x${item.height}`).filter(Boolean);
  return { settings: { ratio: settings?.ratio ?? "", resolution: settings?.resolution ?? "" }, ratio: settings?.ratio ?? "", resolution: settings?.resolution ?? "", size: sizes[0] ?? "", sizes };
}

function mergeImageCreditMetadata(metadata: Prisma.InputJsonValue | undefined, extra: Prisma.InputJsonObject): Prisma.InputJsonValue {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? { ...metadata, ...extra } : extra;
}

async function markJobSucceeded(id: string, patch: { resultUrls: string[]; reservedNames?: string[]; resultDimensions?: Record<string, { width: number; height: number; durationSeconds?: number }>; posterUrl?: string; usage?: unknown; credit?: unknown }) {
  await prisma.$executeRaw`
    UPDATE "GenerationJob" SET
      "status" = 'succeeded', "resultUrls" = ${jsonParam(patch.resultUrls)}::jsonb, "reservedNames" = ${jsonParam(patch.reservedNames)}::jsonb, "resultDimensions" = ${jsonParam(patch.resultDimensions)}::jsonb,
      "posterUrl" = ${patch.posterUrl ?? null}, "usageJson" = ${jsonParam(patch.usage)}::jsonb, "creditJson" = ${jsonParam(patch.credit)}::jsonb,
      "error" = NULL, "errorCode" = NULL, "completedAt" = NOW(), "leaseAt" = NULL, "updatedAt" = NOW()
    WHERE "id" = ${id}
  `;
}

async function scheduleJobRetry(id: string, delayMs: number) {
  await prisma.$executeRaw`
    UPDATE "GenerationJob" SET "nextRunAt" = ${new Date(Date.now() + delayMs)}, "leaseAt" = NULL, "updatedAt" = NOW()
    WHERE "id" = ${id}
  `;
}

function getFiniteNumber(value: unknown) {
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

// ⭐ 用量/成本三件套已收敛到唯一权威 `@/lib/video-usage-cost`
//   （原来本文件和 `api/video/route.ts` 各存一份一字不差的实现 —— 扣费金额是钱，
//    两份各自演化就会出现"一条路扣对了、另一条路白送"这类静默漏收）。
//   ⛔ 禁止在本文件里再写一份 getUsageMeta / withXxxUsd。
const getUsageMeta = getVideoUsageMeta;
const withChargedUsage = withChargedVideoUsage;


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

function getVideoErrorMessage(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const success = record.success;
  const code = record.code;
  const message = record.msg ?? record.message ?? record.error;
  if (success === false || (typeof code === "string" && code !== "0" && code !== "200")) {
    return [typeof code === "string" || typeof code === "number" ? `code=${code}` : "", typeof message === "string" ? message : "视频平台返回失败"].filter(Boolean).join("，");
  }
  if (typeof message === "string" && message.trim()) return message.trim();
  if (message && typeof message === "object" && typeof (message as { message?: unknown }).message === "string") return (message as { message: string }).message;
  for (const key of ["data", "result", "task", "content", "payload"]) {
    const nestedMessage = getVideoErrorMessage(record[key]);
    if (nestedMessage) return nestedMessage;
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
  for (const key of ["video_url", "videoUrl", "url", "video", "outputUrl", "output_url", "message", "unsigned_urls", "urls"]) {
    const item = record[key];
    if (typeof item === "string" && item.trim()) return item.trim();
  }
  for (const item of Object.values(record)) {
    const videoUrl = getVideoUrl(item);
    if (videoUrl) return videoUrl;
  }
  return undefined;
}

async function markJobFailed(id: string, error: string, errorCode?: string) {
  await prisma.$executeRaw`
    UPDATE "GenerationJob" SET
      "status" = 'failed', "error" = ${error.slice(0, 500)}, "errorCode" = ${errorCode ?? null},
      "reservedNames" = NULL,
      "completedAt" = NOW(), "leaseAt" = NULL, "updatedAt" = NOW()
    WHERE "id" = ${id}
  `;
}

const MAX_IMAGE_JOB_ATTEMPTS = 6;

/**
 * ⭐ 视频轮询的**连续**异常上限（2026-07-29 加，排 A3 时发现）。
 *
 * ⛔ 为什么不能用 `attempts`（图片那套 MAX_IMAGE_JOB_ATTEMPTS）：视频是轮询式的，
 * 正常成功的任务本来就要轮几十次（线上实测最大 attempts=208 且是成功的长视频）。
 * 拿 attempts 设上限会把正常的长视频任务直接掐死。
 *
 * 所以这里数的是「**连续**失败次数」`extraJson.pollErrorStreak`：只在 catch 分支 +1，
 * 任何一次查询成功就归零。30 次 × 10 秒退避 ≈ 连续 5 分钟查不动才判失败，
 * 足够扛住跨境网络抖动，又不会像以前那样**每 10 秒无限重试、永不放弃、且只写 console.warn**
 * （docker logs 会滚掉 → 事后完全查不到，这正是 A3「查不动」的一部分原因）。
 *
 * ⚠️ 注意：等本地存盘那条路（`saveJob` 还没好）走的是正常 return + scheduleJobRetry，
 * **不经过 catch**，所以不会被这个上限影响 —— "只要平台给了 url 就一直等到存好"的老行为没变。
 */
const MAX_VIDEO_POLL_ERROR_STREAK = 30;

function getPollErrorStreak(job: GenerationJobRow) {
  const value = job.extraJson?.pollErrorStreak;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

async function setPollErrorStreak(job: GenerationJobRow, streak: number) {
  const nextExtra = { ...(job.extraJson ?? {}), pollErrorStreak: streak };
  await prisma.$executeRaw`UPDATE "GenerationJob" SET "extraJson" = ${jsonParam(nextExtra)}::jsonb, "updatedAt" = NOW() WHERE "id" = ${job.id}`;
  return { ...job, extraJson: nextExtra };
}

function deriveWorkflowCode(workflowCode: string | null, title: string | null): string {
  if (workflowCode && workflowCode.trim()) return workflowCode.trim();
  const match = (title ?? "").match(/(\d+)/);
  if (match) return `w${Number(match[1])}`;
  return "w0";
}

/**
 * 后端在图片任务成功时直接写入资产库（MediaAsset + UserAssetState）。
 * 这样即使用户永远不回来，成品图也一定进资产库、不丢。名称在提交任务时已原子保留，
 * 成功时直接提交该名称，避免完成顺序和前端计数器影响命名。
 */
async function finalizeImageJobAsset(job: GenerationJobRow, images: string[], dimensions: Record<string, { width: number; height: number }> | undefined) {
  const isWorkflow = job.flow === "workflow" && Boolean(job.workflowId);
  const isAsset = isAssetImageCreditSource(job.creditSource);
  const sourcePrompt = (job.extraJson?.cleanPrompt as string | undefined) || job.prompt || undefined;
  const settings = job.settingsJson ?? undefined;
  const flow = isAsset ? "asset" : isWorkflow ? "workflow" : "conversation";
  const assetKind: AssetGenerationKind | undefined = isAsset ? (job.creditSource === "scene_image_generation" ? "scene" : job.creditSource === "prop_image_generation" ? "prop" : job.creditSource === "shot_image_generation" ? "shot" : "character") : undefined;
  const initialCategory = classifyAsset({ origin: "generated", flow, mediaType: "image", assetKind }).initialCategory;

  await prisma.$transaction(async (tx) => {
    for (const [index, rawUrl] of images.entries()) {
      const resolved = resolvePersistableMediaAssetUrl(job.userId, rawUrl);
      if (!resolved) continue;
      const dim = dimensions?.[rawUrl];
      const name = job.reservedNames?.[index];
      if (!name) throw new Error(`Missing image name reservation for ${job.requestId}`);
      const media = await tx.mediaAsset.upsert({
        where: { userId_normalizedUrl: { userId: job.userId, normalizedUrl: resolved.normalizedUrl } },
        create: buildMediaAssetRecord({
          userId: job.userId, origin: "generated", flow, mediaType: "image", assetKind,
          url: resolved.url, normalizedUrl: resolved.normalizedUrl, originalUrl: resolved.originalUrl, thumbnailUrl: resolved.thumbnailUrl,
          name, sourcePrompt,
          model: job.model ?? undefined, ratio: settings?.ratio, resolution: settings?.resolution,
          generationSettings: mergeInputReferencesIntoSettings(settings, buildJobReferenceItems(job)),
          width: dim?.width, height: dim?.height,
          conversationId: job.conversationId ?? undefined, messageId: job.messageId ?? undefined,
          workflowId: job.workflowId ?? undefined, workflowNodeId: job.workflowNodeId ?? undefined,
          requestId: job.requestId,
        }),
        update: {
          model: job.model ?? undefined,
          ratio: settings?.ratio ?? undefined,
          resolution: settings?.resolution ?? undefined,
          generationSettings: mergeInputReferencesIntoSettings(settings, buildJobReferenceItems(job)),
          width: dim?.width ?? undefined,
          height: dim?.height ?? undefined,
          requestId: job.requestId ?? undefined,
        },
        select: { id: true },
      });
      const existingState = await tx.userAssetState.findUnique({ where: { userId_mediaAssetId: { userId: job.userId, mediaAssetId: media.id } }, select: { id: true } });
      if (!existingState) {
        await tx.userAssetState.create({ data: buildUserAssetStateRecord({ userId: job.userId, mediaAssetId: media.id, name, initialCategory }) });
      }
    }
  });
}


/**
 * 把已生成、交付好的图片本地化后落库；本地没存好就重排队等待（不重新生成）。
 * 跨境慢导致的存盘超时（>初始等待）会走这里重排队，直到本地存好或远程过期，保证成品图一定进库。
 */
async function localizeAndFinalizeImages(job: GenerationJobRow, deliveredImages: string[], deliveredImageDimensions: Record<string, { width: number; height: number }> | undefined, usage: unknown, providerReturnedImageCount: number, referenceImages: string[], settings: { ratio?: string; resolution?: string } | undefined, creditSource: string | undefined, requestedImageCount: number, startedAt: number, isResume: boolean) {
  const waitMs = isResume ? 8_000 : 15_000;
  const localized = await Promise.all(deliveredImages.map(async (imageUrl) => {
    if (!/^https?:\/\//i.test(imageUrl)) return { url: imageUrl as string | undefined, dimensions: deliveredImageDimensions?.[imageUrl], expired: false };
    const needsOpenRouterAuth = imageUrl.startsWith("https://openrouter.ai/api/v1/");
    let saveJob = await enqueueRemoteAssetSave({ remoteUrl: imageUrl, type: "image", authProvider: needsOpenRouterAuth ? "openrouter" : undefined, requestId: job.requestId, model: job.model ?? undefined, prompt: job.prompt ?? "", userId: job.userId });
    if (saveJob?.id && saveJob.status !== "saved") {
      const waited = await waitForMediaSaveJob(saveJob.id, waitMs);
      if (waited) saveJob = waited;
    }
    return { url: saveJob?.localUrl, dimensions: saveJob?.dimensions ?? deliveredImageDimensions?.[imageUrl], expired: saveJob?.status === "expired" };
  }));

  const allLocalized = localized.every((item) => item.url && !/^https?:\/\//i.test(item.url));
  if (!allLocalized) {
    if (localized.some((item) => item.expired)) {
      const codedError = await createCodedApiError(new Error("图片下载保存失败（远程地址已过期）。"), GENERIC_MEDIA_ERROR_MESSAGE, "image local save expired");
      await markJobFailed(job.id, codedError.error, codedError.errorCode);
      void recordGenerationEvent({ userId: job.userId, requestId: job.requestId, kind: "image", creditSource, model: job.model ?? undefined, provider: job.provider ?? undefined, status: "failed", failureReason: codedError.error, failureCode: codedError.errorCode, durationMs: Date.now() - startedAt, referenceImageCount: referenceImages.length });
      return;
    }
    // 还在下载/待重试：把已生成的交付快照存进 extraJson，重排队后跳过重新生成，只继续等本地存盘。
    const nextExtra = { ...(job.extraJson ?? {}), pendingImageLocalize: { deliveredImages, deliveredImageDimensions: deliveredImageDimensions ?? null, usage: (usage ?? null) as Prisma.InputJsonValue, providerReturnedImageCount } };
    await prisma.$executeRaw`UPDATE "GenerationJob" SET "extraJson" = ${jsonParam(nextExtra)}::jsonb, "updatedAt" = NOW() WHERE "id" = ${job.id}`;
    await scheduleJobRetry(job.id, 15_000);
    void appendGenerationDiagnosticsLog({ event: "image-job-awaiting-localize", requestId: job.requestId, conversationId: job.conversationId ?? undefined, userId: job.userId, mode: "image", model: job.model ?? undefined, prompt: job.prompt ?? undefined, settings, durationMs: Date.now() - startedAt, extra: { deliveredImages: deliveredImages.map((url, index) => summarizeGeneratedReference(url, index)), isResume } });
    return;
  }

  const finalImages = localized.map((item) => item.url as string);
  const finalImageDimensions = localized.reduce<Record<string, { width: number; height: number }>>((acc, item) => { if (item.url && item.dimensions) acc[item.url] = item.dimensions; return acc; }, {});
  const hasFinalDimensions = Object.keys(finalImageDimensions).length > 0;
  const user = job.userId ? await prisma.user.findUnique({ where: { id: job.userId }, select: { id: true } }) : null;
  const credit = user ? await chargeCredits(user.id, "image", usage as Parameters<typeof chargeCredits>[2], {
    conversationId: job.conversationId ?? undefined,
    conversationTitle: job.conversationTitle ?? undefined,
    requestId: job.requestId,
    label: "图片生成",
    model: job.model ?? undefined,
    imageCount: finalImages.length,
    metadata: mergeImageCreditMetadata(job.metadataJson as Prisma.InputJsonValue | undefined, { ...getImageCreditParameterMetadata(settings, hasFinalDimensions ? finalImageDimensions : deliveredImageDimensions), originalPrompt: job.prompt ?? "", requestedImageCount, returnedImageCount: finalImages.length, providerReturnedImageCount, billableImageCount: finalImages.length, mediaUrls: finalImages, allMediaUrls: finalImages, extraMediaUrls: [], delivered: true }),
  }) : undefined;
  const reservedNames = (job.reservedNames ?? []).slice(0, finalImages.length);
  await finalizeImageJobAsset({ ...job, reservedNames }, finalImages, hasFinalDimensions ? finalImageDimensions : undefined);
  await markJobSucceeded(job.id, { resultUrls: finalImages, reservedNames, resultDimensions: hasFinalDimensions ? finalImageDimensions : undefined, usage, credit });
  // ⭐ 工作流：直接把画布里那个节点的地址改成本地地址（不再等浏览器开着才换，也避免留下会过期的远端地址）。
  if (job.workflowId && job.workflowNodeId) {
    await applyWorkflowJobResultToCanvas({ userId: job.userId, workflowId: job.workflowId, workflowNodeId: job.workflowNodeId, kind: "image", urls: finalImages, reservedNames, dimensions: hasFinalDimensions ? finalImageDimensions : undefined });
  }
  void recordGenerationEvent({ userId: job.userId, requestId: job.requestId, kind: "image", creditSource, model: job.model ?? undefined, provider: job.provider ?? undefined, status: "success", durationMs: Date.now() - startedAt, referenceImageCount: referenceImages.length });
  void appendGenerationDiagnosticsLog({ event: "image-job-success", requestId: job.requestId, conversationId: job.conversationId ?? undefined, userId: job.userId, mode: "image", model: job.model ?? undefined, prompt: job.prompt ?? undefined, settings, durationMs: Date.now() - startedAt, extra: { requestedImageCount, returnedImageCount: finalImages.length, providerReturnedImageCount, finalImages: finalImages.map((url, index) => summarizeGeneratedReference(url, index)), dimensions: finalImageDimensions, credit, isResume } });
}

/** 执行一条图片任务：调模型 → 挑选交付 → 扣费 → 落成功/失败。可安全重复调用（扣费按 requestId 幂等）。 */
export async function runImageJob(job: GenerationJobRow) {
  const startedAt = Date.now();
  const creditSource = job.creditSource ?? undefined;
  const referenceImages = Array.isArray(job.referenceImages) ? job.referenceImages : [];
  const settings = job.settingsJson ?? undefined;
  const requestedImageCount = Math.min(4, Math.max(1, Math.floor(job.count ?? 1)));
  try {
    job = { ...job, reservedNames: await ensureJobReservedNames(job) };
    // 断线续跑：本图已生成好、正等本地存盘（跨境慢），只继续本地化+落库，跳过重新生成/attempts 上限。
    const pending = job.extraJson?.pendingImageLocalize as { deliveredImages?: unknown; deliveredImageDimensions?: Record<string, { width: number; height: number }> | null; usage?: unknown; providerReturnedImageCount?: number } | undefined;
    if (pending && Array.isArray(pending.deliveredImages) && pending.deliveredImages.length > 0) {
      const deliveredImages = pending.deliveredImages.filter((url): url is string => typeof url === "string");
      await localizeAndFinalizeImages(job, deliveredImages, pending.deliveredImageDimensions ?? undefined, pending.usage, pending.providerReturnedImageCount ?? deliveredImages.length, referenceImages, settings, creditSource, requestedImageCount, startedAt, true);
      return;
    }
    if (job.attempts > MAX_IMAGE_JOB_ATTEMPTS) {
      await markJobFailed(job.id, "生成任务多次尝试仍未完成。", "JOB_MAX_ATTEMPTS");
      return;
    }
    // 本地抠图分支（去背景 / 编辑元素透明主体层）：不走出图 provider（两家都产不了真透明），
    // 直接对源参考图跑本地抠图模型产带 alpha 的透明 PNG，再走统一本地化+落库+扣费。
    if (job.extraJson?.bgRemove) {
      const source = referenceImages[0];
      if (!source) throw new Error("去背景缺少源图片。");
      const { removeImageBackground } = await import("@/lib/background-removal");
      const sharpModule = (await import("sharp")).default;
      const pngBuffer = await removeImageBackground(source);
      const dataUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;
      const localUrl = await saveDataUrlAsset(dataUrl, "image", { userId: job.userId, keepTransparent: true });
      const meta = await sharpModule(pngBuffer).metadata();
      const dims = meta.width && meta.height ? { [localUrl]: { width: meta.width, height: meta.height } } : undefined;
      void appendGenerationDiagnosticsLog({ event: "image-job-bgremove-done", requestId: job.requestId, conversationId: job.conversationId ?? undefined, userId: job.userId, mode: "image", model: job.model ?? undefined, durationMs: Date.now() - startedAt, extra: { localUrl, width: meta.width, height: meta.height, channels: meta.channels, hasAlpha: meta.hasAlpha } });
      await localizeAndFinalizeImages(job, [localUrl], dims, undefined, 1, referenceImages, settings, creditSource, 1, startedAt, false);
      return;
    }
    const result = await generateOpenRouterImage(job.prompt ?? "", referenceImages, {
      model: job.model ?? undefined,
      bytePlusProviderKey: getBytePlusProviderKey(job.model, creditSource),
      settings,
      count: requestedImageCount,
      candidateMode: (job.extraJson?.candidateMode as "all" | "best" | undefined) ?? undefined,
      requestId: job.requestId,
      userId: job.userId,
      // 按账号的「解除限制」：异步 job 脱离 session，靠 DB 上的 job.userId 取。
      unlockLimits: await resolveUnlockLimitsForUser(job.userId),
      transparent: (job.extraJson?.transparent as boolean | undefined) ?? undefined,
    });
    const providerReturnedImageCount = result.images.length;
    const deliveredImages = pickRequestedImages(result.images, result.imageDimensions, requestedImageCount, job.model ?? undefined, settings);
    if (deliveredImages.length === 0) {
      const codedError = await createCodedApiError(new Error("图片平台没有返回图片，且没有返回可用原因。"), GENERIC_MEDIA_ERROR_MESSAGE, "image-generation empty delivery");
      await markJobFailed(job.id, codedError.error, codedError.errorCode);
      void recordGenerationEvent({ userId: job.userId, requestId: job.requestId, kind: "image", creditSource, model: job.model ?? undefined, provider: job.provider ?? undefined, status: "failed", failureReason: codedError.error, failureCode: codedError.errorCode, durationMs: Date.now() - startedAt, referenceImageCount: referenceImages.length });
      void appendGenerationDiagnosticsLog({ event: "image-job-empty-delivery", requestId: job.requestId, conversationId: job.conversationId ?? undefined, userId: job.userId, mode: "image", model: job.model ?? undefined, prompt: job.prompt ?? undefined, settings, durationMs: Date.now() - startedAt, error: codedError.error, extra: { requestedImageCount, providerReturnedImageCount } });
      return;
    }
    const deliveredImageDimensions = pickImageDimensions(result.imageDimensions, deliveredImages);
    // 统一持久化：byteplus 等异步存盘图交付时还是远程 url。先本地化再由 finalizeImageJobAsset 唯一权威落库
    // （走 buildMediaAssetRecord，参数齐全）。本地没存好就把交付快照存进 extraJson、重排队等（跨境慢也一直等），
    // 绝不用会过期的远程 url 落库、也绝不重新生成。与视频"没存好就重排队"同款思路。
    await localizeAndFinalizeImages(job, deliveredImages, deliveredImageDimensions, result.usage, providerReturnedImageCount, referenceImages, settings, creditSource, requestedImageCount, startedAt, false);
  } catch (error) {
    // 服务端断线重连：网络/网关5xx/部署重启窗口/平台临时错误等"瞬时可恢复"错误不立即毙单，
    // 退避后重排队重试（attempts 由 claim 递增、超 MAX_IMAGE_JOB_ATTEMPTS 才真失败），用户无感。
    if (isTransientServerError(error) && job.attempts < MAX_IMAGE_JOB_ATTEMPTS) {
      const delayMs = Math.min(30000, 5000 * Math.max(1, job.attempts));
      await scheduleJobRetry(job.id, delayMs);
      void appendGenerationDiagnosticsLog({ event: "image-job-transient-retry", requestId: job.requestId, conversationId: job.conversationId ?? undefined, userId: job.userId, mode: "image", model: job.model ?? undefined, prompt: job.prompt ?? undefined, settings, durationMs: Date.now() - startedAt, error, extra: { attempts: job.attempts, delayMs } });
      return;
    }
    const codedError = await createCodedApiError(error, job.extraJson?.editFunction ? editErrorFallback(error) : GENERIC_MEDIA_ERROR_MESSAGE, "image-job failed", { model: job.model ?? undefined });
    await markJobFailed(job.id, codedError.error, codedError.errorCode);
    void recordGenerationEvent({ userId: job.userId, requestId: job.requestId, kind: "image", creditSource, model: job.model ?? undefined, provider: job.provider ?? undefined, status: "failed", failureReason: codedError.error, failureCode: codedError.errorCode, durationMs: Date.now() - startedAt, referenceImageCount: referenceImages.length });
    void appendGenerationDiagnosticsLog({ event: "image-job-failed", requestId: job.requestId, conversationId: job.conversationId ?? undefined, userId: job.userId, mode: "image", model: job.model ?? undefined, prompt: job.prompt ?? undefined, settings, durationMs: Date.now() - startedAt, error, extra: { errorCode: codedError.errorCode, userError: codedError.error } });
  }
}

/**
 * 认领一批待处理的图片任务（原子 UPDATE ... RETURNING）。同时回收"卡在 running 但 lease 过期"
 * 的任务（进程崩溃/重启遗留），实现重启自愈。新近 lease 的 running 任务会被跳过，避免并发重复执行。
 */
export async function claimImageJobs(limit = 3): Promise<GenerationJobRow[]> {
  return prisma.$queryRaw<GenerationJobRow[]>`
    UPDATE "GenerationJob" SET "status" = 'running', "leaseAt" = NOW(), "attempts" = "attempts" + 1, "startedAt" = COALESCE("startedAt", NOW()), "updatedAt" = NOW()
    WHERE "id" IN (
      SELECT "id" FROM "GenerationJob"
      WHERE "kind" = 'image'
        AND "status" IN ('queued','running')
        AND ("nextRunAt" IS NULL OR "nextRunAt" <= NOW())
        AND ("leaseAt" IS NULL OR "leaseAt" <= NOW() - INTERVAL '10 minutes')
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `;
}

async function finalizeVideoJobAsset(job: GenerationJobRow, videoUrl: string, posterUrl?: string, dimensions?: { width: number; height: number; durationSeconds?: number }) {
  const isWorkflow = job.flow === "workflow" && Boolean(job.workflowId);
  const sourcePrompt = (job.extraJson?.cleanPrompt as string | undefined) || job.prompt || undefined;
  const settings = job.settingsJson ?? undefined;
  const flow = isWorkflow ? "workflow" : "conversation";
  const initialCategory = classifyAsset({ origin: "generated", flow, mediaType: "video" }).initialCategory;
  const resolved = resolvePersistableMediaAssetUrl(job.userId, videoUrl);
  if (!resolved) return;
  const name = job.reservedNames?.[0];
  if (!name) throw new Error(`Missing video name reservation for ${job.requestId}`);
  // ⭐ 参数一律以「生成出来的真实视频」为准（宽高/时长由 ffmpeg 读到），存进 ratio/resolution/videoDuration
  //   三个字符串列 —— 这样对话流卡片 / 工作流节点 / 资产库到处显示的都是真实参数，而不是用户请求时选的档。
  //   尤其 Seedance 2.5 的「视频编辑/延长」：请求档被强制成 adaptive/-1，真实输出跟随源视频，
  //   只有用真实值反推才不会显示错。读不到真实宽高/时长时才回落请求档 settings。
  const realRatio = dimensions?.width && dimensions.height ? getCommonRatioLabel(dimensions.width, dimensions.height) : undefined;
  const realResolution = getVideoResolutionFromDimensions(dimensions?.width, dimensions?.height);
  const realDuration = dimensions?.durationSeconds && dimensions.durationSeconds > 0 ? `${Math.round(dimensions.durationSeconds)}秒` : undefined;
  const storeRatio = realRatio ?? settings?.ratio;
  const storeResolution = realResolution ?? settings?.resolution;
  const storeDuration = realDuration ?? settings?.duration;
  await prisma.$transaction(async (tx) => {
    const media = await tx.mediaAsset.upsert({
      where: { userId_normalizedUrl: { userId: job.userId, normalizedUrl: resolved.normalizedUrl } },
      create: buildMediaAssetRecord({
        userId: job.userId, origin: "generated", flow, mediaType: "video",
        url: resolved.url, normalizedUrl: resolved.normalizedUrl, originalUrl: resolved.originalUrl,
        posterUrl, thumbnailUrl: posterUrl, name, sourcePrompt,
        model: job.model ?? undefined, ratio: storeRatio, resolution: storeResolution, videoDuration: storeDuration,
        generationSettings: mergeInputReferencesIntoSettings(settings, buildJobReferenceItems(job)),
        width: dimensions?.width, height: dimensions?.height, durationSeconds: dimensions?.durationSeconds,
        conversationId: job.conversationId ?? undefined, messageId: job.messageId ?? undefined,
        workflowId: job.workflowId ?? undefined, workflowNodeId: job.workflowNodeId ?? undefined,
        requestId: job.requestId,
      }),
      update: {
        posterUrl: posterUrl ?? undefined,
        thumbnailUrl: posterUrl ?? undefined,
        model: job.model ?? undefined,
        ratio: storeRatio ?? undefined,
        resolution: storeResolution ?? undefined,
        videoDuration: storeDuration ?? undefined,
        generationSettings: mergeInputReferencesIntoSettings(settings, buildJobReferenceItems(job)),
        width: dimensions?.width ?? undefined,
        height: dimensions?.height ?? undefined,
        durationSeconds: dimensions?.durationSeconds ?? undefined,
        requestId: job.requestId ?? undefined,
      },
      select: { id: true },
    });
    const existingState = await tx.userAssetState.findUnique({ where: { userId_mediaAssetId: { userId: job.userId, mediaAssetId: media.id } }, select: { id: true } });
    if (!existingState) await tx.userAssetState.create({ data: buildUserAssetStateRecord({ userId: job.userId, mediaAssetId: media.id, name, initialCategory }) });
  });
}

export async function runVideoJob(job: GenerationJobRow) {
  const providerTaskId = job.providerTaskId;
  if (!providerTaskId) return markJobFailed(job.id, "视频平台没有返回任务编号");
  try {
    job = { ...job, reservedNames: await ensureJobReservedNames(job) };
    const task = await getOpenRouterVideoTask(providerTaskId);
    // 查询通了 → 连续失败计数归零（只在非 0 时写库，避免每轮都刷一次 DB）。
    if (getPollErrorStreak(job) > 0) job = await setPollErrorStreak(job, 0);
    const videoError = getVideoErrorMessage(task);
    if (videoError) {
      const codedError = await createCodedApiError(new Error(videoError), GENERIC_MEDIA_ERROR_MESSAGE, "video job polling failed");
      // ⭐ 必须把**上游原文**落盘：以前这里一条诊断日志都没有，红字又只是映射后的用户文案
      // （大量落进兜底桶「服务器繁忙」），导致事后完全查不出根因（= A3）。
      void appendGenerationDiagnosticsLog({ event: "video-job-poll-failed", requestId: job.requestId, conversationId: job.conversationId ?? undefined, userId: job.userId, mode: "video", model: job.model ?? undefined, provider: job.provider ?? undefined, taskId: providerTaskId, prompt: job.prompt ?? undefined, settings: job.settingsJson ?? undefined, error: new Error(videoError), extra: { attempts: job.attempts, userError: codedError.error, errorCode: codedError.errorCode, upstreamRaw: JSON.stringify(task ?? {}).slice(0, 1500) } });
      void recordGenerationEvent({ userId: job.userId, requestId: job.requestId, kind: "video", creditSource: job.creditSource ?? undefined, model: job.model ?? undefined, provider: job.provider ?? undefined, status: "failed", failureReason: codedError.error, failureCode: codedError.errorCode });
      await markJobFailed(job.id, codedError.error, codedError.errorCode);
      return;
    }
    const status = getTaskStatus(task) ?? normalizeVideoStatus((task as { status?: unknown }).status) ?? "running";
    const videoUrl = getVideoUrl(task);
    if (["succeeded", "success", "completed", "complete"].includes(status) && videoUrl) {
      const needsOpenRouterAuth = videoUrl.startsWith("https://openrouter.ai/api/v1/videos/");
      // 乐观显示：平台一出结果（远程 url）就让前端先看，本地下载在后台进行、好了再换本地 url。
      // 只对"浏览器能直接播的远程地址"开放预览；OpenRouter 那种需密钥的取不到→不预览，保持等本地老行为。
      // preview 只用于展示，绝不落库；资产库仍只在本地存好后写本地 url（不受影响）。写一次即可，避免每轮刷。
      if (!needsOpenRouterAuth && !job.extraJson?.preview) {
        const nextExtra = { ...(job.extraJson ?? {}), preview: { videoUrl } };
        await prisma.$executeRaw`UPDATE "GenerationJob" SET "extraJson" = ${jsonParam(nextExtra)}::jsonb, "updatedAt" = NOW() WHERE "id" = ${job.id}`;
        job = { ...job, extraJson: nextExtra };
      }
      let saveJob = await enqueueRemoteAssetSave({ remoteUrl: videoUrl, type: "video", authProvider: needsOpenRouterAuth ? "openrouter" : undefined, videoTaskId: providerTaskId, requestId: job.requestId, model: job.model ?? undefined, prompt: job.prompt ?? "", userId: job.userId });
      // 不设总时限：只要平台给了远程 url 就一定是成功了，必须下载存到本地再落库（跨境慢也一直等）。
      // 本地没存好前，绝不用会过期的远程 url 落库；保持 running、稍后重试，直到本地 url 就绪。
      if (saveJob?.id && saveJob.status !== "saved") {
        const waited = await waitForMediaSaveJob(saveJob.id, 60_000);
        if (waited) saveJob = waited;
      }
      if (!saveJob?.localUrl) {
        if (saveJob?.status === "expired") {
          const codedError = await createCodedApiError(new Error("视频下载保存失败（远程地址已过期）。"), GENERIC_MEDIA_ERROR_MESSAGE, "video local save expired");
          void recordGenerationEvent({ userId: job.userId, requestId: job.requestId, kind: "video", creditSource: job.creditSource ?? undefined, model: job.model ?? undefined, provider: job.provider ?? undefined, status: "failed", failureReason: codedError.error, failureCode: codedError.errorCode });
          await markJobFailed(job.id, codedError.error, codedError.errorCode);
          return;
        }
        // 还在下载/待重试：媒体存盘队列会一直重试到成功（或远程过期）。保持 running，稍后再来 finalize。
        await scheduleJobRetry(job.id, 15000);
        return;
      }
      const deliveredUrl = saveJob.localUrl;
      await upsertVideoManifestEntry({ taskId: providerTaskId, prompt: job.prompt ?? "", localVideoUrl: deliveredUrl, remoteVideoUrl: videoUrl, posterUrl: saveJob.posterUrl });
      const usage = withVideoUsdFallback(getUsageMeta(task) ?? (job.usageJson as VideoUsageMeta | null) ?? undefined, {
        model: job.model,
        settings: job.settingsJson ?? undefined,
        hasVideoInput: Array.isArray(job.referenceVideos) && job.referenceVideos.length > 0,
        referenceImageCount: Array.isArray(job.referenceImages) ? job.referenceImages.filter(Boolean).length : 0,
      });
      const credit = await chargeCredits(job.userId, "video", usage, { conversationId: job.conversationId ?? undefined, conversationTitle: job.conversationTitle ?? undefined, requestId: job.requestId, label: "视频生成", model: job.model ?? undefined, videoCount: 1, metadata: { ...(job.metadataJson ?? {}), settings: job.settingsJson, ratio: job.settingsJson?.ratio, resolution: job.settingsJson?.resolution, duration: job.settingsJson?.duration, originalPrompt: job.prompt, mediaUrls: [deliveredUrl], remoteMediaUrls: [videoUrl], posterUrl: saveJob.posterUrl, delivered: true, savedLocal: true, localSaveStatus: "saved", mediaSaveJobId: saveJob.id } });
      await finalizeVideoJobAsset(job, deliveredUrl, saveJob.posterUrl, saveJob.dimensions);
      // ⭐ 2026-08-03 加：后台队列这条路**扣费成功以前一条日志都没有**，
      //   只落库 creditLedger → 查"这个模型到底扣了多少 / 上游给没给成本"必须连数据库，
      //   上一任就是因此没能验成 H3 的扣费。现在把 usd/扣分/是否用了兜底价一起留痕。
      void appendGenerationDiagnosticsLog({ event: "video-job-charged", requestId: job.requestId, conversationId: job.conversationId ?? undefined, userId: job.userId, mode: "video", model: job.model ?? undefined, provider: job.provider ?? undefined, taskId: providerTaskId, settings: job.settingsJson ?? undefined, extra: { usage, credit, usdFromFallbackPricing: Boolean((usage as { usdFromFallbackPricing?: boolean } | undefined)?.usdFromFallbackPricing) } });
      await markJobSucceeded(job.id, { resultUrls: [deliveredUrl], reservedNames: job.reservedNames ?? [], resultDimensions: saveJob.dimensions?.width && saveJob.dimensions.height ? { [deliveredUrl]: { width: saveJob.dimensions.width, height: saveJob.dimensions.height, durationSeconds: saveJob.dimensions.durationSeconds } } : undefined, posterUrl: saveJob.posterUrl, usage: withChargedUsage(usage, credit), credit });
      // ⭐ 与图片同理：工作流画布里那个节点的视频地址直接改成本地地址。
      if (job.workflowId && job.workflowNodeId) {
        await applyWorkflowJobResultToCanvas({ userId: job.userId, workflowId: job.workflowId, workflowNodeId: job.workflowNodeId, kind: "video", urls: [deliveredUrl], reservedNames: job.reservedNames ?? [], posterUrl: saveJob.posterUrl, dimensions: saveJob.dimensions?.width && saveJob.dimensions.height ? { [deliveredUrl]: { width: saveJob.dimensions.width, height: saveJob.dimensions.height, durationSeconds: saveJob.dimensions.durationSeconds } } : undefined });
      }
      void recordGenerationEvent({ userId: job.userId, requestId: job.requestId, kind: "video", creditSource: job.creditSource ?? undefined, model: job.model ?? undefined, provider: job.provider ?? undefined, status: "success" });
      return;
    }
    if (["succeeded", "success", "completed", "complete"].includes(status)) {
      const codedError = await createCodedApiError(new Error("视频平台返回已完成，但没有返回视频地址。"), GENERIC_MEDIA_ERROR_MESSAGE, "video job completed without url");
      // 同上：这条分支以前也是零日志。原始 task 结构必须留痕，否则"说完成了却没给地址"永远查不出是哪个字段没读到。
      void appendGenerationDiagnosticsLog({ event: "video-job-completed-without-url", requestId: job.requestId, conversationId: job.conversationId ?? undefined, userId: job.userId, mode: "video", model: job.model ?? undefined, provider: job.provider ?? undefined, taskId: providerTaskId, settings: job.settingsJson ?? undefined, extra: { attempts: job.attempts, status, userError: codedError.error, errorCode: codedError.errorCode, upstreamRaw: JSON.stringify(task ?? {}).slice(0, 1500) } });
      void recordGenerationEvent({ userId: job.userId, requestId: job.requestId, kind: "video", creditSource: job.creditSource ?? undefined, model: job.model ?? undefined, provider: job.provider ?? undefined, status: "failed", failureReason: codedError.error, failureCode: codedError.errorCode });
      await markJobFailed(job.id, codedError.error, codedError.errorCode);
      return;
    }
    await scheduleJobRetry(job.id, 8000);
  } catch (error) {
    // ⛔ 以前这里**只有 console.warn**（docker logs 会滚掉 → 事后查不到）+ 每 10 秒无限重试、永不放弃。
    // 现在：原文落盘 + 数「连续」失败次数，连续太多次才判失败（详见 MAX_VIDEO_POLL_ERROR_STREAK 注释）。
    const streak = getPollErrorStreak(job) + 1;
    console.warn("[generation-jobs] video poll transient", { requestId: job.requestId, streak, error: error instanceof Error ? error.message : String(error) });
    void appendGenerationDiagnosticsLog({ event: "video-job-poll-error", requestId: job.requestId, conversationId: job.conversationId ?? undefined, userId: job.userId, mode: "video", model: job.model ?? undefined, provider: job.provider ?? undefined, taskId: providerTaskId, error, extra: { attempts: job.attempts, pollErrorStreak: streak, maxStreak: MAX_VIDEO_POLL_ERROR_STREAK } });
    if (streak >= MAX_VIDEO_POLL_ERROR_STREAK) {
      const codedError = await createCodedApiError(error, GENERIC_MEDIA_ERROR_MESSAGE, "video job poll error streak exceeded");
      void appendGenerationDiagnosticsLog({ event: "video-job-poll-error-streak-exceeded", requestId: job.requestId, userId: job.userId, mode: "video", model: job.model ?? undefined, provider: job.provider ?? undefined, taskId: providerTaskId, error, extra: { attempts: job.attempts, pollErrorStreak: streak, userError: codedError.error, errorCode: codedError.errorCode } });
      void recordGenerationEvent({ userId: job.userId, requestId: job.requestId, kind: "video", creditSource: job.creditSource ?? undefined, model: job.model ?? undefined, provider: job.provider ?? undefined, status: "failed", failureReason: codedError.error, failureCode: codedError.errorCode });
      await markJobFailed(job.id, codedError.error, codedError.errorCode);
      return;
    }
    await setPollErrorStreak(job, streak).catch(() => undefined);
    await scheduleJobRetry(job.id, 10000);
  }
}

export async function claimVideoJobs(limit = 4): Promise<GenerationJobRow[]> {
  return prisma.$queryRaw<GenerationJobRow[]>`
    UPDATE "GenerationJob" SET "leaseAt" = NOW(), "attempts" = "attempts" + 1, "updatedAt" = NOW()
    WHERE "id" IN (
      SELECT "id" FROM "GenerationJob"
      WHERE "kind" = 'video'
        AND "status" = 'running'
        AND "providerTaskId" IS NOT NULL
        AND ("nextRunAt" IS NULL OR "nextRunAt" <= NOW())
        AND ("leaseAt" IS NULL OR "leaseAt" <= NOW() - INTERVAL '10 minutes')
      ORDER BY "updatedAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `;
}
