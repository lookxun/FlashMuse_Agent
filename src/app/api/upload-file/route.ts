import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toUserErrorMessage } from "@/lib/error-message";
import { saveUploadedFileAsset } from "@/lib/local-assets";
import { prisma } from "@/lib/prisma";
import { normalizeMediaAssetUrl } from "@/lib/media-assets";

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
    const body = (await request.json()) as { file?: string; name?: string; conversationId?: string; mediaKind?: string; durationSeconds?: number; dimensions?: unknown };
    const file = body.file?.trim();
    if (!file) return NextResponse.json({ error: "缺少文件" }, { status: 400 });

    const user = await getCurrentUser();
    const url = await saveUploadedFileAsset(file, body.name || "file", { userId: user?.id });
    if (user?.id) {
      const name = body.name?.trim() || "file";
      const mediaType = getFileMediaType(body.mediaKind, name, url);
      const currentCategory = getFileCategory(mediaType);
      const sourcePrompt = getUploadPrompt(mediaType);
      const dimensions = isRecord(body.dimensions) ? body.dimensions : undefined;
      const width = typeof dimensions?.width === "number" ? Math.floor(dimensions.width) : undefined;
      const height = typeof dimensions?.height === "number" ? Math.floor(dimensions.height) : undefined;
      const normalizedUrl = normalizeMediaAssetUrl(url);
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
          conversationId: typeof body.conversationId === "string" ? body.conversationId : undefined,
          workspaceKind: "conversation",
          workspaceId: typeof body.conversationId === "string" ? body.conversationId : undefined,
          width,
          height,
          durationSeconds: typeof body.durationSeconds === "number" ? Math.max(0, Math.floor(body.durationSeconds)) : undefined,
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
          conversationId: typeof body.conversationId === "string" ? body.conversationId : undefined,
          workspaceKind: "conversation",
          workspaceId: typeof body.conversationId === "string" ? body.conversationId : undefined,
          width,
          height,
          durationSeconds: typeof body.durationSeconds === "number" ? Math.max(0, Math.floor(body.durationSeconds)) : undefined,
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
