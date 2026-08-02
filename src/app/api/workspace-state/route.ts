import { existsSync } from "node:fs";
import { join } from "node:path";
import { getCurrentUser, jsonError } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCreditSettings } from "@/lib/credits";
import { migrateLegacyUserProfileFromWorkspace, stripUserProfileFromWorkspaceState } from "@/lib/user-profile";
import { compactWorkspaceState, hasJsonChanged, replaceLegacyMediaUrls } from "@/lib/workspace-state-cleanup";
import { DEFAULT_WORKSPACE_SESSION_LIMIT, getWorkspaceSessionMessages, stripSessionsFromWorkspaceState, upsertWorkspaceSessions, workspaceSessionRowToPayload } from "@/lib/workspace-sessions";
import { getWorkspaceWorkflowCanvas, getWorkspaceWorkflowPayloads, stripWorkflowsFromWorkspaceState, upsertWorkspaceWorkflows } from "@/lib/workspace-workflows";
import { resolveAssetPreviewMeta } from "@/lib/media-asset-record";
import { getRunningWorkflowIds } from "@/lib/generation-jobs";

export const runtime = "nodejs";

const UPLOAD_IMAGE_PROMPT_PLACEHOLDER = "上传图片";
const OWN_GENERATED_HOST_RE = /^https?:\/\/(101\.47\.19\.109|101\.37\.129\.164|main\.venusface\.com|api\.venusface\.com|ali\.venusface\.com|static\.venusface\.com)\/generated\//i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function metadataNumber(metadata: unknown, key: string) {
  if (!isRecord(metadata)) return undefined;
  const value = metadata[key];
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function toFiniteNumber(value: unknown) {
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  return Number.isFinite(numberValue) ? numberValue : 0;
}

async function applyLedgerUsageSummaries(userId: string, state: unknown) {
  if (!isRecord(state) || !Array.isArray(state.sessions)) return state;

  const [settings, ledgers] = await Promise.all([
    getCreditSettings(),
    prisma.creditLedger.findMany({
      where: { userId, direction: "consume", conversationId: { not: null } },
      select: { conversationId: true, credits: true, promptTokens: true, completionTokens: true, totalTokens: true, metadata: true },
    }),
  ]);

  const summaries = new Map<string, { promptTokens: number; completionTokens: number; totalTokens: number; usd: number; cny: number; credits: number }>();
  for (const item of ledgers) {
    if (!item.conversationId) continue;
    const summary = summaries.get(item.conversationId) ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0, usd: 0, cny: 0, credits: 0 };
    const chargedCny = metadataNumber(item.metadata, "chargedCny") ?? (settings.creditsPerCny > 0 ? item.credits / settings.creditsPerCny : 0);
    const chargedUsd = metadataNumber(item.metadata, "chargedUsd") ?? (settings.usdToCnyRate > 0 ? chargedCny / settings.usdToCnyRate : 0);
    summary.promptTokens += item.promptTokens;
    summary.completionTokens += item.completionTokens;
    summary.totalTokens += item.totalTokens;
    summary.usd += chargedUsd;
    summary.cny += chargedCny;
    summary.credits += item.credits;
    summaries.set(item.conversationId, summary);
  }

  return {
    ...state,
    sessions: state.sessions.map((session) => {
      if (!isRecord(session) || typeof session.id !== "string") return session;
      const ledgerSummary = summaries.get(session.id);
      const existing = isRecord(session.usageSummary) ? session.usageSummary : undefined;
      const totalTokens = ledgerSummary?.totalTokens ?? Math.max(0, Math.floor(Number(existing?.totalTokens ?? 0)));
      const promptTokens = ledgerSummary?.promptTokens ?? Math.max(0, Math.floor(Number(existing?.promptTokens ?? 0)));
      const completionTokens = ledgerSummary?.completionTokens ?? Math.max(0, Math.floor(Number(existing?.completionTokens ?? 0)));
      return {
        ...session,
        usageSummary: {
          promptTokens,
          completionTokens,
          totalTokens,
          usd: ledgerSummary?.usd ?? 0,
          cny: ledgerSummary?.cny ?? 0,
          credits: ledgerSummary?.credits ?? 0,
        },
      };
    }),
  };
}

async function applyLedgerUsageSummariesToSessions(userId: string, sessions: unknown[]) {
  const state = await applyLedgerUsageSummaries(userId, { sessions });
  return isRecord(state) && Array.isArray(state.sessions) ? state.sessions : sessions;
}

function getPositiveInteger(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(0, Math.floor(parsed)));
}

/**
 * 「工作区外壳」字段白名单 = GET 时允许回给前端的顶层小字段。
 *
 * ⛔⛔ **`feedbackLogs` 故意不在这里**（2026-07-30 性能优化，实测根因）：
 * 它是用户点「喜欢/不喜欢/回答不对」攒下的反馈日志，**只增不减**，
 * 线上实测单个用户已攒到 **727 KB**（其中 `context` 字段占 79.7%），
 * 占了那次 `?summary=1&panel=chat` 响应的 93% —— 是「打开工作台要转圈 30 秒」的三大元凶之一。
 * ⭐ 而**前端根本不读它**：`chat-workbench.tsx` 里 `feedbackLogs` 只有"从响应恢复 → 原样写回 → 追加新条目"，
 * 唯一看似在用的 `getAgentGenerationModel(..., { feedbackLogs })` 是个**死参数**（函数体没引用）。
 * 所以下行不发它，纯赚。
 * ⚠️ **不发就必须防它被写没**：PUT 时前端会带着空数组回来 → 由 `mergeFeedbackLogs()` 与库里已有的合并去重，
 * 数据一条不丢（同 `mergeWorkspaceAssets` 那套"空 payload 不许抹掉已有数据"的既有做法）。
 */
