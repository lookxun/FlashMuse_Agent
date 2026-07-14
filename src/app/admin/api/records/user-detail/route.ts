import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { getCurrentAdminEmail } from "@/lib/admin-auth";
import { getCreditSettings } from "@/lib/credits";
import { bytePlusImageGenerationModels, bytePlusVideoGenerationModels, imageGenerationModels, videoGenerationModels } from "@/lib/models";
import { buildJobReferenceItems } from "@/lib/generation-jobs";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { AdminCreditCategoryDetail, AdminCreditConversationDetail, AdminCreditFlowItem, AdminCreditUser } from "../../../admin-credits-panel";
import type { AdminConversation, AdminConversationMessage, AdminMediaItem, AdminUserRow } from "../../../admin-users-panel";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown) {
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function getString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function getPromptConstraintsFromSourceDetail(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as { agentConstraints?: unknown };
    return Array.isArray(parsed.agentConstraints) ? parsed.agentConstraints.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()) : [];
  } catch {
    return [];
  }
}

function getStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function formatDate(value: Date | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(value);
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(value);
}

function formatTimestamp(value: unknown) {
  const timestamp = finiteNumber(value);
  return timestamp > 0 ? formatDate(new Date(timestamp)) : "-";
}

function normalizeMediaUrlForAdmin(value: string) {
  return value.split("?")[0].split("#")[0].replace(/^https?:\/\/[^/]+/, "");
}

function getModelLabel(type: "image" | "video", modelId: string) {
  const models = type === "image" ? [...imageGenerationModels, ...bytePlusImageGenerationModels] : [...videoGenerationModels, ...bytePlusVideoGenerationModels];
  return models.find((model) => model.id === modelId)?.label ?? modelId;
}

function getDimensionsLabel(value: unknown) {
  if (!isRecord(value)) return "-";
  const width = Math.max(0, Math.floor(finiteNumber(value.width)));
  const height = Math.max(0, Math.floor(finiteNumber(value.height)));
  return width > 0 && height > 0 ? `${width} × ${height}` : "-";
}

function formatAdminMediaName(systemName: string | undefined, userName: string | undefined, fallback: string) {
  const system = (systemName ?? "").trim();
  const user = (userName ?? "").trim();
  if (system && user && user !== system) return `${system} / ${user}`;
  return system || user || fallback;
}

function getMetadataString(metadata: unknown, key: string) {
  if (!isRecord(metadata)) return "";
  return getString(metadata[key]).trim();
}

function getMetadataBoolean(metadata: unknown, key: string) {
  return isRecord(metadata) ? metadata[key] === true : false;
}

function getMetadataNumber(metadata: unknown, key: string) {
  if (!isRecord(metadata)) return undefined;
  const value = metadata[key];
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function getLedgerMediaUrls(metadata: unknown) {
  if (!isRecord(metadata)) return [];
  return getStringArray(metadata.mediaUrls);
}

function getCreditSource(metadata: unknown) {
  if (!isRecord(metadata)) return "conversation";
  const source = metadata.creditSource;
  return typeof source === "string" ? source : "conversation";
}

function getCreditLedgerReason(kind: string, label: string | null, metadata: unknown) {
  if (kind === "signup") return "注册送积分";
  if (kind === "admin_adjust") return "后台调整赠送积分";
  const creditSource = getCreditSource(metadata);
  if (creditSource === "character_image_generation") return "资产库_角色图片";
  if (creditSource === "scene_image_generation") return "资产库_场景图片";
  if (creditSource === "shot_image_generation") return "资产库_分镜图片";
  if (creditSource === "image_prompt_reverse") return "图片反推提示词";
  if (creditSource === "prompt_optimization") return "优化提示词";
  if (creditSource === "workflow_image_generation") return "工作流图片生成";
  if (creditSource === "workflow_video_generation") return "工作流视频生成";
  if (kind === "text") return label || "对话/规划";
  if (kind === "image") return "对话流图片生成";
  if (kind === "video") return "对话流视频生成";
  return label || kind;
}

function getLedgerExpectedCredits(item: { credits: number; cny: number; metadata: unknown }, creditsPerCny: number) {
  if (getMetadataBoolean(item.metadata, "creditChargeDisabled")) return 0;
  return Math.max(0, Math.floor(getMetadataNumber(item.metadata, "expectedCredits") ?? Math.round(item.cny * creditsPerCny) ?? item.credits));
}

function buildAdminWorkspaceState(state: unknown, sessionRows: Array<{ sessionId: string; title: string; updatedAt: Date; deletedAt: Date | null; messagesJson?: unknown; summaryJson: unknown; usageSummary: unknown; memorySummary: unknown }>, messageRows: Array<{ sessionId: string; messageJson: unknown; createdAt: Date }>) {
  if (sessionRows.length === 0) return state;
  const messagesBySession = new Map<string, unknown[]>();
  for (const row of [...messageRows].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())) {
    const messages = messagesBySession.get(row.sessionId) ?? [];
    messages.push(row.messageJson);
    messagesBySession.set(row.sessionId, messages);
  }

  return {
    ...(isRecord(state) ? state : {}),
    sessions: sessionRows.map((row) => ({
      ...(isRecord(row.summaryJson) ? row.summaryJson : {}),
      id: row.sessionId,
      title: row.title,
      updatedAt: row.updatedAt.getTime(),
      deletedAt: row.deletedAt ? row.deletedAt.getTime() : undefined,
      messages: messagesBySession.get(row.sessionId) ?? (Array.isArray(row.messagesJson) ? row.messagesJson : []),
      usageSummary: row.usageSummary,
      memorySummary: row.memorySummary,
    })),
  };
}

function getDeletedAssetInfoMap(state: unknown) {
  void state;
  return new Map<string, { deletedAtLabel?: string }>();
}

function getWorkspaceAssetDisplayNameMap(state: unknown) {
  void state;
  return new Map<string, string>();
}

function getWorkspaceConversations(state: unknown): AdminConversation[] {
  if (!isRecord(state) || !Array.isArray(state.sessions)) return [];
  const assetDisplayNameMap = getWorkspaceAssetDisplayNameMap(state);
  return state.sessions.filter(isRecord).map((session, index) => {
    const id = getString(session.id, `conversation-${index}`);
    const messages = Array.isArray(session.messages) ? session.messages.filter(isRecord) : [];
    const updatedAtTs = Math.max(finiteNumber(session.updatedAt), finiteNumber(session.createdAt), ...messages.map((message) => finiteNumber(message.createdAt)));
    return {
      id,
      title: getString(session.title, "新对话") || "新对话",
      isDeleted: finiteNumber(session.deletedAt) > 0,
      deletedAtLabel: finiteNumber(session.deletedAt) > 0 ? formatTimestamp(session.deletedAt) : undefined,
      conversationCode: getString(session.conversationCode),
      updatedAtLabel: formatTimestamp(updatedAtTs),
      updatedAtTs,
      messages: messages.map((message, messageIndex): AdminConversationMessage => {
        const videos = getStringArray(message.videos);
        const videoUrl = getString(message.videoUrl);
        const images = getStringArray(message.images);
        const allVideos = videoUrl ? [...videos, videoUrl].filter((url, urlIndex, array) => array.indexOf(url) === urlIndex) : videos;
        const mediaNames = new Map<string, string>();
        images.forEach((url, mediaIndex) => mediaNames.set(url, assetDisplayNameMap.get(url) ?? assetDisplayNameMap.get(normalizeMediaUrlForAdmin(url)) ?? `图片${mediaIndex + 1}`));
        allVideos.forEach((url, mediaIndex) => mediaNames.set(url, assetDisplayNameMap.get(url) ?? assetDisplayNameMap.get(normalizeMediaUrlForAdmin(url)) ?? `视频${mediaIndex + 1}`));
        const role = message.role === "user" || message.role === "assistant" || message.role === "system" ? message.role : "assistant";
        return { id: getString(message.id, `${id}-message-${messageIndex}`), role, content: getString(message.content), createdAtLabel: formatTimestamp(message.createdAt), images, videos: allVideos, mediaNames: Object.fromEntries(mediaNames), error: getString(message.error) };
      }),
    };
  });
}

