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
/**
 * 一次回给前端的消息条数。⭐ **2026-07-30 由 50 降到 30**（性能优化）。
 *
 * 为什么：条数上限本身早就有，但**单条消息很重** —— 线上实测正式服重度用户
 * 平均 **8~18 KB/条**（图文消息里有图片地址、参考图、缩略图信息、提示词、尺寸…），
 * 50 条就是 **415~785 KB**，是「打开工作台转圈 30 秒」的三大元凶之一。
 * 30 条对首屏完全够看，往上滚有「加载更早的消息」（`messagesHasMore` + `messagesBeforeCursor`，
 * 前端 `chat-workbench.tsx:9638` 那套已有分页），语义不变。
 * ⭐ 想再调小/调大只改这一个常量，GET 全量分支和 `/api/workspace-session` 都跟着走。
 */
export const DEFAULT_WORKSPACE_MESSAGE_LIMIT = 30;

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

function getPromptDetail(value: unknown) {
  if (!isRecord(value)) return undefined;
  const prompt = getString(value.prompt).trim();
  const constraints = Array.isArray(value.constraints) ? value.constraints.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()) : [];
  if (!prompt && constraints.length === 0) return undefined;
  return { prompt, constraints };
}

function getPromptSourceDetail(detail: { constraints?: string[] } | undefined) {
  const constraints = detail?.constraints?.filter(Boolean) ?? [];
  return constraints.length > 0 ? JSON.stringify({ agentConstraints: constraints }) : undefined;
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
    const items: Array<{ url: string; mediaType: "image" | "video"; category: string; sourceKind: string; sourcePrompt?: string; sourceDetail?: string; promptSource: string; name?: string; posterUrl?: string; width?: number; height?: number; videoDuration?: string }> = [];

    if (role === "user") {
      for (const url of getMessageImageUrls(message).filter((item) => /\/generated\/(?:users\/[^/]+\/)?upload_image\//.test(normalizeMediaUrl(item)))) {
        items.push({ url, mediaType: "image", category: "conversation_uploads", sourceKind: "conversation_upload_image", sourcePrompt: UPLOAD_IMAGE_PROMPT_PLACEHOLDER, promptSource: "upload" });
      }
    }

    if (role === "assistant") {
      const imagePrompts = isRecord(message.imagePrompts) ? message.imagePrompts : undefined;
      const imagePromptDetails = isRecord(message.imagePromptDetails) ? message.imagePromptDetails : undefined;
      const videoPrompts = isRecord(message.videoPrompts) ? message.videoPrompts : undefined;
      const videoPromptDetails = isRecord(message.videoPromptDetails) ? message.videoPromptDetails : undefined;
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
        const detail = getPromptDetail(imagePromptDetails?.[url]);
        items.push({ url, mediaType: "image", category: "conversation_images", sourceKind: "conversation_generation_image", sourcePrompt: detail?.prompt || getString(imagePrompts?.[url], originalPrompt), sourceDetail: getPromptSourceDetail(detail), promptSource: "generated", width: dim?.width, height: dim?.height });
      }

      for (const url of getMessageVideoUrls(message)) {
        const dim = getDimension(videoDimensionsMap?.[url]) || getDimension(message.videoDimensions);
        const detail = getPromptDetail(videoPromptDetails?.[url]);
        items.push({ url, mediaType: "video", category: "conversation_videos", sourceKind: "conversation_generation_video", sourcePrompt: detail?.prompt || getString(videoPrompts?.[url], originalPrompt), sourceDetail: getPromptSourceDetail(detail), promptSource: "generated", posterUrl: getString(videoPosters?.[url]), width: dim?.width, height: dim?.height, videoDuration: getString(settings?.duration) });
      }
    }

    for (const item of items) {
      const resolved = resolvePersistableMediaAssetUrl(userId, item.url, { posterUrl: item.posterUrl });
      if (!resolved) continue;
      const normalizedUrl = resolved.normalizedUrl;
      const systemName = getString(mediaSystemNames?.[item.url]) || item.name;
      const media = await prisma.mediaAsset.upsert({
        where: { userId_normalizedUrl: { userId, normalizedUrl } },
        create: { userId, mediaType: item.mediaType || mediaTypeFromUrl(normalizedUrl), url: resolved.url, normalizedUrl, originalUrl: resolved.originalUrl, posterUrl: resolved.posterUrl || undefined, thumbnailUrl: resolved.thumbnailUrl || undefined, sourceKind: item.sourceKind, sourceDetail: item.sourceDetail, sourcePrompt: item.sourcePrompt, promptSource: item.promptSource, model: getString(meta?.model) || undefined, ratio: getString(settings?.ratio) || undefined, resolution: getString(settings?.resolution) || undefined, imageSize: getString(settings?.imageSize || settings?.size) || undefined, videoDuration: item.videoDuration || undefined, generationSettings: settings as Prisma.InputJsonValue | undefined, width: item.width, height: item.height, systemName: systemName || undefined, initialName: systemName || undefined, initialCategory: item.category, conversationId: sessionId, messageId, workspaceKind: "conversation", workspaceId: sessionId, requestId: getString(message.requestId) || undefined, firstSeenAt: createdAt },
        // 出生即冻结：这是"兜底"路径，只在权威写入者（生成 worker / 上传接口）漏建时才补建一条；
        // 记录已存在则绝不覆盖内容（历史 bug：这里曾每次保存对话流都把参数/归类/终生ID 全覆盖）。
        update: {},
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
        workspaceKind: "conversation",
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

/**
 * ⭐⭐ **PUT 侧的配对操作：把下行投影省掉的字段补回去**（和 `projectWorkspaceMessageForClient` 严格配对）。
 *
 * 为什么必须有它：GET 时我们把重复的提示词副本省掉了，前端拿到的是瘦身版；
 * 前端保存时会把这份瘦身版**原样 PUT 回来**，而 `upsertWorkspaceMessages` 是
 * `messageJson: message` **整体覆盖** → 不补回来，库里那几个字段就**真的被删了**。
 * （同 `workspace-workflows.ts` 的 `mergeWorkflowCanvasMedia`：客户端 payload 缺的，用库里的补。）
 *
 * ⛔ 只恢复"投影会省掉的那三个字段"，**不做全量深合并** ——
 * 否则前端**故意**删掉的东西会被复活（比如清空某个字段），那是另一类 bug。
 * ⛔ incoming 里已经有该字段时**一律用 incoming 的**（前端可能真的改了提示词）。
 * ⭐ 改了这里就必须回头看 `projectWorkspaceMessageForClient`，两边字段清单必须一致。
 */
function restoreProjectedMessageFields(incoming: Record<string, unknown>, existing: unknown) {
  if (!isRecord(existing)) return incoming;
  const next: Record<string, unknown> = { ...incoming };

  if (!("videoPrompts" in next) && isRecord(existing.videoPrompts)) next.videoPrompts = existing.videoPrompts;

  const existingMeta = isRecord(existing.generationMeta) ? existing.generationMeta : undefined;
  if (existingMeta) {
    const incomingMeta = isRecord(next.generationMeta) ? { ...next.generationMeta } : {};
    if (!("originalPrompt" in incomingMeta) && typeof existingMeta.originalPrompt === "string") incomingMeta.originalPrompt = existingMeta.originalPrompt;
    if (!("itemPrompts" in incomingMeta) && Array.isArray(existingMeta.itemPrompts)) incomingMeta.itemPrompts = existingMeta.itemPrompts;
    if (Object.keys(incomingMeta).length > 0) next.generationMeta = incomingMeta;
  }

  return next;
}

export async function upsertWorkspaceMessages(userId: string, sessionId: string, messages: unknown[]) {
  const validMessages = messages.filter(isRecord).filter((message) => getMessageId(message));
  if (validMessages.length === 0) return;

  // 先把库里已有的这批消息读出来，用于补回下行投影省掉的字段（见 restoreProjectedMessageFields）。
  const existingByMessageId = new Map<string, unknown>();
  try {
    const existingRows = await prisma.workspaceMessage.findMany({
      where: { userId, sessionId, messageId: { in: validMessages.map((message) => getMessageId(message)).filter(Boolean) as string[] } },
      select: { messageId: true, messageJson: true },
    });
    for (const row of existingRows) existingByMessageId.set(row.messageId, row.messageJson);
  } catch (error) {
    // 读失败就退化成"原样覆盖"（和改动前行为一致），不因为这个可选优化把保存整条链路搞挂。
    console.warn("[workspace-sessions] load existing messages for field restore failed", { userId, sessionId, error: error instanceof Error ? error.message : String(error) });
  }

  for (let index = 0; index < validMessages.length; index += 50) {
    const chunk = validMessages.slice(index, index + 50);
    await prisma.$transaction(
      chunk.map((message) => {
        const messageId = getMessageId(message);
        const restored = restoreProjectedMessageFields(message, existingByMessageId.get(messageId ?? ""));
        const data = {
          role: getMessageRole(restored),
          content: getMessageContent(restored),
          createdAt: toDate(restored.createdAt),
          messageJson: restored as Prisma.InputJsonObject,
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
  return rows.map((row) => projectWorkspaceMessageForClient(sanitizeWorkspaceMessage(row.messageJson))).filter(isRecord);
}

/**
 * ⭐⭐ **下行投影：把"同一份提示词的重复副本"从响应里拿掉**（2026-07-30 性能优化，实测根因）。
 *
 * 线上实测（正式服重度用户，活跃会话 50 条消息共 633 KB）：
 * | 字段 | 占比 |
 * |---|---|
 * | `generationMeta.itemPrompts`   | 138.6 KB / 47.9% of generationMeta |
 * | `generationMeta.originalPrompt`| 138.5 KB / 47.8% of generationMeta |
 * | `videoPrompts`（值）           | 134.2 KB |
 * | `content`                      | 138.8 KB |
 * → **这四个装的基本是同一批提示词**，550 KB 里约 415 KB 是重复。
 *
 * ⭐ 而前端读取本来就是**层层回落**（`chat-workbench.tsx` 多处）：
 *   `message.videoPrompts?.[url] ?? generationMeta?.itemPrompts?.[i] ?? generationMeta?.originalPrompt ?? message.content`
 * 所以只要"值完全相同"，少发一层，前端自动回落到下一层，**显示结果一模一样、前端一行都不用改**。
 *
 * ⛔⛔ 三条铁规则（都是为了绝对不改变语义，别放松）：
 *  ① **只在"整体完全相等"时才省，绝不逐项省**。
 *     `itemPrompts` 是**按下标**取的数组、`videoPrompts` 的回落目标又是 `itemPrompts[i]` ——
 *     逐项删会让下标错位、或回落到**另一条**提示词上，那就是真 bug 了。
 *  ② **只影响下行响应，不动数据库**。库里那份原封不动（PUT 走的是另一条路径），
 *     所以万一将来发现问题，删掉这个函数调用就能立刻恢复原样。
 *  ③ 比较必须是**严格字符串相等**，不做 trim / 大小写归一 —— 差一个空格就老老实实发原样。
 */
export function projectWorkspaceMessageForClient(value: unknown) {
  if (!isRecord(value)) return value;
  const next: Record<string, unknown> = { ...value };
  const meta = isRecord(next.generationMeta) ? { ...next.generationMeta } : undefined;
  const content = typeof next.content === "string" ? next.content : undefined;
  const originalPrompt = meta && typeof meta.originalPrompt === "string" ? meta.originalPrompt : undefined;
  // 提示词的"最终回落值"：itemPrompts / videoPrompts 都能落到它身上。
  const baseline = originalPrompt ?? content;

  if (meta) {
    // itemPrompts：每一项都等于 baseline 才整体省掉（回落 → originalPrompt / content，值相同）。
    if (Array.isArray(meta.itemPrompts) && baseline !== undefined && meta.itemPrompts.length > 0 && meta.itemPrompts.every((item) => item === baseline)) {
      delete meta.itemPrompts;
    }
    // originalPrompt === content 时省掉（回落 → content，值相同）。
    // ⚠️ 必须在 itemPrompts 判定**之后**做，否则上面的 baseline 会先失去 originalPrompt。
    if (typeof meta.originalPrompt === "string" && content !== undefined && meta.originalPrompt === content) {
      delete meta.originalPrompt;
    }
    if (Object.keys(meta).length > 0) next.generationMeta = meta; else delete next.generationMeta;
  }

  // videoPrompts：只有"所有值都等于 baseline"且 itemPrompts 已不构成不同回落时才整体省。
  if (isRecord(next.videoPrompts) && baseline !== undefined) {
    const metaAfter = isRecord(next.generationMeta) ? next.generationMeta : undefined;
    const itemPromptsStillDiffer = Array.isArray(metaAfter?.itemPrompts);
    const values = Object.values(next.videoPrompts);
    if (!itemPromptsStillDiffer && values.length > 0 && values.every((item) => item === baseline)) {
      delete next.videoPrompts;
    }
  }

  return next;
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
