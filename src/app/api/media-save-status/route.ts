import { NextResponse } from "next/server";
import { getMediaSaveStatuses } from "@/lib/media-save-queue";
import { getCurrentUser } from "@/lib/auth";
import { canonicalizeSavedMediaJobForUser, getSavedMediaOrigins, normalizeMediaAssetUrl } from "@/lib/media-assets";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { urls?: unknown };
    const urls = Array.isArray(body.urls) ? body.urls.filter((url): url is string => typeof url === "string") : [];
    const user = await getCurrentUser();
    const jobs = await getMediaSaveStatuses(urls, user?.id);
    if (user) await Promise.all(jobs.map((job) => canonicalizeSavedMediaJobForUser(user.id, job)));

    // ⭐ 顺带把「这个媒体属于哪个工作流/节点、叫什么、源提示词」一起回给前端（服务端权威）。
    //   必须在 canonicalize 之后取：那一步才把 MediaAsset 的 url 从远端改成本地。
    //   前端据此不再需要扫所有工作流的画布反查 —— 这是工作流按需加载的前提。
    const origins = user
      ? await getSavedMediaOrigins(user.id, jobs.filter((job) => job.status === "saved" && job.localUrl).map((job) => job.localUrl as string))
      : new Map();

    return NextResponse.json({
      jobs: jobs.map((job) => ({
        id: job.id,
        remoteUrl: job.remoteUrl,
        localUrl: job.localUrl,
        thumbnailUrl: job.thumbnailUrl,
        posterUrl: job.posterUrl,
        posterThumbnailUrl: job.posterThumbnailUrl,
        aliSynced: job.aliSynced,
        aliSyncedAt: job.aliSyncedAt,
        aliSyncError: job.aliSyncError,
        type: job.type,
        status: job.status,
        attempts: job.attempts,
        error: job.error,
        dimensions: job.dimensions,
        expiresAt: job.expiresAt,
        updatedAt: job.updatedAt,
        origin: job.localUrl ? origins.get(normalizeMediaAssetUrl(job.localUrl)) : undefined,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "查询媒体保存状态失败" }, { status: 500 });
  }
}