function getWorkspaceMediaItems(state: unknown): AdminMediaItem[] {
  if (!isRecord(state) || !Array.isArray(state.sessions)) return [];
  const items: AdminMediaItem[] = [];
  const deletedAssetInfoMap = getDeletedAssetInfoMap(state);
  const assetDisplayNameMap = getWorkspaceAssetDisplayNameMap(state);
  for (const session of state.sessions.filter(isRecord)) {
    const messages = Array.isArray(session.messages) ? session.messages.filter(isRecord) : [];
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      const meta = isRecord(message.generationMeta) ? message.generationMeta : undefined;
      const settings = isRecord(meta?.settings) ? meta.settings : undefined;
      const modelId = getString(meta?.model, "-");
      const ratio = getString(settings?.ratio, "-");
      const resolution = getString(settings?.resolution, "-");
      const duration = getString(settings?.duration, "-");
      const imageDimensions = isRecord(message.imageDimensions) ? message.imageDimensions : undefined;
      const videoDimensionsMap = isRecord(message.videoDimensionsMap) ? message.videoDimensionsMap : undefined;
      const mediaSystemNames = isRecord(message.mediaSystemNames) ? message.mediaSystemNames : undefined;
      const imageSlotUrls = Array.isArray(message.imageResultSlots) ? message.imageResultSlots.filter(isRecord).filter((slot) => slot.type === "image").map((slot) => getString(slot.url)).filter(Boolean) : [];
      const imageUrls = imageSlotUrls.length > 0 ? imageSlotUrls : getStringArray(message.images);
      imageUrls.forEach((url, index) => {
        const deletedInfo = deletedAssetInfoMap.get(url) ?? deletedAssetInfoMap.get(normalizeMediaUrlForAdmin(url));
        const systemName = getString(mediaSystemNames?.[url]);
        items.push({ id: `${getString(message.id, "message")}-image-${index}`, requestId: `${getString(message.requestId, getString(message.id, "message"))}:image:${index}`, type: "image", systemName, isDeleted: Boolean(deletedInfo), deletedAtLabel: deletedInfo?.deletedAtLabel, name: assetDisplayNameMap.get(url) ?? assetDisplayNameMap.get(normalizeMediaUrlForAdmin(url)) ?? formatAdminMediaName(systemName, undefined, `图片${index + 1}`), url, prompt: getMetadataString(meta, "originalPrompt") || getString(message.content), model: getModelLabel("image", modelId), ratio, resolution, duration: "-", size: getDimensionsLabel(imageDimensions?.[url]), style: getString(settings?.style, "-"), createdAtTs: finiteNumber(message.createdAt) });
      });
      const videoUrl = getString(message.videoUrl);
      const videoUrls = videoUrl ? [...getStringArray(message.videos), videoUrl].filter((url, index, array) => array.indexOf(url) === index) : getStringArray(message.videos);
      videoUrls.forEach((url, index) => {
        const deletedInfo = deletedAssetInfoMap.get(url) ?? deletedAssetInfoMap.get(normalizeMediaUrlForAdmin(url));
        const systemName = getString(mediaSystemNames?.[url]);
        items.push({ id: `${getString(message.id, "message")}-video-${index}`, requestId: `${getString(message.requestId, getString(message.id, "message"))}:video:${index}`, type: "video", systemName, isDeleted: Boolean(deletedInfo), deletedAtLabel: deletedInfo?.deletedAtLabel, name: assetDisplayNameMap.get(url) ?? assetDisplayNameMap.get(normalizeMediaUrlForAdmin(url)) ?? formatAdminMediaName(systemName, undefined, `视频${index + 1}`), url, prompt: getMetadataString(meta, "originalPrompt") || getString(message.content), model: getModelLabel("video", modelId), ratio, resolution, duration, size: getDimensionsLabel(videoDimensionsMap?.[url] ?? message.videoDimensions), style: "-", createdAtTs: finiteNumber(message.createdAt) });
      });
    }
  }
  return items;
}

function getWorkspaceAssetMediaItems(state: unknown): AdminMediaItem[] {
  void state;
  return [];
}

function isAdminVideoUrl(url: string) {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);
}

