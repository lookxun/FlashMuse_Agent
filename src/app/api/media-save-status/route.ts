import { NextResponse } from "next/server";
import { getMediaSaveStatuses } from "@/lib/media-save-queue";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { urls?: unknown };
    const urls = Array.isArray(body.urls) ? body.urls.filter((url): url is string => typeof url === "string") : [];
    const user = await getCurrentUser();
    const jobs = await getMediaSaveStatuses(urls, user?.id);

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
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "查询媒体保存状态失败" }, { status: 500 });
  }
}
