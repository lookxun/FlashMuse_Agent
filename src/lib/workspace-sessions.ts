import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isRecord } from "@/lib/workspace-state-cleanup";
import { canonicalizeSavedMediaUrl, normalizeMediaAssetUrl, resolvePersistableMediaAssetUrl } from "@/lib/media-assets";

const UPLOAD_IMAGE_PROMPT_PLACEHOLDER = "上传图片";

type WorkspaceSessionRow = {
  sessionId: string;
  title: string;
  updatedAt: Date;
  messagesJson?: Prisma.JsonValue;
  summaryJson: Prisma.JsonValue | null;
  usageSummary: Prisma.JsonValue | null;
  memorySummary: Prisma.JsonValue | null;
  deletedAt?: Date | null;
};

type WorkspaceMessageRow = {
  messageJson: Prisma.JsonValue;
  createdAt: Date;
};

export const DEFAULT_WORKSPACE_SESSION_LIMIT = 10;
export const WORKSPACE_SESSION_LOAD_MORE_LIMIT = 5;
export const DEFAULT_WORKSPACE_MESSAGE_LIMIT = 50;

function toDate(value: unknown) {
  const timestamp = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp) : new Date();
}

function toNullableDate(value: unknown) {
  const timestamp = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp) : null;
}

function toJsonObject(value: unknown): Prisma.InputJsonValue | undefined {
  return isRecord(value) ? (value as Prisma.InputJsonObject) : undefined;
}

function toJsonArray(value: unknown): Prisma.InputJsonValue {
  return Array.isArray(value) ? (value as Prisma.InputJsonArray) : [];
}

function getMessageId(message: Record<string, unknown>) {
  return typeof message.id === "string" && message.id ? message.id : "";
}

function getMessageRole(message: Record<string, unknown>) {
  return typeof message.role === "string" && message.role ? message.role : "unknown";
}

function getMessageContent(message: Record<string, unknown>) {
  return typeof message.content === "string" ? message.content : "";
}

function getString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeMediaUrl(value: string) {
  return normalizeMediaAssetUrl(value);
}

function mediaTypeFromUrl(url: string) {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url) ? "video" : "image";
}

function getDimension(value: unknown) {
  if (!isRecord(value)) return undefined;
  const width = Number(value.width);
  const height = Number(value.height);
  return Number.isFinite(width) && Number.isFinite(height) ? { width: Math.floor(width), height: Math.floor(height) } : undefined;
}

function getMessageImageUrls(message: Record<string, unknown>) {
  if (Array.isArray(message.imageResultSlots)) {
    const slots = message.imageResultSlots.filter(isRecord).filter((slot) => slot.type === "image").map((slot) => getString(slot.url)).filter(Boolean);
    if (slots.length > 0) return slots;
  }
  return Array.isArray(message.images) ? message.images.filter((url): url is string => typeof url === "string" && Boolean(url)) : [];
}

function getMessageVideoUrls(message: Record<string, unknown>) {
  const urls = new Set<string>();
  if (Array.isArray(message.videos)) message.videos.forEach((url) => { if (typeof url === "string" && url) urls.add(url); });
  if (typeof message.videoUrl === "string" && message.videoUrl) urls.add(message.videoUrl);
  return Array.from(urls);
}