function isVideoPosterLikeMedia(url: string, name: string, mediaType: string) {
  return mediaType !== "video" && (/\/video-posters\//.test(normalizeMediaUrlForAdmin(url)) || /^video_/i.test(name));
}

const MEDIA_ASSET_CATEGORIES = new Set(["character_image", "scene_image", "shot_image"]);

// Single source of truth for which "scope" (bucket) an asset row belongs to. Precedence matches
// getFastMediaSummary (workflow before asset) so the paginated list length stays consistent with
// the counts shown on the collapsed row. Scopes are otherwise disjoint.
function getAssetScope(category: string, workspaceKind: string, sourceKind: string): "conversation" | "asset" | "workflow" | null {
  const isWorkflowGenerated = (workspaceKind === "workflow" || category.startsWith("workflow_")) && !category.includes("upload") && !sourceKind.includes("upload");
  if (isWorkflowGenerated) return "workflow";
  if (MEDIA_ASSET_CATEGORIES.has(category)) return "asset";
  if ((category === "conversation_images" || category === "conversation_uploads" || category === "conversation_videos") && workspaceKind !== "workflow") return "conversation";
  return null;
}

function getMediaAssetItems(assetStates: any[], scope: "conversation" | "asset" | "workflow"): AdminMediaItem[] {
  return assetStates.flatMap((state, index): AdminMediaItem[] => {
    const media = state?.mediaAsset;
    if (!media?.url || media.archivedAt || state.hiddenAt) return [];
    const category = getString(state.currentCategory);
    if (getAssetScope(category, getString(media.workspaceKind), getString(media.sourceKind)) !== scope) return [];
    const isAssetCategory = scope === "asset";

    const systemName = getString(media.systemName) || getString(media.initialName);
    const currentName = getString(state.currentName);
    const displayName = formatAdminMediaName(systemName, currentName && currentName !== systemName ? currentName : undefined, "媒体");
    if (scope === "conversation" && isVideoPosterLikeMedia(media.url, displayName, getString(media.mediaType))) return [];
    if (scope === "workflow" && isVideoPosterLikeMedia(media.url, displayName, getString(media.mediaType))) return [];

    const type = media.mediaType === "video" || isAdminVideoUrl(media.url) ? "video" : "image";
    const isUploadedAsset = category === "conversation_uploads" || getString(media.sourceKind).includes("upload");
    const prompt = getString(media.reversePrompt) || getString(media.sourcePrompt);
    const promptConstraints = getPromptConstraintsFromSourceDetail(media.sourceDetail);
    const size = media.width && media.height ? `${media.width} × ${media.height}` : getString(media.imageSize, "-");
    const deletedAt = state.deletedAt instanceof Date ? state.deletedAt : null;
    return [{
      id: getString(media.id, `media-asset-${index}`),
      requestId: getString(media.requestId),
      conversationId: getString(media.conversationId),
      messageId: getString(media.messageId),
      workflowId: getString(media.workflowId),
      workflowNodeId: getString(media.workflowNodeId),
      type,
      assetType: isAssetCategory ? category as "character_image" | "scene_image" | "shot_image" : undefined,
      isDeleted: Boolean(deletedAt),
      deletedAtLabel: deletedAt ? formatDate(deletedAt) : undefined,
      isUploadedAsset,
      isReversePrompt: isUploadedAsset && Boolean(prompt.trim()) && !isUploadPromptPlaceholder(prompt),
      systemName,
      userName: currentName && currentName !== systemName ? currentName : undefined,
      name: displayName === "媒体" ? type === "video" ? `视频${index + 1}` : `图片${index + 1}` : displayName,
      url: media.url,
      prompt: isUploadPromptPlaceholder(prompt) ? "" : prompt,
      promptConstraints,
      model: getString(media.model) ? getModelLabel(type, getString(media.model)) : "-",
      ratio: getString(media.ratio, "-"),
      resolution: getString(media.resolution, "-"),
      duration: type === "video" ? getString(media.videoDuration, "-") : "-",
      size,
      style: "-",
      createdAtTs: media.firstSeenAt instanceof Date ? media.firstSeenAt.getTime() : media.createdAt instanceof Date ? media.createdAt.getTime() : 0,
    }];
  });
}

// 给生成媒体挂上该次生成实际用到的参考素材（上传/连线的图片/视频/音频 + 名字），
// 数据来自权威 GenerationJob。按三条口径依次匹配，兼容历史 MediaAsset.requestId 缺失/不一致：
//   ① 精确 requestId ② 工作流节点(workflowNodeId) ③ 对话流会话消息(messageId + kind)。
async function attachGenerationReferences(userId: string, items: AdminMediaItem[]) {
  const requestIds = new Set<string>();
  const nodeIds = new Set<string>();
  const messageIds = new Set<string>();
  const conversationIds = new Set<string>();
  for (const item of items) {
    if (item.requestId) requestIds.add(item.requestId);
    if (item.workflowNodeId) nodeIds.add(item.workflowNodeId);
    if (item.messageId) messageIds.add(item.messageId);
    if (item.conversationId) conversationIds.add(item.conversationId);
  }
  if (requestIds.size === 0 && nodeIds.size === 0 && messageIds.size === 0 && conversationIds.size === 0) return;

  const conditions: Prisma.Sql[] = [];
  if (requestIds.size) conditions.push(Prisma.sql`"requestId" IN (${Prisma.join([...requestIds])})`);
  if (nodeIds.size) conditions.push(Prisma.sql`"workflowNodeId" IN (${Prisma.join([...nodeIds])})`);
  if (messageIds.size) conditions.push(Prisma.sql`"messageId" IN (${Prisma.join([...messageIds])})`);
  if (conversationIds.size) conditions.push(Prisma.sql`"conversationId" IN (${Prisma.join([...conversationIds])})`);

  const jobs = await prisma.$queryRaw<Array<{ requestId: string; kind: string; workflowNodeId: string | null; messageId: string | null; referenceImages: unknown; referenceVideos: unknown; referenceAudios: unknown; referenceNames: unknown }>>`
    SELECT "requestId", "kind", "workflowNodeId", "messageId", "referenceImages", "referenceVideos", "referenceAudios", "referenceNames"
    FROM "GenerationJob"
    WHERE "userId" = ${userId} AND (${Prisma.join(conditions, " OR ")})
    ORDER BY "createdAt" DESC
  `;

  type Ref = { url: string; name?: string; kind: "image" | "video" | "audio" };
  // jobs 已按 createdAt DESC；每个键只保留最新一条有参考素材的 job。参考素材拍平用统一实现 buildJobReferenceItems。
  const byRequest = new Map<string, Ref[]>();
  const byBareRequest = new Map<string, Ref[]>(); // 对话流 job requestId = `<消息ID>:video|image:N`，剥掉后缀匹配裸 requestId 的老资产
  const byNode = new Map<string, Ref[]>();
  const byMessageKind = new Map<string, Ref[]>();
  for (const job of jobs) {
    const refs = buildJobReferenceItems(job);
    if (refs.length === 0) continue;
    if (job.requestId && !byRequest.has(job.requestId)) byRequest.set(job.requestId, refs);
    const bare = job.requestId?.match(/^(.+):(?:video|image):\d+$/)?.[1];
    if (bare && !byBareRequest.has(bare)) byBareRequest.set(bare, refs);
    if (job.workflowNodeId && !byNode.has(job.workflowNodeId)) byNode.set(job.workflowNodeId, refs);
    if (job.messageId) {
      const key = `${job.messageId}:${job.kind}`;
      if (!byMessageKind.has(key)) byMessageKind.set(key, refs);
    }
  }

  for (const item of items) {
    const references =
      (item.requestId ? byRequest.get(item.requestId) : undefined) ??
      (item.requestId ? byBareRequest.get(item.requestId) : undefined) ??
      (item.workflowNodeId ? byNode.get(item.workflowNodeId) : undefined) ??
      (item.messageId ? byMessageKind.get(`${item.messageId}:${item.type}`) : undefined);
    if (references && references.length > 0) item.references = references;
  }
}

function makeMediaFlowItem(item: AdminMediaItem, index: number, creditLookup: Map<string, AdminCreditFlowItem>): AdminCreditFlowItem {
  const creditItem = (item.requestId ? creditLookup.get(item.requestId) : undefined) ?? creditLookup.get(item.url) ?? creditLookup.get(normalizeMediaUrlForAdmin(item.url));
  return { id: item.id || `${item.url}-${index}`, requestId: item.requestId || item.id || `${item.url}-${index}`, kind: item.type, systemName: item.systemName || item.name || "", displayName: item.name || item.systemName || (item.type === "video" ? `视频${index + 1}` : `图片${index + 1}`), url: item.url, status: "success", errorText: item.isDeleted ? "用户已删除" : undefined, deletedAtLabel: item.deletedAtLabel, credits: creditItem?.credits ?? 0, expectedCredits: creditItem?.expectedCredits, totalTokens: creditItem?.totalTokens ?? 0, usd: creditItem?.usd ?? 0, cny: creditItem?.cny ?? 0, count: 1, model: creditItem?.model ?? item.model, parameters: [item.model, item.ratio, [item.size, item.resolution].filter((value) => value && value !== "-").join(" "), item.type === "video" ? item.duration : ""].filter((value) => value && value !== "-").join(" | "), isCreditMissing: !creditItem, isCostUnavailable: Boolean(creditItem && !creditItem.isChargeDisabled && creditItem.status !== "failed" && creditItem.credits === 0 && creditItem.usd === 0 && creditItem.cny === 0), isReversePrompt: item.isReversePrompt, promptText: item.prompt, promptConstraints: item.promptConstraints, createdAtLabel: item.createdAtTs ? formatShortDate(new Date(item.createdAtTs)) : "-", createdAtTs: item.createdAtTs ?? 0 };
}

function addCategoryItem(map: Map<string, AdminCreditCategoryDetail>, id: string, title: string, item: AdminCreditFlowItem) {
  const detail = map.get(id) ?? { id, title, totalCredits: 0, totalUsd: 0, totalCny: 0, items: [] };
  detail.totalCredits += item.credits;
  detail.totalUsd += item.usd;
  detail.totalCny += item.cny;
  detail.items.push(item);
  map.set(id, detail);
}

function getAssetCategory(source: string) {
  if (source === "character_image_generation") return { id: "character", title: "角色" };
  if (source === "scene_image_generation") return { id: "scene", title: "场景" };
  return { id: "shot", title: "分镜" };
}

function getAssetUploadCategory(assetType: string | undefined) {
  if (assetType === "character_image") return { id: "character", title: "角色" };
  if (assetType === "scene_image") return { id: "scene", title: "场景" };
  if (assetType === "shot_image") return { id: "shot", title: "分镜" };
  return undefined;
}

function getPromptToolCategory(source: string) {
  return source === "image_prompt_reverse" ? { id: "reverse", title: "反推提示词" } : { id: "optimization", title: "优化提示词" };
}

function isUploadPromptPlaceholder(value: string) {
  return value === "上传图片" || value === "资产库上传" || value === "对话流上传";
}

const UPLOAD_IMAGE_CATEGORIES = new Set(["conversation_uploads", "workflow_upload_images", "workflow_uploads"]);
const UPLOAD_VIDEO_CATEGORIES = new Set(["conversation_upload_videos", "workflow_upload_videos"]);
const UPLOAD_AUDIO_CATEGORIES = new Set(["conversation_upload_audios", "workflow_upload_audios"]);
const UPLOAD_DOCUMENT_CATEGORIES = new Set(["conversation_upload_documents", "conversation_upload_files", "workflow_upload_documents"]);
const ASSET_UPLOAD_IMAGE_CATEGORIES = new Set(["character_image", "scene_image", "shot_image"]);

function classifyUploadKind(state: any): "image" | "video" | "audio" | "document" | null {
  const media = state?.mediaAsset;
  if (!media) return null;
  const category = getString(state.currentCategory);
  const mediaType = getString(media.mediaType);
  if (UPLOAD_VIDEO_CATEGORIES.has(category)) return "video";
  if (UPLOAD_AUDIO_CATEGORIES.has(category)) return "audio";
  if (UPLOAD_DOCUMENT_CATEGORIES.has(category)) return "document";
  if (UPLOAD_IMAGE_CATEGORIES.has(category)) return "image";
  // uploaded assets in the asset library (character/scene/shot) that came from an upload
  if (ASSET_UPLOAD_IMAGE_CATEGORIES.has(category) && getString(media.sourceKind).includes("upload")) return "image";
  return null;
}

function buildUploadRecords(assetStates: any[]): Array<{ id: string; kind: "image" | "video" | "audio" | "document"; name: string; url: string; model?: string; size?: string; isDeleted?: boolean; deletedAtLabel?: string; createdAtLabel?: string; createdAtTs?: number }> {
  const records: Array<{ id: string; kind: "image" | "video" | "audio" | "document"; name: string; url: string; model?: string; size?: string; isDeleted?: boolean; deletedAtLabel?: string; createdAtLabel?: string; createdAtTs?: number }> = [];
  const seen = new Set<string>();
  for (const state of assetStates) {
    const media = state?.mediaAsset;
    if (!media?.url && !getString(media?.originalFileName)) continue;
    if (media?.archivedAt || state.hiddenAt) continue;
    const kind = classifyUploadKind(state);
    if (!kind) continue;
    const url = getString(media.url);
    const dedupKey = url ? `url:${normalizeMediaUrlForAdmin(url)}` : `name:${kind}:${getString(media.originalFileName) || getString(media.systemName) || media.id}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    const systemName = getString(media.systemName) || getString(media.initialName) || getString(media.originalFileName);
    const currentName = getString(state.currentName);
    const name = formatAdminMediaName(systemName, currentName && currentName !== systemName ? currentName : undefined, kind === "image" ? "上传图片" : kind === "video" ? "上传视频" : kind === "audio" ? "上传音频" : "上传文档");
    const deletedAt = state.deletedAt instanceof Date ? state.deletedAt : null;
    const createdAtTs = media.firstSeenAt instanceof Date ? media.firstSeenAt.getTime() : media.createdAt instanceof Date ? media.createdAt.getTime() : 0;
    records.push({
      id: getString(media.id, dedupKey),
      kind,
      name: name === "媒体" ? (kind === "image" ? "上传图片" : kind === "video" ? "上传视频" : kind === "audio" ? "上传音频" : "上传文档") : name,
      url,
      model: getString(media.mimeType, "-"),
      size: media.width && media.height ? `${media.width} × ${media.height}` : getString(media.imageSize, "-"),
      isDeleted: Boolean(deletedAt),
      deletedAtLabel: deletedAt ? formatDate(deletedAt) : undefined,
      createdAtLabel: createdAtTs ? formatShortDate(new Date(createdAtTs)) : "-",
      createdAtTs,
    });
  }
  return records.sort((left, right) => (right.createdAtTs ?? 0) - (left.createdAtTs ?? 0));
}

function getFastMediaSummary(assetStates: any[]) {
  const summary = { conversationImageCount: 0, conversationVideoCount: 0, conversationUploadImageCount: 0, assetImageCount: 0, assetGeneratedImageCount: 0, assetUploadImageCount: 0, workflowImageCount: 0, workflowVideoCount: 0, uploadImageCount: 0, uploadVideoCount: 0, uploadAudioCount: 0, uploadDocumentCount: 0 };
  const assetCategories = new Set(["character_image", "scene_image", "shot_image"]);
  for (const state of assetStates) {
    const media = state?.mediaAsset;
    if (!media?.url || media.archivedAt || state.hiddenAt) continue;
    const category = getString(state.currentCategory);
    const mediaType = media.mediaType === "video" || isAdminVideoUrl(media.url) ? "video" : "image";
    const isUpload = category === "conversation_uploads" || getString(media.sourceKind).includes("upload");
    const systemName = getString(media.systemName) || getString(media.initialName);
    const currentName = getString(state.currentName);
    const displayName = formatAdminMediaName(systemName, currentName && currentName !== systemName ? currentName : undefined, "媒体");
    if (isVideoPosterLikeMedia(media.url, displayName, getString(media.mediaType))) continue;

    const uploadKind = classifyUploadKind(state);
    if (uploadKind === "image") summary.uploadImageCount += 1;
    else if (uploadKind === "video") summary.uploadVideoCount += 1;
    else if (uploadKind === "audio") summary.uploadAudioCount += 1;
    else if (uploadKind === "document") summary.uploadDocumentCount += 1;

    const isWorkflowGenerated = (getString(media.workspaceKind) === "workflow" || category.startsWith("workflow_")) && !uploadKind && !category.includes("upload");
    if (isWorkflowGenerated) {
      if (mediaType === "video") summary.workflowVideoCount += 1;
      else summary.workflowImageCount += 1;
      continue;
    }
    if (assetCategories.has(category)) {
      if (mediaType === "image") {
        summary.assetImageCount += 1;
        if (isUpload) summary.assetUploadImageCount += 1;
        else summary.assetGeneratedImageCount += 1;
      }
    } else if (category === "conversation_videos" || mediaType === "video") {
      summary.conversationVideoCount += 1;
    } else if (isUpload) {
      summary.conversationUploadImageCount += 1;
    } else if (category === "conversation_images") {
      summary.conversationImageCount += 1;
    }
  }
  return summary;
}

function getFastCreditSummary(ledgers: any[], creditsPerCny: number) {
  const summary = { giftedCredits: 0, signupGiftedCredits: 0, adminAdjustedGiftedCredits: 0, consumedCredits: 0, consumedTokens: 0, consumedUsd: 0, consumedCny: 0, conversationConsumedCredits: 0, assetGenerationConsumedCredits: 0, promptToolConsumedCredits: 0, workflowConsumedCredits: 0 };
  for (const item of ledgers) {
    if (item.direction === "increase") {
      summary.giftedCredits += item.credits;
      if (item.kind === "signup") summary.signupGiftedCredits += item.credits;
      if (item.kind === "admin_adjust") summary.adminAdjustedGiftedCredits += item.credits;
      continue;
    }
    summary.consumedCredits += item.credits;
    summary.consumedTokens += item.totalTokens;
    summary.consumedUsd += item.usd;
    summary.consumedCny += item.cny;
    const source = getCreditSource(item.metadata);
    if (source === "character_image_generation" || source === "scene_image_generation" || source === "shot_image_generation") summary.assetGenerationConsumedCredits += item.credits;
    else if (source === "image_prompt_reverse" || source === "prompt_optimization") summary.promptToolConsumedCredits += item.credits;
    else if (source.startsWith("workflow_")) summary.workflowConsumedCredits += item.credits;
    else summary.conversationConsumedCredits += item.credits;
  }
  return summary;
}

// Records-mode only needs the columns used by getFastMediaSummary. Using an explicit `select`
// (instead of `include: { mediaAsset: true }`) avoids fetching the heavy JSON columns
// (mediaAsset.previewMeta / generationSettings and UserAssetState.legacyAssetJson) for every row,
// which is the main reason expanding a big-table row was slow.
const RECORDS_ASSET_STATE_SELECT = {
  currentCategory: true,
  hiddenAt: true,
  currentName: true,
  mediaAsset: { select: { url: true, archivedAt: true, mediaType: true, sourceKind: true, systemName: true, initialName: true, workspaceKind: true } },
} as const;

// Media/full modes render full media lists, so they need more columns — but still exclude the
// heavy unused JSON columns (previewMeta / generationSettings / legacyAssetJson).
const DETAIL_ASSET_STATE_SELECT = {
  currentCategory: true,
  hiddenAt: true,
  currentName: true,
  deletedAt: true,
  mediaAsset: { select: { id: true, url: true, archivedAt: true, mediaType: true, sourceKind: true, workspaceKind: true, systemName: true, initialName: true, originalFileName: true, mimeType: true, reversePrompt: true, sourcePrompt: true, sourceDetail: true, model: true, ratio: true, resolution: true, videoDuration: true, width: true, height: true, imageSize: true, requestId: true, conversationId: true, messageId: true, workflowId: true, workflowNodeId: true, firstSeenAt: true, createdAt: true } },
} as const;

// Light select for the paginated media dialog: only the columns needed to classify a row and sort
// it. Deliberately excludes every heavy column (sourceDetail / reversePrompt / sourcePrompt /
// previewMeta / legacyAssetJson) so classifying ALL of a user's rows stays cheap; the heavy detail
// columns are then fetched only for the ~10 rows on the requested page.
const LIGHT_SCOPE_SELECT = {
  id: true,
  currentCategory: true,
  currentName: true,
  mediaAsset: { select: { url: true, mediaType: true, sourceKind: true, workspaceKind: true, systemName: true, initialName: true, firstSeenAt: true, createdAt: true } },
} as const;

type LightClassifiedRow = { id: string; scope: "conversation" | "asset" | "workflow"; type: "image" | "video"; category: string; isUploadedAsset: boolean; createdAtTs: number };

// Light select for the uploads-only dialog: just the columns buildUploadRecords / classifyUploadKind
// read, so we never fetch the heavy prompt / sourceDetail / JSON columns for upload lists.
const UPLOAD_RECORD_SELECT = {
  currentCategory: true,
  currentName: true,
  hiddenAt: true,
  deletedAt: true,
  mediaAsset: { select: { id: true, url: true, originalFileName: true, archivedAt: true, systemName: true, initialName: true, mediaType: true, sourceKind: true, mimeType: true, width: true, height: true, imageSize: true, firstSeenAt: true, createdAt: true } },
} as const;

function classifyLightRow(state: any): LightClassifiedRow | null {
  const media = state?.mediaAsset;
  if (!media?.url) return null;
  const category = getString(state.currentCategory);
  const sourceKind = getString(media.sourceKind);
  const workspaceKind = getString(media.workspaceKind);
  const scope = getAssetScope(category, workspaceKind, sourceKind);
  if (!scope) return null;
  const type = media.mediaType === "video" || isAdminVideoUrl(media.url) ? "video" : "image";
  const systemName = getString(media.systemName) || getString(media.initialName);
  const currentName = getString(state.currentName);
  const displayName = formatAdminMediaName(systemName, currentName && currentName !== systemName ? currentName : undefined, "媒体");
  if ((scope === "conversation" || scope === "workflow") && isVideoPosterLikeMedia(media.url, displayName, getString(media.mediaType))) return null;
  const isUploadedAsset = category === "conversation_uploads" || sourceKind.includes("upload");
  const createdAtTs = media.firstSeenAt instanceof Date ? media.firstSeenAt.getTime() : media.createdAt instanceof Date ? media.createdAt.getTime() : 0;
  return { id: getString(state.id), scope, type, category, isUploadedAsset, createdAtTs };
}

function matchesMediaType(row: LightClassifiedRow, mediaType: string, assetType: string): boolean {
  switch (mediaType) {
    case "image": return row.scope === "conversation" && row.type === "image" && !row.isUploadedAsset;
    case "video": return row.scope === "conversation" && row.type === "video" && !row.isUploadedAsset;
    case "upload_image": return row.scope === "conversation" && row.type === "image" && row.isUploadedAsset;
    case "workflow_image": return row.scope === "workflow" && row.type === "image";
    case "workflow_video": return row.scope === "workflow" && row.type === "video";
    case "asset_image": return row.scope === "asset" && row.type === "image" && row.category === assetType;
    case "all_image": return row.type === "image" && !row.isUploadedAsset;
    case "all_video": return row.type === "video" && !row.isUploadedAsset && (row.scope === "conversation" || row.scope === "workflow");
    default: return false;
  }
}

export async function GET(request: Request) {
  const email = await getCurrentAdminEmail();
  if (!email || !isAdminEmail(email)) return NextResponse.json({ error: "无权限" }, { status: 403 });

  const searchParams = new URL(request.url).searchParams;
  const userId = searchParams.get("userId")?.trim() ?? "";
  const mode = searchParams.get("mode");
  const isRecordsMode = mode === "records";
  const isMediaMode = mode === "media";
  const isCreditsMode = mode === "credits";
  if (!userId) return NextResponse.json({ error: "缺少用户ID" }, { status: 400 });

  // Lightweight credits-only mode for the credits panel row expand: only reads the credit ledger
  // (no workspace state, messages, or asset states), computes the credit breakdown, and returns.
  if (isCreditsMode) {
    const [creditUserRow, creditSettings, ledgers] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, nickname: true, avatarUrl: true, credits: true } }),
      getCreditSettings(),
      prisma.creditLedger.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: { direction: true, kind: true, credits: true, totalTokens: true, usd: true, cny: true, metadata: true, createdAt: true } }),
    ]);
    if (!creditUserRow) return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    const creditSummary = getFastCreditSummary(ledgers, creditSettings.creditsPerCny);
    const creditUser: AdminCreditUser = {
      id: creditUserRow.id,
      userEmail: creditUserRow.email,
      nickname: creditUserRow.nickname,
      avatarUrl: creditUserRow.avatarUrl,
      currentCredits: creditUserRow.credits,
      giftedCredits: creditSummary.giftedCredits,
      signupGiftedCredits: creditSummary.signupGiftedCredits,
      adminAdjustedGiftedCredits: creditSummary.adminAdjustedGiftedCredits,
      consumedCredits: creditSummary.consumedCredits,
      consumedTokens: creditSummary.consumedTokens,
      consumedUsd: creditSummary.consumedUsd,
      consumedCny: creditSummary.consumedCny,
      conversationConsumedCredits: creditSummary.conversationConsumedCredits,
      assetGenerationConsumedCredits: creditSummary.assetGenerationConsumedCredits,
      promptToolConsumedCredits: creditSummary.promptToolConsumedCredits,
      workflowConsumedCredits: creditSummary.workflowConsumedCredits,
      conversationCreditDetails: [],
      assetGenerationCreditDetails: [],
      promptToolCreditDetails: [],
      workflowCreditDetails: [],
      currentCreditDetails: [],
      lastActiveLabel: ledgers[0] ? formatShortDate(ledgers[0].createdAt) : "-",
    };
    return NextResponse.json({ detail: { creditUser } });
  }

  // Paginated per-category media list for the admin media dialog. Loads ONLY the requested
  // category, and only ~limit rows of heavy detail per request, streamed as the user scrolls.
  if (mode === "media-page") {
    const mediaType = searchParams.get("mediaType") ?? "";
    const assetType = searchParams.get("assetType") ?? "character_image";
    const offset = Math.max(0, Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0);
    const limit = Math.min(60, Math.max(1, Number.parseInt(searchParams.get("limit") ?? "12", 10) || 12));

    const lightStates = await prisma.userAssetState.findMany({
      where: { userId, hiddenAt: null, mediaAsset: { archivedAt: null } },
      select: LIGHT_SCOPE_SELECT,
    });
    const matches = lightStates
      .map(classifyLightRow)
      .filter((row): row is LightClassifiedRow => row !== null && matchesMediaType(row, mediaType, assetType))
      .sort((left, right) => right.createdAtTs - left.createdAtTs);
    const total = matches.length;
    const pageIds = matches.slice(offset, offset + limit).map((row) => row.id);

    if (pageIds.length === 0) return NextResponse.json({ detail: { items: [], total } });

    const pageStates = await prisma.userAssetState.findMany({ where: { id: { in: pageIds } }, select: DETAIL_ASSET_STATE_SELECT });
    const built = [
      ...getMediaAssetItems(pageStates, "conversation"),
      ...getMediaAssetItems(pageStates, "asset"),
      ...getMediaAssetItems(pageStates, "workflow"),
    ].sort((left, right) => (right.createdAtTs ?? 0) - (left.createdAtTs ?? 0));
    await attachGenerationReferences(userId, built);
    return NextResponse.json({ detail: { items: built, total } });
  }

  // Uploads-only mode for the "上传记录" dialog: reads a light asset-state select and builds ONLY
  // upload records (no generated-media arrays, no workspace messages / ledger).
  if (mode === "uploads") {
    const [userRow, assetStates] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, nickname: true, avatarUrl: true } }),
      prisma.userAssetState.findMany({ where: { userId, hiddenAt: null, mediaAsset: { archivedAt: null } }, select: UPLOAD_RECORD_SELECT }),
    ]);
    if (!userRow) return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    const uploadRecords = buildUploadRecords(assetStates);
    const detailUser = {
      uploadRecords,
      uploadImageCount: uploadRecords.filter((item) => item.kind === "image").length,
      uploadVideoCount: uploadRecords.filter((item) => item.kind === "video").length,
      uploadAudioCount: uploadRecords.filter((item) => item.kind === "audio").length,
      uploadDocumentCount: uploadRecords.filter((item) => item.kind === "document").length,
    } as unknown as AdminUserRow;
    const creditUser = {
      id: userRow.id,
      userEmail: userRow.email,
      nickname: userRow.nickname,
      avatarUrl: userRow.avatarUrl,
      currentCredits: 0,
      giftedCredits: 0,
      signupGiftedCredits: 0,
      adminAdjustedGiftedCredits: 0,
      consumedCredits: 0,
      consumedTokens: 0,
      consumedUsd: 0,
      consumedCny: 0,
      conversationConsumedCredits: 0,
      assetGenerationConsumedCredits: 0,
      promptToolConsumedCredits: 0,
      workflowConsumedCredits: 0,
      conversationCreditDetails: [],
      assetGenerationCreditDetails: [],
      promptToolCreditDetails: [],
      workflowCreditDetails: [],
      currentCreditDetails: [],
      lastActiveLabel: "-",
    } as AdminCreditUser;
    return NextResponse.json({ detail: { user: detailUser, creditUser } });
  }

  const userQuery = isMediaMode
    ? prisma.user.findUnique({
      where: { id: userId },
      include: {
        userAssetStates: { where: { hiddenAt: null, mediaAsset: { archivedAt: null } }, select: DETAIL_ASSET_STATE_SELECT, orderBy: { updatedAt: "desc" } },
        sessions: { orderBy: { lastSeenAt: "desc" }, take: 1, select: { lastSeenAt: true } },
        _count: { select: { sessions: true, workspaceWorkflows: { where: { deletedAt: null } } } },
      },
    })
    : isRecordsMode
    ? prisma.user.findUnique({
      where: { id: userId },
      include: {
        workspace: { select: { updatedAt: true } },
        workspaceSessions: { orderBy: { updatedAt: "desc" }, select: { sessionId: true, title: true, updatedAt: true, deletedAt: true, summaryJson: true, usageSummary: true, memorySummary: true } },
        userAssetStates: { where: { hiddenAt: null, mediaAsset: { archivedAt: null } }, select: RECORDS_ASSET_STATE_SELECT, orderBy: { updatedAt: "desc" } },
        sessions: { orderBy: { lastSeenAt: "desc" }, take: 1, select: { lastSeenAt: true } },
        _count: { select: { sessions: true, workspaceWorkflows: { where: { deletedAt: null } } } },
      },
    })
    : prisma.user.findUnique({
      where: { id: userId },
      include: {
        workspace: { select: { state: true, updatedAt: true } },
        workspaceSessions: { orderBy: { updatedAt: "desc" }, select: { sessionId: true, title: true, updatedAt: true, deletedAt: true, messagesJson: true, summaryJson: true, usageSummary: true, memorySummary: true } },
        workspaceMessages: { orderBy: { createdAt: "asc" }, select: { sessionId: true, messageJson: true, createdAt: true } },
        userAssetStates: { where: { hiddenAt: null, mediaAsset: { archivedAt: null } }, select: DETAIL_ASSET_STATE_SELECT, orderBy: { updatedAt: "desc" } },
        sessions: { orderBy: { lastSeenAt: "desc" }, take: 1, select: { lastSeenAt: true } },
        _count: { select: { sessions: true, workspaceWorkflows: { where: { deletedAt: null } } } },
      },
    });

  const [user, creditSettings, ledgers] = await Promise.all([
    userQuery,
    getCreditSettings(),
    isMediaMode ? Promise.resolve([] as any[]) : prisma.creditLedger.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
  ]);

  if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

  if (isMediaMode) {
    const mediaItems = getMediaAssetItems(user.userAssetStates, "conversation");
    const assetMediaItems = getMediaAssetItems(user.userAssetStates, "asset");
    const workflowMediaItems = getMediaAssetItems(user.userAssetStates, "workflow");
    const uploadRecords = buildUploadRecords(user.userAssetStates);
    const adminUser: AdminUserRow = {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      language: user.language,
      credits: user.credits,
      disabled: user.disabled,
      generalModeEnabled: user.generalModeEnabled,
      generatedImageCount: user.generatedImageCount,
      generatedVideoCount: user.generatedVideoCount,
      conversationCount: 0,
      consumedCredits: 0,
      consumedTokens: 0,
      consumedAmountLabel: "$0.0000 / ¥0.00",
      notifyOnGenerationComplete: user.notifyOnGenerationComplete,
      autoSaveHistory: user.autoSaveHistory,
      previewWheelZoom: user.previewWheelZoom,
      previewWheelFlip: user.previewWheelFlip,
      hasPassword: Boolean(user.passwordHash),
      createdAtLabel: formatDate(user.createdAt),
      updatedAtLabel: formatDate(user.updatedAt),
      lastLoginAtLabel: formatDate(user.lastLoginAt ?? user.sessions[0]?.lastSeenAt),
      lastLoginIp: user.lastLoginIp,
      lastLoginLocation: user.lastLoginLocation,
      lastLoginUserAgent: user.lastLoginUserAgent,
      workspaceSaved: false,
      workspaceUpdatedAtLabel: "-",
      sessionCount: user._count.sessions,
      lastSessionSeenAtLabel: formatDate(user.sessions[0]?.lastSeenAt),
      conversations: [],
      mediaItems,
      assetMediaItems,
      workflowCount: (user as any)._count?.workspaceWorkflows ?? 0,
      workflowImageCount: workflowMediaItems.filter((item) => item.type === "image").length,
      workflowVideoCount: workflowMediaItems.filter((item) => item.type === "video").length,
      workflowMediaItems,
      uploadImageCount: uploadRecords.filter((item) => item.kind === "image").length,
      uploadVideoCount: uploadRecords.filter((item) => item.kind === "video").length,
      uploadAudioCount: uploadRecords.filter((item) => item.kind === "audio").length,
      uploadDocumentCount: uploadRecords.filter((item) => item.kind === "document").length,
      uploadRecords,
    };
    const creditUser: AdminCreditUser = {
      id: user.id,
      userEmail: user.email,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      currentCredits: user.credits,
      giftedCredits: 0,
      signupGiftedCredits: 0,
      adminAdjustedGiftedCredits: 0,
      consumedCredits: 0,
      consumedTokens: 0,
      consumedUsd: 0,
      consumedCny: 0,
      conversationConsumedCredits: 0,
      assetGenerationConsumedCredits: 0,
      promptToolConsumedCredits: 0,
      workflowConsumedCredits: 0,
      conversationCreditDetails: [],
      assetGenerationCreditDetails: [],
      promptToolCreditDetails: [],
      workflowCreditDetails: [],
      currentCreditDetails: [],
      lastActiveLabel: "-",
    };
    return NextResponse.json({ detail: { user: adminUser, creditUser } });
  }

  if (isRecordsMode) {
    const mediaSummary = getFastMediaSummary(user.userAssetStates);
    const creditSummary = getFastCreditSummary(ledgers, creditSettings.creditsPerCny);
    const conversations: AdminConversation[] = (user as any).workspaceSessions.map((session: any) => ({
      id: session.sessionId,
      title: session.title || "新对话",
      isDeleted: Boolean(session.deletedAt),
      deletedAtLabel: session.deletedAt ? formatDate(session.deletedAt) : undefined,
      conversationCode: isRecord(session.summaryJson) ? getString(session.summaryJson.conversationCode) : undefined,
      updatedAtLabel: formatDate(session.updatedAt),
      updatedAtTs: session.updatedAt.getTime(),
      messages: [],
    }));
    const adminUser: AdminUserRow = {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      language: user.language,
      credits: user.credits,
      disabled: user.disabled,
      generalModeEnabled: user.generalModeEnabled,
      generatedImageCount: Math.max(user.generatedImageCount, mediaSummary.conversationImageCount + mediaSummary.assetGeneratedImageCount),
      generatedVideoCount: Math.max(user.generatedVideoCount, mediaSummary.conversationVideoCount),
      conversationCount: conversations.filter((item) => !item.isDeleted).length,
      consumedCredits: creditSummary.consumedCredits,
      consumedTokens: creditSummary.consumedTokens,
      consumedAmountLabel: `$${creditSummary.consumedUsd.toFixed(4)} / ¥${creditSummary.consumedCny.toFixed(2)}`,
      notifyOnGenerationComplete: user.notifyOnGenerationComplete,
      autoSaveHistory: user.autoSaveHistory,
      previewWheelZoom: user.previewWheelZoom,
      previewWheelFlip: user.previewWheelFlip,
      hasPassword: Boolean(user.passwordHash),
      createdAtLabel: formatDate(user.createdAt),
      updatedAtLabel: formatDate(user.updatedAt),
      lastLoginAtLabel: formatDate(user.lastLoginAt ?? user.sessions[0]?.lastSeenAt),
      lastLoginIp: user.lastLoginIp,
      lastLoginLocation: user.lastLoginLocation,
      lastLoginUserAgent: user.lastLoginUserAgent,
      workspaceSaved: Boolean((user as any).workspace),
      workspaceUpdatedAtLabel: formatDate((user as any).workspace?.updatedAt),
      sessionCount: user._count.sessions,
      lastSessionSeenAtLabel: formatDate(user.sessions[0]?.lastSeenAt),
      conversations,
      mediaItems: [],
      assetMediaItems: [],
      workflowCount: (user as any)._count?.workspaceWorkflows ?? 0,
      workflowMediaItems: [],
      uploadRecords: [],
      ...mediaSummary,
    };
    const creditUser: AdminCreditUser = {
      id: user.id,
      userEmail: user.email,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      currentCredits: user.credits,
      giftedCredits: creditSummary.giftedCredits,
      signupGiftedCredits: creditSummary.signupGiftedCredits,
      adminAdjustedGiftedCredits: creditSummary.adminAdjustedGiftedCredits,
      consumedCredits: creditSummary.consumedCredits,
      consumedTokens: creditSummary.consumedTokens,
      consumedUsd: creditSummary.consumedUsd,
      consumedCny: creditSummary.consumedCny,
      conversationConsumedCredits: creditSummary.conversationConsumedCredits,
      assetGenerationConsumedCredits: creditSummary.assetGenerationConsumedCredits,
      promptToolConsumedCredits: creditSummary.promptToolConsumedCredits,
      conversationCreditDetails: [],
      assetGenerationCreditDetails: [],
      promptToolCreditDetails: [],
      workflowConsumedCredits: creditSummary.workflowConsumedCredits,
      workflowCreditDetails: [],
      currentCreditDetails: [],
      lastActiveLabel: ledgers[0] ? formatShortDate(ledgers[0].createdAt) : "-",
    };
    return NextResponse.json({ detail: { user: adminUser, creditUser } });
  }

  const workspaceState = buildAdminWorkspaceState((user as any).workspace?.state, (user as any).workspaceSessions, isRecordsMode ? [] : (user as any).workspaceMessages);
  const conversations = getWorkspaceConversations(workspaceState);
  const mediaItems = getMediaAssetItems(user.userAssetStates, "conversation");
  const assetMediaItems = getMediaAssetItems(user.userAssetStates, "asset");
  const workflowMediaItems = getMediaAssetItems(user.userAssetStates, "workflow");
  const mediaByUrl = new Map<string, AdminMediaItem>();
  for (const media of [...mediaItems, ...assetMediaItems, ...workflowMediaItems]) {
    mediaByUrl.set(media.url, media);
    mediaByUrl.set(normalizeMediaUrlForAdmin(media.url), media);
    if (media.requestId) mediaByUrl.set(media.requestId, media);
  }

  const creditLookup = new Map<string, AdminCreditFlowItem>();
  const conversationDetails = new Map<string, AdminCreditConversationDetail>();
  const workflowDetails = new Map<string, AdminCreditConversationDetail>();
  const assetCategoryDetails = new Map<string, AdminCreditCategoryDetail>();
  const promptToolCategoryDetails = new Map<string, AdminCreditCategoryDetail>();
  let giftedCredits = 0;
  let signupGiftedCredits = 0;
  let adminAdjustedGiftedCredits = 0;
  let consumedCredits = 0;
  let consumedTokens = 0;
  let consumedUsd = 0;
  let consumedCny = 0;
  let conversationConsumedCredits = 0;
  let assetGenerationConsumedCredits = 0;
  let promptToolConsumedCredits = 0;
  let workflowConsumedCredits = 0;

  const chronologicalLedgers = [...ledgers].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  let balance = user.credits - chronologicalLedgers.reduce((sum, item) => sum + (item.direction === "increase" ? item.credits : -item.credits), 0);
  const currentCreditDetails = chronologicalLedgers.map((item) => {
    balance += item.direction === "increase" ? item.credits : -item.credits;
    return { id: item.id, reason: getCreditLedgerReason(item.kind, item.label, item.metadata), delta: item.direction === "increase" ? item.credits : -item.credits, balanceAfter: balance, createdAtLabel: formatShortDate(item.createdAt), createdAtTs: item.createdAt.getTime() };
  }).sort((left, right) => right.createdAtTs - left.createdAtTs);

  for (const item of ledgers) {
    if (item.direction === "increase") {
      giftedCredits += item.credits;
      if (item.kind === "signup") signupGiftedCredits += item.credits;
      if (item.kind === "admin_adjust") adminAdjustedGiftedCredits += item.credits;
      continue;
    }

    consumedCredits += item.credits;
    consumedTokens += item.totalTokens;
    consumedUsd += item.usd;
    consumedCny += item.cny;

    const creditSource = getCreditSource(item.metadata);
    const ledgerUrl = getLedgerMediaUrls(item.metadata)[0] ?? "";
    const matchedMedia = ledgerUrl ? mediaByUrl.get(ledgerUrl) ?? mediaByUrl.get(normalizeMediaUrlForAdmin(ledgerUrl)) : item.requestId ? mediaByUrl.get(item.requestId) : undefined;
    const flowKind = matchedMedia?.type ?? (item.kind === "video" ? "video" : "image");
    const flowItem: AdminCreditFlowItem = { id: item.id, requestId: item.requestId ?? item.id, kind: flowKind, systemName: matchedMedia?.systemName || "", displayName: matchedMedia?.name || item.label || (flowKind === "video" ? "视频" : "图片"), url: matchedMedia?.url || ledgerUrl, status: getMetadataString(item.metadata, "status") === "failed" ? "failed" : "success", errorText: getMetadataString(item.metadata, "failureReason") || (matchedMedia?.isDeleted ? "用户已删除" : undefined), deletedAtLabel: matchedMedia?.deletedAtLabel, credits: item.credits, expectedCredits: getLedgerExpectedCredits(item, creditSettings.creditsPerCny), totalTokens: item.totalTokens, usd: item.usd, cny: item.cny, count: flowKind === "video" ? Math.max(item.videoCount, 1) : Math.max(item.imageCount, 1), model: item.model || "-", parameters: matchedMedia ? [matchedMedia.model, matchedMedia.ratio, [matchedMedia.size, matchedMedia.resolution].filter((value) => value && value !== "-").join(" "), matchedMedia.type === "video" ? matchedMedia.duration : ""].filter((value) => value && value !== "-").join(" | ") : getModelLabel(flowKind, item.model || "-"), isChargeDisabled: getMetadataBoolean(item.metadata, "creditChargeDisabled"), isCostUnavailable: !getMetadataBoolean(item.metadata, "creditChargeDisabled") && item.credits === 0 && item.usd === 0 && item.cny === 0, promptText: matchedMedia?.prompt || getMetadataString(item.metadata, "originalPrompt") || getMetadataString(item.metadata, "prompt"), promptConstraints: matchedMedia?.promptConstraints, createdAtLabel: formatShortDate(item.createdAt), createdAtTs: item.createdAt.getTime() };
    if (item.requestId) creditLookup.set(item.requestId, flowItem);
    if (flowItem.url) {
      creditLookup.set(flowItem.url, flowItem);
      creditLookup.set(normalizeMediaUrlForAdmin(flowItem.url), flowItem);
    }

    if (creditSource === "character_image_generation" || creditSource === "scene_image_generation" || creditSource === "shot_image_generation") {
      assetGenerationConsumedCredits += item.credits;
      const category = getAssetCategory(creditSource);
      addCategoryItem(assetCategoryDetails, category.id, category.title, flowItem);
    } else if (creditSource === "image_prompt_reverse" || creditSource === "prompt_optimization") {
      promptToolConsumedCredits += item.credits;
      const category = getPromptToolCategory(creditSource);
      addCategoryItem(promptToolCategoryDetails, category.id, category.title, flowItem);
    } else if (creditSource.startsWith("workflow_")) {
      const workflowId = item.conversationId || `unknown-workflow-${user.id}`;
      const detail: AdminCreditConversationDetail = workflowDetails.get(workflowId) ?? { id: workflowId, title: item.conversationTitle || "未命名工作流", updatedAtLabel: formatShortDate(item.createdAt), updatedAtTs: item.createdAt.getTime(), chatCredits: 0, chatExpectedCredits: 0, chatUsd: 0, chatCny: 0, planCredits: 0, planExpectedCredits: 0, planUsd: 0, planCny: 0, mediaItems: [] };
      if (item.conversationTitle) detail.title = item.conversationTitle;
      if (item.createdAt.getTime() >= (detail.updatedAtTs ?? 0)) {
        detail.updatedAtLabel = formatShortDate(item.createdAt);
        detail.updatedAtTs = item.createdAt.getTime();
      }
      detail.mediaItems.push(flowItem);
      workflowConsumedCredits += item.credits;
      workflowDetails.set(workflowId, detail);
    } else {
      const conversationId = item.conversationId || `unknown-${user.id}`;
      const detail: AdminCreditConversationDetail = conversationDetails.get(conversationId) ?? { id: conversationId, title: item.conversationTitle || "未命名对话", updatedAtLabel: formatShortDate(item.createdAt), updatedAtTs: item.createdAt.getTime(), chatCredits: 0, chatExpectedCredits: 0, chatUsd: 0, chatCny: 0, planCredits: 0, planExpectedCredits: 0, planUsd: 0, planCny: 0, mediaItems: [] };
      if (item.conversationTitle) detail.title = item.conversationTitle;
      if (item.createdAt.getTime() >= (detail.updatedAtTs ?? 0)) {
        detail.updatedAtLabel = formatShortDate(item.createdAt);
        detail.updatedAtTs = item.createdAt.getTime();
      }
      if (item.kind === "text") {
        detail.chatCredits += item.credits;
        detail.chatExpectedCredits = (detail.chatExpectedCredits ?? 0) + getLedgerExpectedCredits(item, creditSettings.creditsPerCny);
        detail.chatUsd = (detail.chatUsd ?? 0) + item.usd;
        detail.chatCny = (detail.chatCny ?? 0) + item.cny;
      } else if (item.kind === "image" || item.kind === "video") {
        detail.mediaItems.push(flowItem);
      }
      conversationConsumedCredits += item.credits;
      conversationDetails.set(conversationId, detail);
    }
  }

  for (const conversation of conversations) {
    const detail = conversationDetails.get(conversation.id) ?? { id: conversation.id, title: conversation.title, conversationCode: conversation.conversationCode, updatedAtLabel: conversation.updatedAtLabel, updatedAtTs: conversation.updatedAtTs, chatCredits: 0, chatExpectedCredits: 0, chatUsd: 0, chatCny: 0, planCredits: 0, planExpectedCredits: 0, planUsd: 0, planCny: 0, mediaItems: [] };
    detail.title = conversation.title;
    detail.conversationCode = conversation.conversationCode;
    detail.updatedAtLabel = conversation.updatedAtLabel;
    detail.updatedAtTs = conversation.updatedAtTs;
    const existingUrls = new Set(detail.mediaItems.map((media) => media.url).filter(Boolean).flatMap((url) => [url, normalizeMediaUrlForAdmin(url)]));
    [...mediaItems].filter((media) => media.conversationId ? media.conversationId === conversation.id : media.createdAtTs && media.createdAtTs <= (conversation.updatedAtTs ?? Number.MAX_SAFE_INTEGER)).forEach((media, index) => {
      if (existingUrls.has(media.url) || existingUrls.has(normalizeMediaUrlForAdmin(media.url))) return;
      detail.mediaItems.push(makeMediaFlowItem(media, index, creditLookup));
      existingUrls.add(media.url);
      existingUrls.add(normalizeMediaUrlForAdmin(media.url));
    });
    detail.mediaItems.sort((left, right) => right.createdAtTs - left.createdAtTs);
    if (detail.mediaItems.length > 0 || detail.chatCredits > 0 || detail.planCredits > 0) conversationDetails.set(conversation.id, detail);
  }

  for (const asset of assetMediaItems) {
    if (!asset.isUploadedAsset) continue;
    const category = getAssetUploadCategory(asset.assetType);
    if (!category) continue;
    addCategoryItem(assetCategoryDetails, category.id, category.title, { id: `${asset.id}-upload-record`, requestId: `${asset.id}-upload-record`, kind: "image", systemName: asset.name || "", displayName: asset.name || "上传图片", url: asset.url, status: "success", errorText: asset.isDeleted ? "用户已删除" : undefined, deletedAtLabel: asset.deletedAtLabel, credits: 0, totalTokens: 0, usd: 0, cny: 0, count: 1, model: "-", parameters: "资产库上传", isUploadRecord: true, isReversePrompt: asset.isReversePrompt, promptText: asset.isReversePrompt ? asset.prompt : undefined, createdAtLabel: asset.createdAtTs ? formatShortDate(new Date(asset.createdAtTs)) : "-", createdAtTs: asset.createdAtTs ?? 0 });
  }

  const workspaceSummary = { generatedImageCount: mediaItems.filter((item) => item.type === "image" && !item.isUploadedAsset).length + assetMediaItems.filter((item) => !item.isUploadedAsset).length, generatedVideoCount: mediaItems.filter((item) => item.type === "video").length, conversationCount: conversations.length };
  const uploadRecords = buildUploadRecords(user.userAssetStates);
  const adminUser: AdminUserRow = { id: user.id, email: user.email, nickname: user.nickname, phone: user.phone, avatarUrl: user.avatarUrl, language: user.language, credits: user.credits, disabled: user.disabled, generalModeEnabled: user.generalModeEnabled, generatedImageCount: Math.max(user.generatedImageCount, workspaceSummary.generatedImageCount), generatedVideoCount: Math.max(user.generatedVideoCount, workspaceSummary.generatedVideoCount), conversationCount: workspaceSummary.conversationCount, consumedCredits, consumedTokens, consumedAmountLabel: `$${consumedUsd.toFixed(4)} / ¥${consumedCny.toFixed(2)}`, notifyOnGenerationComplete: user.notifyOnGenerationComplete, autoSaveHistory: user.autoSaveHistory, previewWheelZoom: user.previewWheelZoom, previewWheelFlip: user.previewWheelFlip, hasPassword: Boolean(user.passwordHash), createdAtLabel: formatDate(user.createdAt), updatedAtLabel: formatDate(user.updatedAt), lastLoginAtLabel: formatDate(user.lastLoginAt ?? user.sessions[0]?.lastSeenAt), lastLoginIp: user.lastLoginIp, lastLoginLocation: user.lastLoginLocation, lastLoginUserAgent: user.lastLoginUserAgent, workspaceSaved: Boolean((user as any).workspace), workspaceUpdatedAtLabel: formatDate((user as any).workspace?.updatedAt), sessionCount: user._count.sessions, lastSessionSeenAtLabel: formatDate(user.sessions[0]?.lastSeenAt), conversations, mediaItems, assetMediaItems, workflowCount: (user as any)._count?.workspaceWorkflows ?? 0, workflowImageCount: workflowMediaItems.filter((item) => item.type === "image").length, workflowVideoCount: workflowMediaItems.filter((item) => item.type === "video").length, workflowMediaItems, uploadImageCount: uploadRecords.filter((item) => item.kind === "image").length, uploadVideoCount: uploadRecords.filter((item) => item.kind === "video").length, uploadAudioCount: uploadRecords.filter((item) => item.kind === "audio").length, uploadDocumentCount: uploadRecords.filter((item) => item.kind === "document").length, uploadRecords };
  const creditUser: AdminCreditUser = { id: user.id, userEmail: user.email, nickname: user.nickname, avatarUrl: user.avatarUrl, currentCredits: user.credits, giftedCredits, signupGiftedCredits, adminAdjustedGiftedCredits, consumedCredits, consumedTokens, consumedUsd, consumedCny, conversationConsumedCredits, assetGenerationConsumedCredits, promptToolConsumedCredits, workflowConsumedCredits, conversationCreditDetails: Array.from(conversationDetails.values()), assetGenerationCreditDetails: Array.from(assetCategoryDetails.values()).map((detail) => ({ ...detail, items: detail.items.sort((left, right) => right.createdAtTs - left.createdAtTs) })), promptToolCreditDetails: Array.from(promptToolCategoryDetails.values()).map((detail) => ({ ...detail, items: detail.items.sort((left, right) => right.createdAtTs - left.createdAtTs) })), workflowCreditDetails: Array.from(workflowDetails.values()).map((detail) => ({ ...detail, mediaItems: [...detail.mediaItems].sort((left, right) => right.createdAtTs - left.createdAtTs) })), currentCreditDetails, lastActiveLabel: ledgers[0] ? formatShortDate(ledgers[0].createdAt) : "-" };

  return NextResponse.json({ detail: { user: adminUser, creditUser } });
}