function getWorkspaceShellState(state: unknown) {
  if (!isRecord(state)) return {};
  const shell: Record<string, unknown> = {};
  (["activePanel", "activeSessionId", "assetFilter", "assetScrollTopByFilter", "workflowItems", "activeWorkflowId", "nextConversationNumber", "nextWorkflowNumber", "inputSettings", "intentMemoryRules"] as const).forEach((key) => {
    if (key in state) shell[key] = state[key];
  });
  return shell;
}

/** 与 `MAX_FEEDBACK_LOGS`（`chat-workbench.tsx`）保持一致：库里最多留这么多条反馈日志。 */
const MAX_STORED_FEEDBACK_LOGS = 300;

/**
 * 反馈日志合并：GET 不下发 `feedbackLogs`（见上），所以 PUT 上来的那份**只可能是"本次新增的"或空**。
 * 直接覆盖会把历史记录全抹掉 → 这里按 `id` 去重合并、新的在前、截到 `MAX_STORED_FEEDBACK_LOGS`。
 * ⛔ 别改成"直接用 incoming 覆盖"，否则等于删库。
 */
function mergeFeedbackLogs(existingState: unknown, incoming: unknown) {
  const existing = isRecord(existingState) && Array.isArray(existingState.feedbackLogs) ? existingState.feedbackLogs : [];
  const next = Array.isArray(incoming) ? incoming : [];
  if (next.length === 0 && existing.length === 0) return undefined;
  const seen = new Set<string>();
  const merged: unknown[] = [];
  for (const item of [...next, ...existing]) {
    const id = isRecord(item) && typeof item.id === "string" ? item.id : "";
    if (id) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    merged.push(item);
    if (merged.length >= MAX_STORED_FEEDBACK_LOGS) break;
  }
  return merged;
}

/**
 * 输出前剥掉 `feedbackLogs`（下行不发它，见 `getWorkspaceShellState` 的注释）。
 *
 * ⛔⛔ **只能在"往 Response 里塞"的那一刻剥，绝不能在 `baseState` 上剥** ——
 * `baseState` 在下面 605~613 行会被**回写数据库**（`hasJsonChanged` → `update`），
 * 在它身上剥等于**把用户的反馈日志真删了**。这是本次差点踩的坑，别改。
 */
function stripFeedbackLogsForResponse(state: unknown) {
  if (!isRecord(state)) return state;
  if (!("feedbackLogs" in state)) return state;
  const { feedbackLogs: _feedbackLogs, ...rest } = state;
  return rest;
}

type WorkspaceSessionListRow = {
  sessionId: string;
  title: string;
  updatedAt: Date;
  deletedAt: Date | null;
  summaryJson: Prisma.JsonValue | null;
  usageSummary: Prisma.JsonValue | null;
  memorySummary: Prisma.JsonValue | null;
};

async function getOrderedWorkspaceSessionRows(userId: string, offset: number, limit: number) {
  // 2026-08-02 审计 1.7：分页下沉到数据库（旧写法是把全部 session 行捞回来再 slice）。
  // ⚠️ 排序必须保持 [updatedAt desc, sessionId desc] 双键：单键 updatedAt 不唯一，skip/take 跨页会错位。
  const rows = await prisma.workspaceSession.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ updatedAt: "desc" }, { sessionId: "desc" }],
    skip: offset,
    take: limit + 1,
    select: { sessionId: true, title: true, updatedAt: true, deletedAt: true, summaryJson: true, usageSummary: true, memorySummary: true },
  });
  return rows as WorkspaceSessionListRow[];
}

function getAssetMergeKey(asset: unknown) {
  if (!isRecord(asset)) return "";
  const url = typeof asset.url === "string" ? asset.url.trim() : "";
  if (url) return `url:${url.split("?")[0].split("#")[0]}`;
  const id = typeof asset.id === "string" ? asset.id.trim() : "";
  return id ? `id:${id}` : "";
}

function dbDateToMs(value: Date | null | undefined) {
  return value ? value.getTime() : undefined;
}

function stripBytePlusReviewAttemptMarker(value: string | null | undefined) {
  return typeof value === "string" ? value.replace(/^__byteplus_review_attempts=\d+__\s*/, "") : undefined;
}

function isUploadPromptPlaceholder(value: string | null | undefined) {
  return value === UPLOAD_IMAGE_PROMPT_PLACEHOLDER || value === "资产库上传" || value === "对话流上传";
}


function categoryToLegacyType(value: unknown) {
  return typeof value === "string" && ["character_image", "scene_image", "prop_image", "shot_image", "shot_video", "other", "trash"].includes(value) ? value : "other";
}

