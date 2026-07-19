import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toUserErrorMessage } from "@/lib/error-message";
import { saveUploadedFileAsset, saveUploadedFileBufferAsset } from "@/lib/local-assets";
import { prisma } from "@/lib/prisma";
import { normalizeMediaAssetUrl } from "@/lib/media-assets";
import { buildMediaAssetRecord, buildUserAssetStateRecord } from "@/lib/media-asset-record";
import { createHash, randomUUID } from "node:crypto";
import { syncGeneratedFilesToAli } from "@/lib/ali-sync";
import { createUploadedVideoPoster } from "@/lib/video-poster";
import { resolveUploadNameInTx, withUploadNameLock } from "@/lib/upload-name";
import { getBearerToken, verifyUploadToken } from "@/lib/upload-token";
import { validateMediaUploadBuffer, type MediaUploadMetadata, type UploadMediaKind } from "@/lib/media-upload-validation";
import { probeUploadedMedia } from "@/lib/media-upload-probe";
import { appendUploadDiagnosticsLog } from "@/lib/upload-diagnostics-log";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getFileMediaType(mediaKind: unknown, name: string, url: string) {
  if (mediaKind === "video" || /\.(mp4|mov)(\?|#|$)/i.test(name) || /\.(mp4|mov)(\?|#|$)/i.test(url)) return "video";
  if (mediaKind === "audio" || /\.(mp3|wav)(\?|#|$)/i.test(name) || /\.(mp3|wav)(\?|#|$)/i.test(url)) return "audio";
  return "document";
}

const allowedUploadOrigins = new Set(["http://101.37.129.164", "http://101.47.19.109", "https://ali.venusface.com", "https://static.venusface.com", "https://main.venusface.com", "https://api.venusface.com", "http://localhost:3000", "http://127.0.0.1:3000", ...(process.env.UPLOAD_CORS_ORIGINS ?? "").split(",").map((item) => item.trim()).filter(Boolean)]);
function getCorsHeaders(request: Request): Record<string, string> { const origin = request.headers.get("origin") ?? ""; return allowedUploadOrigins.has(origin) ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" } : {}; }
async function getUploadUserId(request: Request) { return verifyUploadToken(getBearerToken(request.headers.get("authorization")))?.userId ?? (await getCurrentUser())?.id; }
export async function OPTIONS(request: Request) { return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) }); }

/** 秒回预检：按内容哈希查是否已上传过同一文件，命中返回旧地址+权威名，免整包重传。 */
export async function GET(request: Request) {
  const headers = getCorsHeaders(request);
  try {
    const userId = await getUploadUserId(request);
    if (!userId) return NextResponse.json({}, { status: 200, headers });
    const contentHash = new URL(request.url).searchParams.get("contentHash")?.trim();
    if (!contentHash) return NextResponse.json({}, { status: 200, headers });
    const dup = await findDedupUpload(userId, contentHash);
    return NextResponse.json(dup ? { url: dup.url, name: dup.name } : {}, { headers });
  } catch {
    return NextResponse.json({}, { status: 200, headers });
  }
}

function getFileCategory(mediaType: string) {
  if (mediaType === "video") return "conversation_upload_videos";
  if (mediaType === "audio") return "conversation_upload_audios";
  return "conversation_upload_documents";
}

function getUploadPrompt(mediaType: string) {
  if (mediaType === "video") return "上传视频";
  if (mediaType === "audio") return "上传音频";
  return "上传文档";
}

/**
 * 按内容哈希查"以前上传过的字节完全一致的同一文件"。命中就复用，不重复落库。
 * 只在已存在可见（未删除/未隐藏/未归档）的资产时返回。文件不物理删除，故不再核对磁盘。
 */
async function findDedupUpload(userId: string, contentHash: string) {
  const existing = await prisma.mediaAsset.findFirst({
    where: { userId, contentHash, archivedAt: null, userStates: { some: { deletedAt: null, hiddenAt: null } } },
    select: { url: true, systemName: true, initialName: true, userStates: { where: { userId }, select: { currentName: true }, take: 1 } },
    orderBy: { firstSeenAt: "asc" },
  });
  if (!existing) return undefined;
  const name = existing.userStates[0]?.currentName?.trim() || existing.systemName?.trim() || existing.initialName?.trim() || undefined;
  return { url: existing.url, name };
}

export async function POST(request: Request) {
  const headers = getCorsHeaders(request);
  const startedAt = Date.now();
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  let diagnosticUserId: string | undefined;
  try {
    const contentType = request.headers.get("content-type") ?? "";
    const userId = await getUploadUserId(request);
    diagnosticUserId = userId;
    if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401, headers });

    let url: string;
    let name: string;
    let mediaKindRaw: string | undefined;
    let conversationId: string | undefined;
    let durationSeconds: number | undefined;
    let dimensions: Record<string, unknown> | undefined;
    let mimeType: string | undefined;
    let fileSize: number | undefined;
    let contentHash: string | undefined;
    let flow: "conversation" | "workflow" = "conversation";
    let workflowId: string | undefined;
    let workflowNodeId: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      // 二进制流式上传(视频/音频/文档)，避免 base64+JSON 大字符串解析导致的极慢和事件循环阻塞。
      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) return NextResponse.json({ error: "缺少文件" }, { status: 400 });
      name = (formData.get("name") as string | null)?.trim() || file.name || "file";
      mediaKindRaw = (formData.get("mediaKind") as string | null) ?? undefined;
      conversationId = (formData.get("conversationId") as string | null)?.trim() || undefined;
      flow = formData.get("flow") === "workflow" ? "workflow" : "conversation";
      workflowId = (formData.get("workflowId") as string | null)?.trim() || undefined;
      workflowNodeId = (formData.get("workflowNodeId") as string | null)?.trim() || undefined;
      const durationRaw = formData.get("durationSeconds");
      durationSeconds = typeof durationRaw === "string" && durationRaw.trim() ? Number(durationRaw) : undefined;
      const dimsRaw = formData.get("dimensions");
      if (typeof dimsRaw === "string" && dimsRaw.trim()) {
        try { const parsed = JSON.parse(dimsRaw); if (isRecord(parsed)) dimensions = parsed; } catch { /* ignore */ }
      }
      mimeType = file.type || undefined;
      fileSize = Number.isFinite(file.size) && file.size > 0 ? file.size : undefined;
      const buffer = Buffer.from(await file.arrayBuffer());
      const requestedKind = mediaKindRaw === "video" || mediaKindRaw === "audio" ? mediaKindRaw as UploadMediaKind : undefined;
      if (requestedKind) {
        const metadata: MediaUploadMetadata = await probeUploadedMedia(buffer, name.split(".").pop() ?? "", requestedKind) ?? { durationSeconds, width: typeof dimensions?.width === "number" ? dimensions.width : undefined, height: typeof dimensions?.height === "number" ? dimensions.height : undefined };
        const validationError = validateMediaUploadBuffer(buffer, { name, type: file.type, size: file.size }, requestedKind, metadata);
        if (validationError) return NextResponse.json({ error: validationError }, { status: 400, headers });
        durationSeconds = metadata.durationSeconds;
        dimensions = metadata.width && metadata.height ? { width: metadata.width, height: metadata.height } : undefined;
      }
      // 出生前先算原始字节哈希；命中"同一文件"直接复用旧地址+旧权威名，不重复落库。
      contentHash = createHash("sha256").update(buffer).digest("hex");
      if (userId) {
        const dup = await findDedupUpload(userId, contentHash);
        if (dup) return NextResponse.json({ url: dup.url, dedup: true, name: dup.name });
      }
      url = await saveUploadedFileBufferAsset(buffer, name, file.type || undefined, { userId });
    } else {
      const body = (await request.json()) as { file?: string; name?: string; conversationId?: string; mediaKind?: string; durationSeconds?: number; dimensions?: unknown };
      const file = body.file?.trim();
      if (!file) return NextResponse.json({ error: "缺少文件" }, { status: 400 });
      name = body.name?.trim() || "file";
      mediaKindRaw = body.mediaKind;
      conversationId = typeof body.conversationId === "string" ? body.conversationId : undefined;
      durationSeconds = typeof body.durationSeconds === "number" ? body.durationSeconds : undefined;
      dimensions = isRecord(body.dimensions) ? body.dimensions : undefined;
      const base64 = file.includes(",") ? file.split(",").pop() ?? "" : file;
      contentHash = createHash("sha256").update(Buffer.from(base64, "base64")).digest("hex");
      if (userId) {
        const dup = await findDedupUpload(userId, contentHash);
        if (dup) return NextResponse.json({ url: dup.url, dedup: true, name: dup.name });
      }
      url = await saveUploadedFileAsset(file, name, { userId });
    }
    // 上传视频即时生成封面（同目录 .poster.jpg），让对话流/资产库上传的视频有首帧封面（与生成视频一致）。
    let posterUrl: string | undefined;
    if (getFileMediaType(mediaKindRaw, name, url) === "video") {
      posterUrl = await createUploadedVideoPoster(url).catch(() => undefined);
    }
    // 同步到 Ali 本地镜像：后台异步、不阻塞响应。文件+封面此刻已在腾讯落地，
    // 前端刚上传的这一会话先读腾讯主源（保证成功即可播放），阿里同步完成后（刷新起）走镜像。
    void syncGeneratedFilesToAli(posterUrl ? [url, posterUrl] : [url]).catch(() => undefined);
    let resolvedName = name;
    if (userId) {
      const mediaType = getFileMediaType(mediaKindRaw, name, url);
      const currentCategory = getFileCategory(mediaType);
      const width = typeof dimensions?.width === "number" ? Math.floor(dimensions.width) : undefined;
      const height = typeof dimensions?.height === "number" ? Math.floor(dimensions.height) : undefined;
      const normalizedUrl = normalizeMediaAssetUrl(url);
      const normalizedDuration = typeof durationSeconds === "number" && Number.isFinite(durationSeconds) ? Math.max(0, Math.floor(durationSeconds)) : undefined;
      // 命名与写入放进同一个持锁事务，服务端权威定名（去扩展名 + 全局唯一），杜绝并发撞名。
      resolvedName = await withUploadNameLock(userId, async (tx) => {
        const resolved = await resolveUploadNameInTx(tx, { userId, originalFileName: name, contentHash });
        const media = await tx.mediaAsset.upsert({
          where: { userId_normalizedUrl: { userId, normalizedUrl } },
          create: buildMediaAssetRecord({
            userId, origin: "upload", flow,
            mediaType: mediaType as "video" | "audio" | "document",
            url, normalizedUrl, name: resolved.name,
            originalFileName: name, mimeType, fileSize, contentHash,
            width, height, durationSeconds: normalizedDuration,
            posterUrl,
            conversationId,
            workflowId,
            workflowNodeId,
          }),
          // 出生即冻结：记录已存在则不覆盖内容。
          update: {},
          select: { id: true, systemName: true, initialName: true },
        });
        await tx.userAssetState.upsert({
          where: { userId_mediaAssetId: { userId, mediaAssetId: media.id } },
          create: buildUserAssetStateRecord({ userId, mediaAssetId: media.id, name: media.systemName ?? resolved.name, initialCategory: currentCategory }),
          update: { hiddenAt: null, hiddenReason: null },
        });
        // 记录已存在（同 url 老资产）时用它的权威名，别用新分配的。
        return media.systemName?.trim() || media.initialName?.trim() || resolved.name;
      });
    }
    return NextResponse.json({ url, name: resolvedName, contentHash, durationSeconds, dimensions, posterUrl }, { headers });
  } catch (error) {
    const message = toUserErrorMessage(error, "文件上传失败，请稍后再试。");
    console.error("[upload] upload-file post failed", { requestId, userId: diagnosticUserId, error });
    void appendUploadDiagnosticsLog({
      event: "upload-file-post-failed",
      requestId,
      userId: diagnosticUserId,
      status: 500,
      durationMs: Date.now() - startedAt,
      error,
      extra: { contentType: request.headers.get("content-type"), userMessage: message },
    });
    return NextResponse.json({ error: message }, { status: 500, headers });
  }
}
