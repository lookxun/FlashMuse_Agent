import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toUserErrorMessage } from "@/lib/error-message";
import { saveUploadedFileAsset, saveUploadedFileBufferAsset } from "@/lib/local-assets";
import { prisma } from "@/lib/prisma";
import { normalizeMediaAssetUrl } from "@/lib/media-assets";
import { syncGeneratedFilesToAli } from "@/lib/ali-sync";

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
      const buffer = Buffer.from(await file.arrayBuffer());
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
      url = await saveUploadedFileAsset(file, name, { userId: user?.id });
    }
    // 同步到 Ali 本地镜像，避免 Ali 用户回源代理加载上传的视频/音频/文档极慢。
    void syncGeneratedFilesToAli([url]).catch(() => undefined);
    if (user?.id) {
      const mediaType = getFileMediaType(mediaKindRaw, name, url);
      const currentCategory = getFileCategory(mediaType);
      const sourcePrompt = getUploadPrompt(mediaType);
      const width = typeof dimensions?.width === "number" ? Math.floor(dimensions.width) : undefined;
      const height = typeof dimensions?.height === "number" ? Math.floor(dimensions.height) : undefined;
      const normalizedUrl = normalizeMediaAssetUrl(url);
      const normalizedDuration = typeof durationSeconds === "number" && Number.isFinite(durationSeconds) ? Math.max(0, Math.floor(durationSeconds)) : undefined;
      const media = await prisma.mediaAsset.upsert({
        where: { userId_normalizedUrl: { userId: user.id, normalizedUrl } },
        create: {
          userId: user.id,
          mediaType,
          url,
          normalizedUrl,
          sourceKind: `conversation_upload_${mediaType}`,
          sourcePrompt,
          promptSource: "upload",
          originalFileName: name,
          systemName: name,
          initialName: name,
          initialCategory: currentCategory,
          conversationId,
          workspaceKind: "conversation",
          workspaceId: conversationId,
          width,
          height,
          durationSeconds: normalizedDuration,
          firstSeenAt: new Date(),
        },
        update: {
          mediaType,
          url,
          sourceKind: `conversation_upload_${mediaType}`,
          sourcePrompt,
          promptSource: "upload",
          originalFileName: name,
          systemName: name,
          initialName: name,
          initialCategory: currentCategory,
          conversationId,
          workspaceKind: "conversation",
          workspaceId: conversationId,
          width,
          height,
          durationSeconds: normalizedDuration,
        },
        select: { id: true },
      });
      await prisma.userAssetState.upsert({
        where: { userId_mediaAssetId: { userId: user.id, mediaAssetId: media.id } },
        create: { userId: user.id, mediaAssetId: media.id, currentName: name, currentCategory, originalCategory: currentCategory, lockedCategory: true, userRenamed: true, userRecategorized: true },
        update: { currentName: name, hiddenAt: null, hiddenReason: null },
      });
    }
    return NextResponse.json({ url });
  } catch (error) {
    const message = toUserErrorMessage(error, "文件上传失败，请稍后再试。");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