function mediaStateToLegacyAsset(item: {
  id: string;
  sortOrder: number | null;
  currentName: string | null;
  currentCategory: string;
  previousCategory: string | null;
  deletedAt: Date | null;
  purgeAt: Date | null;
  bytePlusAssetId: string | null;
  bytePlusAssetGroupId: string | null;
  bytePlusAssetStatus: string | null;
  bytePlusAssetError: string | null;
  bytePlusAssetUpdatedAt: Date | null;
  mediaAsset: {
    id: string;
    mediaType: string;
    url: string;
    posterUrl: string | null;
    thumbnailUrl: string | null;
    sourceKind: string;
    sourcePrompt: string | null;
    promptSource: string | null;
    reversePrompt: string | null;
    previewMeta: Prisma.JsonValue | null;
    model: string | null;
    ratio: string | null;
    resolution: string | null;
    imageSize: string | null;
    videoDuration: string | null;
    durationSeconds: number | null;
    width: number | null;
    height: number | null;
    conversationId: string | null;
    messageId: string | null;
    workflowId: string | null;
    workflowNodeId: string | null;
    createdAt: Date;
    firstSeenAt: Date;
    systemName: string | null;
    initialName: string | null;
    legacyLibrarySource: string | null;
  };
}) {
  const media = item.mediaAsset;
  const type = categoryToLegacyType(item.deletedAt ? "trash" : item.currentCategory);
  const isUploadCategory = item.currentCategory === "conversation_uploads" || item.currentCategory === "workflow_uploads";
  const sourcePrompt = media.reversePrompt || media.sourcePrompt || (isUploadCategory || media.sourceKind.includes("upload") ? UPLOAD_IMAGE_PROMPT_PLACEHOLDER : "");
  const isAssetCategory = ["character_image", "scene_image", "prop_image", "shot_image"].includes(type);
  const isWorkflowCategory = item.currentCategory === "workflow_images" || item.currentCategory === "workflow_uploads" || item.currentCategory === "workflow_videos" || item.currentCategory.startsWith("workflow_upload_");
  const librarySource = isAssetCategory ? "asset_generation" : isWorkflowCategory ? "workflow" : "conversation";
  const isWorkflowTemporaryName = isWorkflowCategory && (item.currentName === "图片生成" || item.currentName === "视频生成");
  const previewMeta = resolveAssetPreviewMeta(media.previewMeta, {
    mediaType: media.mediaType,
    model: media.model,
    ratio: media.ratio,
    resolution: media.resolution,
    imageSize: media.imageSize,
    videoDuration: media.videoDuration,
    width: media.width,
    height: media.height,
    durationSeconds: media.durationSeconds,
  });
  return {
    id: item.id,
    mediaId: media.id,
    type,
    mediaType: media.mediaType,
    name: isWorkflowTemporaryName ? media.systemName || media.initialName || item.currentName || "未命名资产" : item.currentName || media.initialName || media.systemName || "未命名资产",
    systemName: media.systemName || media.initialName || undefined,
    url: media.url,
    thumbnailUrl: media.thumbnailUrl || undefined,
    posterUrl: media.posterUrl || undefined,
    // 视频/音频真实时长（秒）。资产库视频卡左上角时长角标等显示端直接用它。
    durationSeconds: typeof media.durationSeconds === "number" && media.durationSeconds > 0 ? media.durationSeconds : undefined,
    librarySource,
    model: media.model || undefined,
    sourcePrompt,
    promptSource: media.reversePrompt && !isUploadPromptPlaceholder(media.reversePrompt) ? "reverse" : isUploadCategory ? "upload" : media.promptSource || (media.sourceKind.includes("upload") ? "upload" : "generated"),
    lockedType: true,
    previewMeta,
    sessionId: media.conversationId || media.workflowId || "",
    messageId: media.messageId || undefined,
    workflowId: media.workflowId || undefined,
    workflowNodeId: media.workflowNodeId || undefined,
    previousType: item.previousCategory || undefined,
    createdAt: dbDateToMs(media.firstSeenAt) ?? dbDateToMs(media.createdAt) ?? Date.now(),
    deletedAt: dbDateToMs(item.deletedAt),
    purgeAt: dbDateToMs(item.purgeAt),
    bytePlusAssetId: item.bytePlusAssetId || undefined,
    bytePlusAssetGroupId: item.bytePlusAssetGroupId || undefined,
    bytePlusAssetStatus: item.bytePlusAssetStatus || undefined,
    bytePlusAssetError: stripBytePlusReviewAttemptMarker(item.bytePlusAssetError),
    bytePlusAssetUpdatedAt: dbDateToMs(item.bytePlusAssetUpdatedAt),
  };
}

type AssetFilterKey = "character_image" | "scene_image" | "prop_image" | "shot_image" | "shot_video" | "other" | "trash" | "conversation_images" | "conversation_uploads" | "conversation_videos" | "workflow_images" | "workflow_uploads" | "workflow_videos" | "upload_videos" | "upload_audios";

function isAssetFilterKey(value: unknown): value is AssetFilterKey {
  return typeof value === "string" && ["character_image", "scene_image", "prop_image", "shot_image", "shot_video", "other", "trash", "conversation_images", "conversation_uploads", "conversation_videos", "workflow_images", "workflow_uploads", "workflow_videos", "upload_videos", "upload_audios"].includes(value);
}

