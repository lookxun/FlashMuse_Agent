import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toUserErrorMessage } from "@/lib/error-message";
import { saveUploadedFileAsset, saveUploadedFileBufferAsset } from "@/lib/local-assets";
import { prisma } from "@/lib/prisma";
import { normalizeMediaAssetUrl } from "@/lib/media-assets";
import { buildMediaAssetRecord, buildUserAssetStateRecord } from "@/lib/media-asset-record";
import { createHash } from "node:crypto";
import { syncGeneratedFilesToAli } from "@/lib/ali-sync";
import { resolveUploadNameInTx, withUploadNameLock } from "@/lib/upload-name";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getFileMediaType(mediaKind: unknown, name: string, url: string) {
  if (mediaKind === "video" || /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(name) || /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url)) return "video";
  if (mediaKind === "audio" || /\.(mp3|wav|m4a|aac|ogg)(\?|#|$)/i.test(name) || /\.(mp3|wav|m4a|aac|ogg)(\?|#|$)/i.test(url)) return "audio";
  return "document";
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
  try {
    const contentType = request.headers.get("content-type") ?? "";
    const user = await getCurrentUser();

    let url: string;
    let name: string;
    let mediaKindRaw: string | undefined;
    let conversationId: string | undefined;
    let durationSeconds: number | undefined;
    let dimensions: Record<string, unknown> | undefined;
    let mimeType: string | undefined;
    let fileSize: number | undefined;
    let contentHash: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      // 二进制流式上传(视频/音频/文档)，避免 base64+JSON 大字符串解析导致的极慢和事件循环阻塞。
      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) return NextResponse.json({ error: "缺少文件" }, { status: 400 });
      name = (formData.get("name") as string | null)?.trim() || file.name || "file";
      mediaKindRaw = (formData.get("mediaKind") as string | null) ?? undefined;
      conversationId = (formData.get("conversationId") as string | null)?.trim() || undefined;
      const durationRaw = formData.get("durationSeconds");
      durationSeconds = typeof durationRaw === "string" && durationRaw.trim() ? Number(durationRaw) : undefined;
      const dimsRaw = formData.get("dimensions");
      if (typeof dimsRaw === "string" && dimsRaw.trim()) {
        try { const parsed = JSON.parse(dimsRaw); if (isRecord(parsed)) dimensions = parsed; } catch { /* ignore */ }
      }
      mimeType = file.type || undefined;
      fileSize = Number.isFinite(file.size) && file.size > 0 ? file.size : undefined;
      const buffer = Buffer.from(await file.arrayBuffer());
      // 出生前先算原始字节哈希；命中"同一文件"直接复用旧地址+旧权威名，不重复落库。
      contentHash = createHash("sha256").update(buffer).digest("hex");
      if (user?.id) {
        const dup = await findDedupUpload(user.id, contentHash);
        if (dup) return NextResponse.json({ url: dup.url, dedup: true, name: dup.name });
      }
      url = await saveUploadedFileBufferAsset(buffer, name, file.type || undefined, { userId: user?.id });
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
      if (user?.id) {
        const dup = await findDedupUpload(user.id, contentHash);
        if (dup) return NextResponse.json({ url: dup.url, dedup: true, name: dup.name });
      }
      url = await saveUploadedFileAsset(file, name, { userId: user?.id });
    }
    // 同步到 Ali 本地镜像，避免 Ali 用户回源代理加载上传的视频/音频/文档极慢。
    void syncGeneratedFilesToAli([url]).catch(() => undefined);
    let resolvedName = name;
    if (user?.id) {
      const userId = user.id;
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
            userId, origin: "upload", flow: "conversation",
            mediaType: mediaType as "video" | "audio" | "document",
            url, normalizedUrl, name: resolved.name,
            originalFileName: name, mimeType, fileSize, contentHash,
            width, height, durationSeconds: normalizedDuration,
            conversationId,
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
    return NextResponse.json({ url, name: resolvedName });
  } catch (error) {
    const message = toUserErrorMessage(error, "文件上传失败，请稍后再试。");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