async function syncWorkspaceMessageMediaAssets(userId: string, sessionId: string, messages: Record<string, unknown>[]) {
  for (const message of messages) {
    const role = getMessageRole(message);
    const messageId = getMessageId(message);
    const createdAt = toDate(message.createdAt);
    const meta = isRecord(message.generationMeta) ? message.generationMeta : undefined;
    const settings = isRecord(meta?.settings) ? meta.settings : undefined;
    const mediaSystemNames = isRecord(message.mediaSystemNames) ? message.mediaSystemNames : undefined;
    const items: Array<{ url: string; mediaType: "image" | "video"; category: string; sourceKind: string; sourcePrompt?: string; promptSource: string; name?: string; posterUrl?: string; width?: number; height?: number; videoDuration?: string }> = [];

    if (role === "user") {
      for (const url of getMessageImageUrls(message).filter((item) => /\/generated\/(?:users\/[^/]+\/)?upload_image\//.test(normalizeMediaUrl(item)))) {
        items.push({ url, mediaType: "image", category: "conversation_uploads", sourceKind: "conversation_upload_image", sourcePrompt: UPLOAD_IMAGE_PROMPT_PLACEHOLDER, promptSource: "upload" });
      }
    }

    if (role === "assistant") {
      const imagePrompts = isRecord(message.imagePrompts) ? message.imagePrompts : undefined;
      const videoPrompts = isRecord(message.videoPrompts) ? message.videoPrompts : undefined;
      const imageDimensions = isRecord(message.imageDimensions) ? message.imageDimensions : undefined;
      const videoDimensionsMap = isRecord(message.videoDimensionsMap) ? message.videoDimensionsMap : undefined;
      const videoPosters = isRecord(message.videoPosters) ? message.videoPosters : undefined;
      const originalPrompt = getString(meta?.originalPrompt) || getMessageContent(message);

      if (Array.isArray(message.imageReferences)) {
        for (const reference of message.imageReferences.filter(isRecord)) {
          const url = getString(reference.url);
          if (!url || !/\/generated\/(?:users\/[^/]+\/)?upload_image\//.test(normalizeMediaUrl(url))) continue;
          items.push({ url, mediaType: "image", category: "conversation_uploads", sourceKind: "conversation_upload_image", sourcePrompt: UPLOAD_IMAGE_PROMPT_PLACEHOLDER, promptSource: "upload", name: getString(reference.name) });
        }
      }

      for (const url of getMessageImageUrls(message)) {
        const dim = getDimension(imageDimensions?.[url]);
        items.push({ url, mediaType: "image", category: "conversation_images", sourceKind: "conversation_generation_image", sourcePrompt: getString(imagePrompts?.[url], originalPrompt), promptSource: "generated", width: dim?.width, height: dim?.height });
      }

      for (const url of getMessageVideoUrls(message)) {
        const dim = getDimension(videoDimensionsMap?.[url]) || getDimension(message.videoDimensions);
        items.push({ url, mediaType: "video", category: "conversation_videos", sourceKind: "conversation_generation_video", sourcePrompt: getString(videoPrompts?.[url], originalPrompt), promptSource: "generated", posterUrl: getString(videoPosters?.[url]), width: dim?.width, height: dim?.height, videoDuration: getString(settings?.duration) });
      }
    }

    for (const item of items) {
      const resolved = resolvePersistableMediaAssetUrl(userId, item.url, { posterUrl: item.posterUrl });
      if (!resolved) continue;
      const normalizedUrl = resolved.normalizedUrl;
      const systemName = getString(mediaSystemNames?.[item.url]) || item.name;
      const media = await prisma.mediaAsset.upsert({
        where: { userId_normalizedUrl: { userId, normalizedUrl } },
        create: { userId, mediaType: item.mediaType || mediaTypeFromUrl(normalizedUrl), url: resolved.url, normalizedUrl, originalUrl: resolved.originalUrl, posterUrl: resolved.posterUrl || undefined, thumbnailUrl: resolved.thumbnailUrl || undefined, sourceKind: item.sourceKind, sourcePrompt: item.sourcePrompt, promptSource: item.promptSource, model: getString(meta?.model) || undefined, ratio: getString(settings?.ratio) || undefined, resolution: getString(settings?.resolution) || undefined, imageSize: getString(settings?.imageSize || settings?.size) || undefined, videoDuration: item.videoDuration || undefined, generationSettings: settings as Prisma.InputJsonValue | undefined, width: item.width, height: item.height, systemName: systemName || undefined, initialName: systemName || undefined, initialCategory: item.category, conversationId: sessionId, messageId, requestId: getString(message.requestId) || undefined, firstSeenAt: createdAt },
        update: { mediaType: item.mediaType || mediaTypeFromUrl(normalizedUrl), url: resolved.url, originalUrl: resolved.originalUrl, posterUrl: resolved.posterUrl || undefined, thumbnailUrl: resolved.thumbnailUrl || undefined, sourcePrompt: item.sourcePrompt, promptSource: item.promptSource, model: getString(meta?.model) || undefined, ratio: getString(settings?.ratio) || undefined, resolution: getString(settings?.resolution) || undefined, imageSize: getString(settings?.imageSize || settings?.size) || undefined, videoDuration: item.videoDuration || undefined, generationSettings: settings as Prisma.InputJsonValue | undefined, width: item.width, height: item.height, systemName: systemName || undefined, initialName: systemName || undefined, conversationId: sessionId, messageId, requestId: getString(message.requestId) || undefined },
        select: { id: true },
      });

      await prisma.userAssetState.upsert({
        where: { userId_mediaAssetId: { userId, mediaAssetId: media.id } },
        create: { userId, mediaAssetId: media.id, currentName: systemName || undefined, currentCategory: item.category, originalCategory: item.category },
        update: { hiddenAt: null, hiddenReason: null },
      });
      await canonicalizeSavedMediaUrl(userId, resolved.url);
    }
  }
}

function getSessionSummary(session: Record<string, unknown>): Prisma.InputJsonValue {
  const { messages: _messages, usageSummary: _usageSummary, memorySummary: _memorySummary, messagesLoaded: _messagesLoaded, deletedAt: _deletedAt, ...summary } = session;
  return summary as Prisma.InputJsonObject;
}

export function stripSessionsFromWorkspaceState(state: unknown) {
  if (!isRecord(state)) return state;
  const { sessions: _sessions, ...rest } = state;
  return rest;
}

export async function upsertWorkspaceSessions(userId: string, sessions: unknown) {
  if (!Array.isArray(sessions)) return;

  await Promise.all(
    sessions.filter(isRecord).map((session) => {
      const sessionId = typeof session.id === "string" ? session.id : "";
      if (!sessionId) return Promise.resolve();

      const baseData = {
        title: typeof session.title === "string" && session.title.trim() ? session.title.trim() : "新对话",
        updatedAt: toDate(session.updatedAt),
        deletedAt: toNullableDate(session.deletedAt),
        summaryJson: getSessionSummary(session),
        usageSummary: toJsonObject(session.usageSummary),
        memorySummary: toJsonObject(session.memorySummary),
      };
      const shouldStoreMessages = session.messagesLoaded !== false;
      const messagesJson = toJsonArray(session.messages);

      const upsertSession = prisma.workspaceSession.upsert({
        where: { userId_sessionId: { userId, sessionId } },
        create: {
          userId,
          sessionId,
          ...baseData,
          messagesJson,
        },
        update: shouldStoreMessages ? { ...baseData, messagesJson } : baseData,
      });
      const messages = session.messages;
      if (!shouldStoreMessages || !Array.isArray(messages)) return upsertSession;

      return upsertSession.then(() => upsertWorkspaceMessages(userId, sessionId, messages));
    }),
  );
}

export async function upsertWorkspaceMessages(userId: string, sessionId: string, messages: unknown[]) {
  const validMessages = messages.filter(isRecord).filter((message) => getMessageId(message));
  if (validMessages.length === 0) return;

  for (let index = 0; index < validMessages.length; index += 50) {
    const chunk = validMessages.slice(index, index + 50);
    await prisma.$transaction(
      chunk.map((message) => {
        const messageId = getMessageId(message);
        const data = {
          role: getMessageRole(message),
          content: getMessageContent(message),
          createdAt: toDate(message.createdAt),
          messageJson: message as Prisma.InputJsonObject,
        };

        return prisma.workspaceMessage.upsert({
          where: { userId_sessionId_messageId: { userId, sessionId, messageId } },
          create: { userId, sessionId, messageId, ...data },
          update: data,
        });
      }),
    );
  }

  await syncWorkspaceMessageMediaAssets(userId, sessionId, validMessages).catch((error) => {
    console.warn("[workspace-sessions] media asset sync failed", { userId, sessionId, error: error instanceof Error ? error.message : String(error) });
  });
}

export async function migrateWorkspaceSessionsFromState(userId: string, state: unknown) {
  if (!isRecord(state) || !Array.isArray(state.sessions) || state.sessions.length === 0) return false;
  await upsertWorkspaceSessions(userId, state.sessions);
  return true;
}

export function workspaceMessageRowsToMessages(rows: WorkspaceMessageRow[]) {
  return rows.map((row) => sanitizeWorkspaceMessage(row.messageJson)).filter(isRecord);
}

function collectMessageMediaUrls(message: Record<string, unknown>) {
  const imageUrls = new Set<string>();
  const videoUrls = new Set<string>();
  const addString = (set: Set<string>, value: unknown) => {
    if (typeof value === "string" && value) set.add(value);
  };
  const addMediaItem = (value: unknown, fallbackSet: Set<string>) => {
    if (typeof value === "string") {
      fallbackSet.add(value);
      return;
    }
    if (!isRecord(value)) return;
    addString(imageUrls, value.url);
    addString(imageUrls, value.imageUrl);
    addString(videoUrls, value.videoUrl);
    addString(videoUrls, value.posterUrl);
  };

  if (Array.isArray(message.images)) message.images.forEach((item) => addMediaItem(item, imageUrls));
  if (Array.isArray(message.videos)) message.videos.forEach((item) => addMediaItem(item, videoUrls));
  if (Array.isArray(message.imageReferences)) message.imageReferences.forEach((item) => addMediaItem(item, imageUrls));
  addString(videoUrls, message.videoUrl);
  return { imageUrls, videoUrls, allUrls: new Set([...imageUrls, ...videoUrls]) };
}

function pickRecordKeys(value: unknown, keys: Set<string>) {
  if (!isRecord(value) || keys.size === 0) return undefined;
  const next = Object.fromEntries(Object.entries(value).filter(([key]) => keys.has(key)));
  return Object.keys(next).length > 0 ? next : undefined;
}

function sanitizeWorkspaceMessage(value: unknown) {
  if (!isRecord(value)) return value;
  const { imageUrls, videoUrls, allUrls } = collectMessageMediaUrls(value);
  const next: Record<string, unknown> = { ...value };
  const imageDimensions = pickRecordKeys(value.imageDimensions, imageUrls);
  const videoDimensions = pickRecordKeys(value.videoDimensions, videoUrls);
  const videoPosters = pickRecordKeys(value.videoPosters, videoUrls);
  const videoPrompts = pickRecordKeys(value.videoPrompts, videoUrls);
  const mediaSystemNames = pickRecordKeys(value.mediaSystemNames, allUrls);

  if (imageDimensions) next.imageDimensions = imageDimensions; else delete next.imageDimensions;
  if (videoDimensions) next.videoDimensions = videoDimensions; else delete next.videoDimensions;
  if (videoPosters) next.videoPosters = videoPosters; else delete next.videoPosters;
  if (videoPrompts) next.videoPrompts = videoPrompts; else delete next.videoPrompts;
  if (mediaSystemNames) next.mediaSystemNames = mediaSystemNames; else delete next.mediaSystemNames;
  return next;
}

export async function getWorkspaceSessionMessages(userId: string, sessionId: string, before?: number, limit = DEFAULT_WORKSPACE_MESSAGE_LIMIT) {
  const rows = await prisma.workspaceMessage.findMany({
    where: {
      userId,
      sessionId,
      ...(before && Number.isFinite(before) ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    select: { messageJson: true, createdAt: true },
  });
  const pageRows = rows.slice(0, limit).reverse();
  const messages = workspaceMessageRowsToMessages(pageRows);
  const oldest = pageRows[0]?.createdAt.getTime();

  return {
    messages,
    hasMore: rows.length > limit,
    nextBefore: oldest,
  };
}

export function workspaceSessionRowToPayload(row: WorkspaceSessionRow, includeMessages: boolean, messages?: unknown[], messagePage?: { hasMore: boolean; nextBefore?: number }) {
  const summary = isRecord(row.summaryJson) ? row.summaryJson : {};
  return {
    ...summary,
    id: row.sessionId,
    title: row.title,
    updatedAt: row.updatedAt.getTime(),
    deletedAt: row.deletedAt ? row.deletedAt.getTime() : undefined,
    messages: includeMessages ? (messages ?? (Array.isArray(row.messagesJson) ? workspaceMessageRowsToMessages(row.messagesJson.map((message) => ({ messageJson: message as Prisma.JsonValue, createdAt: row.updatedAt }))) : [])) : [],
    messagesHasMore: includeMessages ? Boolean(messagePage?.hasMore) : undefined,
    messagesBeforeCursor: includeMessages ? messagePage?.nextBefore : undefined,
    videoTask: isRecord(summary) && "videoTask" in summary ? summary.videoTask : null,
    usageSummary: isRecord(row.usageSummary) ? row.usageSummary : undefined,
    memorySummary: isRecord(row.memorySummary) ? row.memorySummary : undefined,
    messagesLoaded: includeMessages,
  };
}
