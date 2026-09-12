import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { assertUserCanUseCredits, isUnauthenticatedError, UNAUTHENTICATED_ERROR_MESSAGE } from "@/lib/credits";
import { createCodedApiError } from "@/lib/error-code";
import { GENERIC_MEDIA_ERROR_MESSAGE } from "@/lib/error-message";
import { createVideoJob } from "@/lib/generation-jobs";
import { isGenerationQuotaError, releaseGenerationQuota, reserveGenerationQuota } from "@/lib/generation-quota";
import { VIDEO_DEPTH_MODEL_ID } from "@/lib/models";
import { DEPTH_OUTPUT_RESOLUTION } from "@/lib/video-depth-size";
import { getUserMembershipTier } from "@/lib/membership-guard";
import { sanitizeMembershipSettings } from "@/lib/membership";
import { normalizeReferenceAssetUrl } from "@/lib/reference-asset-url";
import { createRunningHubDepthTask, MAX_DEPTH_SECONDS } from "@/lib/runninghub";
import { getMembershipSettings, isVideoDepthEnabled } from "@/lib/system-settings";
import { getSourceVideoOwnershipError, resolveSourceVideoDuration } from "@/lib/video-source-asset";
import { appendGenerationDiagnosticsLog } from "@/lib/generation-diagnostics-log";
import { recordGenerationEvent } from "@/lib/analytics-events";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const startedAt = Date.now();
  let quotaRequestId = "";
  let quotaHandedToJob = false;
  let currentUserId: string | undefined;
  const model = VIDEO_DEPTH_MODEL_ID;
  let body: {
    sourceUrl?: string;
    duration?: string;
    durationSeconds?: number;
    ratio?: string;
    resolution?: string;
    width?: number;
    height?: number;
    requestId?: string;
    workflowId?: string;
    workflowNodeId?: string;
    conversationId?: string;
    conversationTitle?: string;
    metadata?: { creditSource?: string };
  } | undefined;
  try {
    body = await request.json().catch(() => undefined);
    const sourceUrl = typeof body?.sourceUrl === "string" ? normalizeReferenceAssetUrl(body.sourceUrl) : "";
    const requestId = typeof body?.requestId === "string" && body.requestId.trim() ? body.requestId.trim() : "";
    if (!sourceUrl) return NextResponse.json({ error: "缺少源视频" }, { status: 400 });
    if (!requestId) return NextResponse.json({ error: "缺少请求编号" }, { status: 400 });
    if (!isVideoDepthEnabled()) return NextResponse.json({ error: "深度动作捕捉未配置或已关闭，请在后台快捷菜单开关里填写 RunningHub API Key 并打开开关。" }, { status: 400 });

    const user = await getCurrentUser();
    currentUserId = user?.id;
    await assertUserCanUseCredits(user, "video");
    // ⭐ 归属校验（对齐 /api/video 的 validateOwnedReferences）：⛔ 不许拿别人目录下的视频来跑深度。
    const ownershipError = getSourceVideoOwnershipError(sourceUrl, user?.id);
    if (ownershipError) return NextResponse.json({ error: ownershipError }, { status: 400 });
    // ⭐⭐ 钱的依据只认服务端实测，且**必须按上游真正会处理的秒数截断**：
    //    RunningHub 那条工作流的 frame_load_cap 只吃前 MAX_DEPTH_SECONDS 秒，
    //    按完整时长收钱 = 对超过上限的源视频多收（⛔ 客户端那个数只在实测失败时兜底）。
    const resolvedDuration = await resolveSourceVideoDuration({ sourceUrl, clientDuration: body?.durationSeconds ?? body?.duration, maxSeconds: MAX_DEPTH_SECONDS });
    const duration = resolvedDuration.durationText ?? body?.duration;
    const membershipTier = getUserMembershipTier(user);
    const membershipSettings = sanitizeMembershipSettings(getMembershipSettings());
    quotaRequestId = requestId;
    await reserveGenerationQuota({
      userId: user?.id,
      requestId,
      tier: membershipTier,
      membershipSettings,
      target: { kind: "video", model, duration, ratio: body?.ratio, resolution: DEPTH_OUTPUT_RESOLUTION },
    });

    const created = await createRunningHubDepthTask({ sourceUrl, duration, durationSeconds: resolvedDuration.seconds ?? body?.durationSeconds, width: body?.width, height: body?.height, requestId });
    const job = await createVideoJob({
      userId: user!.id,
      requestId,
      providerTaskId: created.taskId,
      prompt: "深度动作捕捉",
      model,
      settings: { resolution: DEPTH_OUTPUT_RESOLUTION, duration, ratio: body?.ratio },
      referenceVideos: [sourceUrl],
      conversationId: body?.conversationId ?? body?.workflowId,
      conversationTitle: body?.conversationTitle,
      workflowId: body?.workflowId,
      workflowNodeId: body?.workflowNodeId,
      flow: body?.workflowId ? "workflow" : "conversation",
      creditSource: body?.metadata?.creditSource ?? "workflow_video_depth",
      extra: { enhanceSourceUrl: sourceUrl, sourceWidth: body?.width, sourceHeight: body?.height },
      metadata: (body?.metadata ?? { creditSource: "workflow_video_depth" }) as Prisma.InputJsonValue,
    });
    quotaHandedToJob = true;
    void appendGenerationDiagnosticsLog({ event: "video-depth-create-success", requestId, userId: user?.id, mode: "video", provider: "runninghub", model, taskId: created.taskId, durationMs: Date.now() - startedAt, extra: { duration, durationSource: resolvedDuration.source, probedSeconds: resolvedDuration.probedSeconds, capped: resolvedDuration.capped, clientDuration: body?.duration } });
    return NextResponse.json({ id: created.taskId, status: "running", reservedNames: job.reservedNames ?? undefined });
  } catch (error) {
    if (isUnauthenticatedError(error)) return NextResponse.json({ error: UNAUTHENTICATED_ERROR_MESSAGE }, { status: 401 });
    if (isGenerationQuotaError(error)) return NextResponse.json({ error: error instanceof Error ? error.message : "积分不足，请充值后再使用模型。" }, { status: 402 });
    const codedError = await createCodedApiError(error, GENERIC_MEDIA_ERROR_MESSAGE, "video depth failed");
    void appendGenerationDiagnosticsLog({ event: "video-depth-create-failed", requestId: body?.requestId, userId: currentUserId, mode: "video", provider: "runninghub", model, durationMs: Date.now() - startedAt, error, extra: { errorCode: codedError.errorCode, userError: codedError.error } });
    if (body?.requestId) {
      void recordGenerationEvent({ userId: currentUserId, requestId: body.requestId, kind: "video", creditSource: body.metadata?.creditSource ?? "workflow_video_depth", model, provider: "runninghub", status: "failed", failureReason: codedError.error, failureCode: codedError.errorCode });
    }
    return NextResponse.json(codedError, { status: 500 });
  } finally {
    if (quotaRequestId && !quotaHandedToJob) void releaseGenerationQuota(quotaRequestId);
  }
}