// 上传媒体的分类名（对话流 + 工作流）。文档分类刻意不放进任何可见过滤，永不显示。
// ⭐ 资产库不区分"对话流上传/工作流上传"：**只要是上传的就统一显示在「上传的资产 · 上传图片/上传视频/上传音频」**。
// 所以这三个数组是"上传类"的唯一权威名单，筛选与计数都必须走它们（工作流视频截图也算上传图片）。
const UPLOAD_IMAGE_CATEGORIES = ["conversation_uploads", "workflow_upload_images", "workflow_uploads"];
const UPLOAD_VIDEO_CATEGORIES = ["conversation_upload_videos", "workflow_upload_videos"];
const UPLOAD_AUDIO_CATEGORIES = ["conversation_upload_audios", "workflow_upload_audios"];
const UPLOAD_DOCUMENT_CATEGORIES = ["conversation_upload_documents", "workflow_upload_documents"];

function getAssetPageWhere(userId: string, filter: AssetFilterKey): Prisma.UserAssetStateWhereInput {
  const visible: Prisma.UserAssetStateWhereInput = { userId, hiddenAt: null, mediaAsset: { archivedAt: null } };
  if (filter === "trash") return { ...visible, deletedAt: { not: null }, OR: [{ purgeAt: null }, { purgeAt: { gt: new Date() } }] };
  if (["character_image", "scene_image", "prop_image", "shot_image"].includes(filter)) return { ...visible, deletedAt: null, currentCategory: filter };
  if (filter === "upload_videos") return { ...visible, deletedAt: null, currentCategory: { in: UPLOAD_VIDEO_CATEGORIES } };
  if (filter === "upload_audios") return { ...visible, deletedAt: null, currentCategory: { in: UPLOAD_AUDIO_CATEGORIES } };
  if (filter === "workflow_uploads") return { ...visible, deletedAt: null, currentCategory: "workflow_uploads" };
  if (filter === "workflow_videos") return { ...visible, deletedAt: null, currentCategory: "workflow_videos" };
  if (filter === "workflow_images") return { ...visible, deletedAt: null, currentCategory: "workflow_images" };
  // 上传图片 = 对话流上传 + 工作流上传 + 工作流视频截图 + 老数据里落在 conversation_images 但地址在 /upload_image/ 的。
  if (filter === "conversation_uploads") return { ...visible, deletedAt: null, OR: [{ currentCategory: { in: UPLOAD_IMAGE_CATEGORIES } }, { currentCategory: "conversation_images", mediaAsset: { archivedAt: null, url: { contains: "/upload_image/" } } }] };
  if (filter === "conversation_videos") return { ...visible, deletedAt: null, currentCategory: "conversation_videos" };
  if (filter === "conversation_images") return { ...visible, deletedAt: null, currentCategory: "conversation_images", NOT: { mediaAsset: { url: { contains: "/upload_image/" } } } };
  return { ...visible, deletedAt: null, currentCategory: "conversation_images", NOT: { mediaAsset: { url: { contains: "/upload_image/" } } } };
}

// Cached file-existence check.
// Persisted media files are soft-deleted only (never physically removed per product rule),
// so a positive result is stable and can be cached for a long time. A missing file is usually
// a not-yet-synced/new file, so negatives are re-checked soon. Caching removes the per-row
// synchronous disk stat that previously blocked the event loop on every asset-library request,
// and guarantees the counts pass and the page pass see identical existence results.
const mediaExistsCache = new Map<string, { exists: boolean; expires: number }>();
const MEDIA_EXISTS_POSITIVE_TTL_MS = 60 * 60 * 1000;
const MEDIA_EXISTS_NEGATIVE_TTL_MS = 15 * 1000;

function cachedFileExists(absolutePath: string) {
  const now = Date.now();
  const cached = mediaExistsCache.get(absolutePath);
  if (cached && cached.expires > now) return cached.exists;
  const exists = existsSync(absolutePath);
  mediaExistsCache.set(absolutePath, { exists, expires: now + (exists ? MEDIA_EXISTS_POSITIVE_TTL_MS : MEDIA_EXISTS_NEGATIVE_TTL_MS) });
  return exists;
}

