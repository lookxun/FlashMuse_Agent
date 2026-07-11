import { existsSync } from "node:fs";
import { join } from "node:path";
import { getCurrentUser, jsonError } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCreditSettings } from "@/lib/credits";
import { migrateLegacyUserProfileFromWorkspace, stripUserProfileFromWorkspaceState } from "@/lib/user-profile";
import { compactWorkspaceState, hasJsonChanged, replaceLegacyMediaUrls } from "@/lib/workspace-state-cleanup";
import { DEFAULT_WORKSPACE_SESSION_LIMIT, getWorkspaceSessionMessages, stripSessionsFromWorkspaceState, upsertWorkspaceSessions, workspaceSessionRowToPayload } from "@/lib/workspace-sessions";
import { getWorkspaceWorkflowPayloads, stripWorkflowsFromWorkspaceState, upsertWorkspaceWorkflows } from "@/lib/workspace-workflows";
import { getMediaModelDisplayName, resolveAssetPreviewMeta } from "@/lib/media-asset-record";

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

function getWorkspaceShellState(state: unknown) {
  if (!isRecord(state)) return {};
  const shell: Record<string, unknown> = {};
  (["activePanel", "activeSessionId", "assetFilter", "assetScrollTopByFilter", "workflowItems", "activeWorkflowId", "nextConversationNumber", "nextWorkflowNumber", "inputSettings", "intentMemoryRules", "feedbackLogs"] as const).forEach((key) => {
    if (key in state) shell[key] = state[key];
  });
  return shell;
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
  const rows = await prisma.workspaceSession.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ updatedAt: "desc" }, { sessionId: "desc" }],
    select: { sessionId: true, title: true, updatedAt: true, deletedAt: true, summaryJson: true, usageSummary: true, memorySummary: true },
  });
  return rows.slice(offset, offset + limit + 1) as WorkspaceSessionListRow[];
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


function getCommonRatioLabel(width: number, height: number) {
  const commonRatios: Array<[string, number]> = [["16:9", 16 / 9], ["21:9", 21 / 9], ["9:16", 9 / 16], ["4:3", 4 / 3], ["3:4", 3 / 4], ["1:1", 1]];
  const ratio = width / height;
  const match = commonRatios.find(([, value]) => Math.abs(ratio - value) / value < 0.025);
  if (match) return match[0];
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
}

function getImageResolutionFromDimensions(width: number | null | undefined, height: number | null | undefined) {
  if (!width || !height) return undefined;
  const maxSide = Math.max(width, height);
  if (maxSide >= 3500) return "4K";
  if (maxSide >= 1900) return "2K";
  return "1K";
}

function categoryToLegacyType(value: unknown) {
  return typeof value === "string" && ["character_image", "scene_image", "shot_image", "shot_video", "other", "trash"].includes(value) ? value : "other";
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
  const isAssetCategory = ["character_image", "scene_image", "shot_image"].includes(type);
  const isWorkflowCategory = item.currentCategory === "workflow_images" || item.currentCategory === "workflow_uploads" || item.currentCategory === "workflow_videos";
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
    durationSeconds: null,
  });
  return {
    id: item.id,
    mediaId: media.id,
    type,
    name: isWorkflowTemporaryName ? media.systemName || media.initialName || item.currentName || "未命名资产" : item.currentName || media.initialName || media.systemName || "未命名资产",
    systemName: media.systemName || media.initialName || undefined,
    url: media.url,
    thumbnailUrl: media.thumbnailUrl || undefined,
    posterUrl: media.posterUrl || undefined,
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

type AssetFilterKey = "character_image" | "scene_image" | "shot_image" | "shot_video" | "other" | "trash" | "conversation_images" | "conversation_uploads" | "conversation_videos" | "workflow_images" | "workflow_uploads" | "workflow_videos";

function isAssetFilterKey(value: unknown): value is AssetFilterKey {
  return typeof value === "string" && ["character_image", "scene_image", "shot_image", "shot_video", "other", "trash", "conversation_images", "conversation_uploads", "conversation_videos", "workflow_images", "workflow_uploads", "workflow_videos"].includes(value);
}

function getAssetPageWhere(userId: string, filter: AssetFilterKey): Prisma.UserAssetStateWhereInput {
  const visible: Prisma.UserAssetStateWhereInput = { userId, hiddenAt: null, mediaAsset: { archivedAt: null } };
  if (filter === "trash") return { ...visible, deletedAt: { not: null }, OR: [{ purgeAt: null }, { purgeAt: { gt: new Date() } }] };
  if (["character_image", "scene_image", "shot_image"].includes(filter)) return { ...visible, deletedAt: null, currentCategory: filter };
  if (filter === "workflow_uploads") return { ...visible, deletedAt: null, currentCategory: "workflow_uploads" };
  if (filter === "workflow_videos") return { ...visible, deletedAt: null, currentCategory: "workflow_videos" };
  if (filter === "workflow_images") return { ...visible, deletedAt: null, currentCategory: "workflow_images" };
  if (filter === "conversation_uploads") return { ...visible, deletedAt: null, OR: [{ currentCategory: "conversation_uploads" }, { mediaAsset: { archivedAt: null, url: { contains: "/upload_image/" } } }] };
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
  const counts: Record<string, number> = { character_image: 0, scene_image: 0, shot_image: 0, trash: 0, conversation_images: 0, conversation_uploads: 0, conversation_videos: 0, workflow_images: 0, workflow_uploads: 0, workflow_videos: 0, asset_generation: 0, conversation: 0, workflow: 0 };
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
    if (type === "character_image" || type === "scene_image" || type === "shot_image") {
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
    const shouldPreserveTypedAsset = !isIncomingDelete && ["character_image", "scene_image", "shot_image"].includes(existingType) && (incomingType === "other" || incomingType === "");
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
      },
    });
  }

  if (summaryOnly && panel === "chat") {
    const shellState = getWorkspaceShellState(baseState);
    const activeSessionId = typeof shellState.activeSessionId === "string" ? shellState.activeSessionId : "";
    const [rows, sessionsTotalCount, workflowItems] = await Promise.all([
      getOrderedWorkspaceSessionRows(user.id, offset, limit + 1),
      prisma.workspaceSession.count({ where: { userId: user.id, deletedAt: null } }),
      getWorkspaceWorkflowPayloads(user.id, baseState),
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
    const [rows, sessionsTotalCount, workflowItems] = await Promise.all([
      getOrderedWorkspaceSessionRows(user.id, offset, limit + 1),
      prisma.workspaceSession.count({ where: { userId: user.id, deletedAt: null } }),
      getWorkspaceWorkflowPayloads(user.id, workspace?.state),
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
      ...(isRecord(baseState) ? baseState : {}),
      workflowItems,
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
    const workflowItems = await getWorkspaceWorkflowPayloads(user.id, workspace?.state);
    return Response.json({ state: { ...(isRecord(baseState) ? baseState : {}), workflowItems, sessions } });
  }

  if (baseState) return Response.json({ state: { ...(isRecord(baseState) ? baseState : {}), workflowItems: await getWorkspaceWorkflowPayloads(user.id, workspace?.state), sessions: [], sessionsHasMore: false, sessionsNextOffset: 0 } });

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
  const safeBody = mergeWorkspaceAssets(existingWorkspace?.state, cleanBody);

  await prisma.userWorkspaceState.upsert({
    where: { userId: user.id },
    update: { state: safeBody as Prisma.InputJsonValue },
    create: { userId: user.id, state: safeBody as Prisma.InputJsonValue },
  });

  return Response.json({ ok: true });
}