function isVisiblePersistedMediaUrl(url: string) {
  const ownGenerated = url.match(OWN_GENERATED_HOST_RE);
  const generatedPath = ownGenerated ? url.slice(url.indexOf("/generated/")) : url;
  if (/^https?:\/\//i.test(url) && !ownGenerated) return false;
  if (generatedPath.startsWith("/generated/")) return cachedFileExists(join(process.cwd(), "public", generatedPath.replace(/^\//, "")));
  return true;
}

// Lightweight counting query: only the columns needed to classify each asset are selected.
// The heavy JSON `previewMeta` field and other display-only columns are deliberately excluded,
// and the per-row `mediaStateToLegacyAsset` object build is inlined, so counting stays cheap
// even for users with many assets. The classification result is identical to the previous
// full-object version.
async function getAssetCounts(userId: string) {
  const rows = await prisma.userAssetState.findMany({
    where: { userId, hiddenAt: null, mediaAsset: { archivedAt: null } },
    select: {
      currentCategory: true,
      deletedAt: true,
      purgeAt: true,
      mediaAsset: { select: { url: true } },
    },
  });
  const counts: Record<string, number> = { character_image: 0, scene_image: 0, prop_image: 0, shot_image: 0, trash: 0, conversation_images: 0, conversation_uploads: 0, conversation_videos: 0, workflow_images: 0, workflow_uploads: 0, workflow_videos: 0, upload_videos: 0, upload_audios: 0, asset_generation: 0, conversation: 0, workflow: 0 };
  const now = Date.now();
  for (const row of rows) {
    const url = row.mediaAsset.url;
    if (!isVisiblePersistedMediaUrl(url)) continue;
    const isDeleted = Boolean(row.deletedAt);
    const type = categoryToLegacyType(isDeleted ? "trash" : row.currentCategory);
    if (type === "trash" || isDeleted) {
      if (row.purgeAt && row.purgeAt.getTime() <= now) continue;
      counts.trash += 1;
      continue;
    }
    // 上传图片/视频/音频（对话流+工作流，含工作流视频截图）统一算「上传的资产」，不再计入工作流/对话流分组；上传文档永不显示、不计数。
    if (UPLOAD_IMAGE_CATEGORIES.includes(row.currentCategory)) {
      counts.conversation_uploads += 1;
      continue;
    }
    if (UPLOAD_VIDEO_CATEGORIES.includes(row.currentCategory)) {
      counts.upload_videos += 1;
      continue;
    }
    if (UPLOAD_AUDIO_CATEGORIES.includes(row.currentCategory)) {
      counts.upload_audios += 1;
      continue;
    }
    if (UPLOAD_DOCUMENT_CATEGORIES.includes(row.currentCategory)) continue;
    if (type === "character_image" || type === "scene_image" || type === "prop_image" || type === "shot_image") {
      counts.asset_generation += 1;
      counts[type] = (counts[type] ?? 0) + 1;
      continue;
    }
    if (row.currentCategory === "workflow_images" || row.currentCategory === "workflow_uploads" || row.currentCategory === "workflow_videos") {
      counts.workflow += 1;
      counts[row.currentCategory] = (counts[row.currentCategory] ?? 0) + 1;
      continue;
    }
    counts.conversation += 1;
    const isVideo = type === "shot_video" || /\.(mp4|webm|mov)(\?|$)/i.test(url);
    const isUpload = /\/generated\/(?:users\/[^/]+\/)?upload_image\//.test(url);
    if (row.currentCategory === "conversation_videos" || isVideo) counts.conversation_videos += 1;
    else if (row.currentCategory === "conversation_uploads" || isUpload) counts.conversation_uploads += 1;
    else counts.conversation_images += 1;
  }
  return counts;
}

const assetRowSelect = {
  id: true,
  sortOrder: true,
  currentName: true,
  currentCategory: true,
  previousCategory: true,
  deletedAt: true,
  purgeAt: true,
  bytePlusAssetId: true,
  bytePlusAssetGroupId: true,
  bytePlusAssetStatus: true,
  bytePlusAssetError: true,
  bytePlusAssetUpdatedAt: true,
  mediaAsset: {
    select: {
      id: true,
      mediaType: true,
      url: true,
      posterUrl: true,
      thumbnailUrl: true,
      sourceKind: true,
      sourcePrompt: true,
      promptSource: true,
      reversePrompt: true,
      previewMeta: true,
      model: true,
      ratio: true,
      resolution: true,
      imageSize: true,
      videoDuration: true,
      durationSeconds: true,
      width: true,
      height: true,
      conversationId: true,
      messageId: true,
      createdAt: true,
      firstSeenAt: true,
      systemName: true,
      initialName: true,
      legacyLibrarySource: true,
      workflowId: true,
      workflowNodeId: true,
    },
  },
} satisfies Prisma.UserAssetStateSelect;

type AssetRow = Prisma.UserAssetStateGetPayload<{ select: typeof assetRowSelect }>;

function getAssetSortTime(row: AssetRow) {
  // Only timestamp-like sortOrder values are treated as explicit user ordering.
  // Legacy small sortOrder values came from old arrays and must not override newest-first.
  if (typeof row.sortOrder === "number" && row.sortOrder > 1_000_000_000) return row.sortOrder * 1000;
  return row.mediaAsset.firstSeenAt.getTime() || row.mediaAsset.createdAt.getTime();
}

function sortAssetRows(rows: AssetRow[]) {
  return rows.sort((left, right) => {
    const diff = getAssetSortTime(right) - getAssetSortTime(left);
    if (diff !== 0) return diff;
    const createdDiff = right.mediaAsset.createdAt.getTime() - left.mediaAsset.createdAt.getTime();
    if (createdDiff !== 0) return createdDiff;
    return right.id.localeCompare(left.id);
  });
}

function mergeWorkspaceAssets(existingState: unknown, nextState: unknown) {
  if (!isRecord(existingState) || !isRecord(nextState)) return nextState;
  const preservedState: Record<string, unknown> = { ...nextState };
  if (Array.isArray(existingState.assetGenerateJobs) && !("assetGenerateJobs" in nextState)) preservedState.assetGenerateJobs = existingState.assetGenerateJobs;
  const nextRecord = preservedState;
  if (!Array.isArray(existingState.assets) || !Array.isArray(nextRecord.assets)) return nextRecord;
  const existingByKey = new Map(existingState.assets.map((asset) => [getAssetMergeKey(asset), asset]).filter(([key]) => Boolean(key)) as Array<[string, unknown]>);
  const nextAssets = nextRecord.assets.map((asset) => {
    const key = getAssetMergeKey(asset);
    const existingAsset = key ? existingByKey.get(key) : undefined;
    if (!isRecord(asset) || !isRecord(existingAsset)) return asset;
    const incomingType = typeof asset.type === "string" ? asset.type : "";
    const existingType = typeof existingAsset.type === "string" ? existingAsset.type : "";
    const incomingSource = typeof asset.librarySource === "string" ? asset.librarySource : "";
    const existingSource = typeof existingAsset.librarySource === "string" ? existingAsset.librarySource : "";
    const isIncomingDelete = incomingType === "trash" || toFiniteNumber(asset.deletedAt) > 0;
    const shouldPreserveClassification = !isIncomingDelete && existingSource === "asset_generation" && incomingSource !== "asset_generation";
    const shouldPreserveTypedAsset = !isIncomingDelete && ["character_image", "scene_image", "prop_image", "shot_image"].includes(existingType) && (incomingType === "other" || incomingType === "");
    return shouldPreserveClassification || shouldPreserveTypedAsset ? { ...asset, type: existingAsset.type, librarySource: existingAsset.librarySource, name: existingAsset.name, systemName: existingAsset.systemName, userName: existingAsset.userName, lockedType: existingAsset.lockedType } : asset;
  });
  if (nextAssets.length >= existingState.assets.length) return { ...nextRecord, assets: nextAssets };

  const seen = new Set(nextAssets.map(getAssetMergeKey).filter(Boolean));
  const restoredAssets = existingState.assets.filter((asset) => {
    const key = getAssetMergeKey(asset);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (restoredAssets.length === 0) return nextRecord;

  return { ...nextRecord, assets: [...nextAssets, ...restoredAssets] };
}

function stripLegacyAssetsFromWorkspaceState(state: unknown) {
  if (!isRecord(state)) return state;
  const { assets: _assets, ...rest } = state;
  return rest;
}

/** 取当前活跃工作流 id —— 只有它（以及后端还有生成任务在跑的）下发完整画布，其余只发标题。 */
function getActiveWorkflowId(state: unknown) {
  return isRecord(state) && typeof state.activeWorkflowId === "string" ? state.activeWorkflowId : "";
}

async function getWorkspaceStateWithoutLegacySessions(userId: string, state: unknown) {
  await migrateLegacyUserProfileFromWorkspace(userId, state);
  const cleanState = await applyLedgerUsageSummaries(userId, compactWorkspaceState(replaceLegacyMediaUrls(stripUserProfileFromWorkspaceState(state))));
  const stateWithoutSessions = stripSessionsFromWorkspaceState(cleanState);
  return { cleanState, state: stateWithoutSessions };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);
  const params = new URL(request.url).searchParams;
  const summaryOnly = params.get("summary") === "1";
  const historyOnly = params.get("historyOnly") === "1";
  const assetsOnly = params.get("assetsOnly") === "1";
  const panel = params.get("panel");
  const limit = getPositiveInteger(params.get("limit"), DEFAULT_WORKSPACE_SESSION_LIMIT, 50) || DEFAULT_WORKSPACE_SESSION_LIMIT;
  const offset = getPositiveInteger(params.get("offset"), 0, 100000);

  // ⭐ 按需拉取单个工作流的完整画布（"点哪个读哪个"）。列表响应里非活跃工作流**只发标题、不发画布**，
  //   前端切到它时调这里补全，见 workspace-workflows.ts 顶部注释。
  const workflowCanvasId = params.get("workflowCanvasId");
  if (workflowCanvasId) {
    const workflow = await getWorkspaceWorkflowCanvas(user.id, workflowCanvasId);
    if (!workflow) return jsonError("工作流不存在", 404);
    return Response.json({ workflow });
  }

  if (summaryOnly && historyOnly) {
    const [rows, sessionsTotalCount] = await Promise.all([
      getOrderedWorkspaceSessionRows(user.id, offset, limit),
      prisma.workspaceSession.count({ where: { userId: user.id, deletedAt: null } }),
    ]);
    const pageRows = rows.slice(0, limit);
    return Response.json({
      state: {
        sessions: pageRows.map((row) => workspaceSessionRowToPayload(row, false)),
        sessionsHasMore: rows.length > limit,
        sessionsNextOffset: offset + pageRows.length,
        sessionsTotalCount,
      },
    });
  }

  const workspace = await prisma.userWorkspaceState.findUnique({
    where: { userId: user.id },
  });

  let baseState: unknown = workspace?.state ?? null;

  if (assetsOnly) {
    // 生成中的资产任务(等待卡)也随 assetsOnly 精简响应返回，否则资产库加载会把前端 assetGenerateJobs
    // 覆盖成空 → 刷新后"生成中等待卡"消失（服务端 job 仍在跑）。与对话流/工作流的持久恢复一致。
    const storedAssetGenerateJobs = baseState && typeof baseState === "object" && Array.isArray((baseState as { assetGenerateJobs?: unknown }).assetGenerateJobs)
      ? (baseState as { assetGenerateJobs: unknown[] }).assetGenerateJobs
      : [];
    const assetFilter = isAssetFilterKey(params.get("assetFilter")) ? params.get("assetFilter") as AssetFilterKey : undefined;
    const assetLimit = getPositiveInteger(params.get("assetLimit"), 60, 120) || 60;
    const assetOffset = getPositiveInteger(params.get("assetOffset"), 0, 100000);
    const countsPromise = getAssetCounts(user.id);
    if (assetFilter) {
      const rowsPromise = prisma.userAssetState.findMany({
        where: getAssetPageWhere(user.id, assetFilter),
        orderBy: [{ mediaAsset: { firstSeenAt: "desc" } }, { mediaAsset: { createdAt: "desc" } }, { id: "desc" }],
        select: assetRowSelect,
      });
      const [assetCounts, rows] = await Promise.all([countsPromise, rowsPromise]);
      const sortedRows = sortAssetRows(rows.filter((item) => isVisiblePersistedMediaUrl(item.mediaAsset.url)));
      const pageRows = sortedRows.slice(assetOffset, assetOffset + assetLimit);
      return Response.json({
        state: {
          assets: pageRows.map(mediaStateToLegacyAsset),
          assetCounts,
          assetsHasMore: sortedRows.length > assetOffset + assetLimit,
          assetsNextOffset: assetOffset + pageRows.length,
          assetFilter,
          assetGenerateJobs: storedAssetGenerateJobs,
        },
      });
    }
    const assetRows = await prisma.userAssetState.findMany({
      where: { userId: user.id },
      orderBy: [{ mediaAsset: { firstSeenAt: "desc" } }, { mediaAsset: { createdAt: "desc" } }, { id: "desc" }],
      select: assetRowSelect,
    });
    const assetCounts = await countsPromise;
    return Response.json({
      state: {
        assets: sortAssetRows(assetRows.filter((item) => isVisiblePersistedMediaUrl(item.mediaAsset.url))).map(mediaStateToLegacyAsset),
        assetCounts,
        assetGenerateJobs: storedAssetGenerateJobs,
      },
    });
  }

  if (summaryOnly && panel === "chat") {
    const shellState = getWorkspaceShellState(baseState);
    const activeSessionId = typeof shellState.activeSessionId === "string" ? shellState.activeSessionId : "";
    // ⭐ 先拿"哪些工作流后端还在跑"（GenerationJob 表）：它决定了除活跃工作流之外还有谁要发完整画布。
    const runningWorkflowIds = await getRunningWorkflowIds(user.id);
    const [rows, sessionsTotalCount, workflowItems] = await Promise.all([
      getOrderedWorkspaceSessionRows(user.id, offset, limit + 1),
      prisma.workspaceSession.count({ where: { userId: user.id, deletedAt: null } }),
      getWorkspaceWorkflowPayloads(user.id, baseState, { activeWorkflowId: getActiveWorkflowId(shellState), runningWorkflowIds }),
    ]);
    const pageRows = rows.slice(0, limit);
    const activeRow = activeSessionId && !pageRows.some((row) => row.sessionId === activeSessionId)
      ? await prisma.workspaceSession.findFirst({
          where: { userId: user.id, sessionId: activeSessionId, deletedAt: null },
          select: { sessionId: true, title: true, updatedAt: true, deletedAt: true, summaryJson: true, usageSummary: true, memorySummary: true },
        })
      : null;
    const firstExtraRow = rows[limit];
    const activeRowWasFirstExtra = Boolean(activeRow && firstExtraRow?.sessionId === activeRow.sessionId);
    const nextActiveSessionId = (activeRow?.sessionId ?? (pageRows.some((row) => row.sessionId === activeSessionId) ? activeSessionId : "")) || (pageRows[0]?.sessionId ?? "");
    const activeMessagePage = nextActiveSessionId ? await getWorkspaceSessionMessages(user.id, nextActiveSessionId) : undefined;
    const sessionRows = activeRow ? [...pageRows, activeRow] : pageRows;
    return Response.json({
      state: {
        ...shellState,
        workflowItems,
        runningWorkflowIds,
        activeSessionId: nextActiveSessionId,
        sessions: sessionRows.map((row) => workspaceSessionRowToPayload(row, row.sessionId === nextActiveSessionId, row.sessionId === nextActiveSessionId ? activeMessagePage?.messages : undefined, row.sessionId === nextActiveSessionId ? activeMessagePage : undefined)),
        sessionsHasMore: rows.length > limit + (activeRowWasFirstExtra ? 1 : 0),
        sessionsNextOffset: offset + pageRows.length,
        sessionsTotalCount,
      },
    });
  }

  if (workspace?.state) {
    const cleaned = await getWorkspaceStateWithoutLegacySessions(user.id, workspace.state);
    baseState = stripWorkflowsFromWorkspaceState(cleaned.state);
    if (!isRecord(cleaned.cleanState) || !Array.isArray(cleaned.cleanState.sessions)) {
      if (hasJsonChanged(workspace.state, baseState)) {
        await prisma.userWorkspaceState.update({ where: { userId: user.id }, data: { state: baseState as Prisma.InputJsonValue } });
      }
    }
  }

  if (summaryOnly) {
    const activeSessionId = isRecord(baseState) && typeof baseState.activeSessionId === "string" ? baseState.activeSessionId : "";
    const runningWorkflowIds = await getRunningWorkflowIds(user.id);
    const [rows, sessionsTotalCount, workflowItems] = await Promise.all([
      getOrderedWorkspaceSessionRows(user.id, offset, limit + 1),
      prisma.workspaceSession.count({ where: { userId: user.id, deletedAt: null } }),
      getWorkspaceWorkflowPayloads(user.id, workspace?.state, { activeWorkflowId: getActiveWorkflowId(baseState), runningWorkflowIds }),
    ]);
    const pageRows = rows.slice(0, limit);
    const activeRow = activeSessionId && !pageRows.some((row) => row.sessionId === activeSessionId)
      ? await prisma.workspaceSession.findFirst({
          where: { userId: user.id, sessionId: activeSessionId, deletedAt: null },
          select: { sessionId: true, title: true, updatedAt: true, deletedAt: true, summaryJson: true, usageSummary: true, memorySummary: true },
        })
      : null;
    const firstExtraRow = rows[limit];
    const activeRowWasFirstExtra = Boolean(activeRow && firstExtraRow?.sessionId === activeRow.sessionId);
    const hasMore = rows.length > limit + (activeRowWasFirstExtra ? 1 : 0);
    const nextActiveSessionId = (activeRow?.sessionId ?? (pageRows.some((row) => row.sessionId === activeSessionId) ? activeSessionId : "")) || (pageRows[0]?.sessionId ?? "");
    const sessionRows = activeRow ? [...pageRows, activeRow] : pageRows;
    const activeMessagePage = !historyOnly && nextActiveSessionId ? await getWorkspaceSessionMessages(user.id, nextActiveSessionId) : undefined;
    const sessions = await applyLedgerUsageSummariesToSessions(
      user.id,
      sessionRows.map((row) => workspaceSessionRowToPayload(row, !historyOnly && row.sessionId === nextActiveSessionId, row.sessionId === nextActiveSessionId ? activeMessagePage?.messages : undefined, row.sessionId === nextActiveSessionId ? activeMessagePage : undefined)),
    );
    const state = {
      ...(isRecord(baseState) ? (stripFeedbackLogsForResponse(baseState) as Record<string, unknown>) : {}),
      workflowItems,
      runningWorkflowIds,
      activeSessionId: nextActiveSessionId,
      sessions,
      sessionsHasMore: hasMore,
      sessionsNextOffset: offset + pageRows.length,
      sessionsTotalCount,
    };

    return Response.json({ state });
  }

  const allRows = await prisma.workspaceSession.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: [{ updatedAt: "desc" }, { sessionId: "desc" }],
    select: { sessionId: true, title: true, updatedAt: true, deletedAt: true, messagesJson: true, summaryJson: true, usageSummary: true, memorySummary: true },
  });
  if (allRows.length > 0) {
    const sessions = await applyLedgerUsageSummariesToSessions(user.id, allRows.map((row) => workspaceSessionRowToPayload(row, true)));
    const runningWorkflowIds = await getRunningWorkflowIds(user.id);
    const workflowItems = await getWorkspaceWorkflowPayloads(user.id, workspace?.state, { activeWorkflowId: getActiveWorkflowId(baseState), runningWorkflowIds });
    return Response.json({ state: { ...(isRecord(baseState) ? (stripFeedbackLogsForResponse(baseState) as Record<string, unknown>) : {}), workflowItems, runningWorkflowIds, sessions } });
  }

  if (baseState) {
    const runningWorkflowIds = await getRunningWorkflowIds(user.id);
    return Response.json({ state: { ...(isRecord(baseState) ? (stripFeedbackLogsForResponse(baseState) as Record<string, unknown>) : {}), workflowItems: await getWorkspaceWorkflowPayloads(user.id, workspace?.state, { activeWorkflowId: getActiveWorkflowId(baseState), runningWorkflowIds }), runningWorkflowIds, sessions: [], sessionsHasMore: false, sessionsNextOffset: 0 } });
  }

  return Response.json({ state: null });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("工作区数据无效");

  await migrateLegacyUserProfileFromWorkspace(user.id, body);
  if (isRecord(body)) {
    await Promise.all([
      upsertWorkspaceSessions(user.id, body.sessions),
      upsertWorkspaceWorkflows(user.id, body.workflowItems, { activePanel: body.activePanel }),
    ]);
  }
  const cleanBody = stripLegacyAssetsFromWorkspaceState(stripWorkflowsFromWorkspaceState(stripSessionsFromWorkspaceState(compactWorkspaceState(replaceLegacyMediaUrls(stripUserProfileFromWorkspaceState(body))))));
  const existingWorkspace = await prisma.userWorkspaceState.findUnique({ where: { userId: user.id }, select: { state: true } });
  const mergedAssets = mergeWorkspaceAssets(existingWorkspace?.state, cleanBody);
  // ⭐ 反馈日志：GET 不下发它 → 前端带上来的只可能是"本次新增的"或空 → 必须与库里已有的合并，
  //    否则直接覆盖就等于删库（详见 mergeFeedbackLogs / getWorkspaceShellState 的注释）。
  const mergedFeedbackLogs = mergeFeedbackLogs(existingWorkspace?.state, isRecord(body) ? body.feedbackLogs : undefined);
  const safeBody = isRecord(mergedAssets) && mergedFeedbackLogs ? { ...mergedAssets, feedbackLogs: mergedFeedbackLogs } : mergedAssets;

  await prisma.userWorkspaceState.upsert({
    where: { userId: user.id },
    update: { state: safeBody as Prisma.InputJsonValue },
    create: { userId: user.id, state: safeBody as Prisma.InputJsonValue },
  });

  return Response.json({ ok: true });
}
