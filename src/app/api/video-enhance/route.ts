import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { assertUserCanUseCredits, isUnauthenticatedError, UNAUTHENTICATED_ERROR_MESSAGE } from "@/lib/credits";
import { createCodedApiError } from "@/lib/error-code";
import { GENERIC_MEDIA_ERROR_MESSAGE } from "@/lib/error-message";
import { createVideoJob } from "@/lib/generation-jobs";
import { isGenerationQuotaError, releaseGenerationQuota, reserveGenerationQuota } from "@/lib/generation-quota";
import { createBytePlusMediaKitEnhanceTask, createMediaKitEnhanceTask, getVideoEnhanceLabel, isBytePlusVideoEnhanceResolution, isVideoEnhanceResolution, VIDEO_ENHANCE_FAST_MODEL_ID, VIDEO_ENHANCE_MODEL_ID } from "@/lib/mediakit";
import { getUserMembershipTier } from "@/lib/membership-guard";
import { sanitizeMembershipSettings } from "@/lib/membership";
import { normalizeReferenceAssetUrl } from "@/lib/reference-asset-url";
import { getMembershipSettings, isBytePlusVideoEnhanceFastEnabled, isVideoEnhanceEnabled } from "@/lib/system-settings";
import { getSourceVideoOwnershipError, resolveSourceVideoDuration } from "@/lib/video-source-asset";
import { appendGenerationDiagnosticsLog } from "@/lib/generation-diagnostics-log";
import { recordGenerationEvent } from "@/lib/analytics-events";

export const runtime = "nodejs";

function resolveEnhanceModel(value: unknown) {
  if (value === VIDEO_ENHANCE_FAST_MODEL_ID || value === "fast") return VIDEO_ENHANCE_FAST_MODEL_ID;
  return VIDEO_ENHANCE_MODEL_ID;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  let quotaRequestId = "";
  let quotaHandedToJob = false;
  let currentUserId: string | undefined;
  let model = VIDEO_ENHANCE_MODEL_ID;
  let body: {
    sourceUrl?: string;
    resolution?: string;
    duration?: string;
    ratio?: string;
    requestId?: string;
    workflowId?: string;
    workflowNodeId?: string;
    conversationId?: string;
    conversationTitle?: string;
    model?: string;
    variant?: string;
    metadata?: { creditSource?: string };
  } | undefined;
  try {
    body = await request.json().catch(() => undefined);
    const sourceUrl = typeof body?.sourceUrl === "string" ? normalizeReferenceAssetUrl(body.sourceUrl) : "";
    model = resolveEnhanceModel(body?.model ?? body?.variant);
    const isBytePlus = model !== VIDEO_ENHANCE_MODEL_ID;
    const resolution = isBytePlus
      ? (isBytePlusVideoEnhanceResolution(body?.resolution) ? body.resolution : undefined)
      : (isVideoEnhanceResolution(body?.resolution) ? body.resolution : undefined);
    const requestId = typeof body?.requestId === "string" && body.requestId.trim() ? body.requestId.trim() : "";
    if (!sourceUrl) return NextResponse.json({ error: "缺少源视频" }, { status: 400 });
    if (!resolution) return NextResponse.json({ error: "请选择画质增强分辨率" }, { status: 400 });
    if (!requestId) return NextResponse.json({ error: "缺少请求编号" }, { status: 400 });
    if (isBytePlus) {
      if (!isBytePlusVideoEnhanceFastEnabled()) return NextResponse.json({ error: "海外画质增强未配置或已关闭，请在后台模型开关里填写 BytePlus MediaKit API Key 并打开开关。" }, { status: 400 });
    } else if (!isVideoEnhanceEnabled()) {
      return NextResponse.json({ error: "画质增强未配置或已关闭，请在后台模型开关里填写火山引擎 MediaKit API Key 并打开开关。" }, { status: 400 });
    }

    const user = await getCurrentUser();
    currentUserId = user?.id;
    await assertUserCanUseCredits(user, "video");
    // ⭐ 归属校验（对齐 /api/video 的 validateOwnedReferences）：⛔ 不许拿别人目录下的视频来增强。
    const ownershipError = getSourceVideoOwnershipError(sourceUrl, user?.id);
    if (ownershipError) return NextResponse.json({ error: ownershipError }, { status: 400 });
    // ⭐⭐ 钱的依据只认服务端实测：上游不返回成本，扣费全靠这个秒数。
    //    ⛔ 客户端传来的 duration 只在实测失败时当兜底（它能随便报 1 秒来少扣钱）。
    const resolvedDuration = await resolveSourceVideoDuration({ sourceUrl, clientDuration: body?.duration });
    const duration = resolvedDuration.durationText ?? body?.duration;
    const membershipTier = getUserMembershipTier(user);
    const membershipSettings = sanitizeMembershipSettings(getMembershipSettings());
    quotaRequestId = requestId;
    await reserveGenerationQuota({
      userId: user?.id,
      requestId,
      tier: membershipTier,
      membershipSettings,
      target: { kind: "video", model, duration, ratio: body?.ratio, resolution },
    });

    const created = isBytePlus
      ? await createBytePlusMediaKitEnhanceTask({ sourceUrl, resolution, variant: "fast", requestId, clientToken: requestId })
      : await createMediaKitEnhanceTask({ sourceUrl, resolution: resolution === "2K" || resolution === "720p" || resolution === "1080p" ? resolution : "1080p", requestId, clientToken: requestId });
    const label = getVideoEnhanceLabel(model);
    const job = await createVideoJob({
      userId: user!.id,
      requestId,
      providerTaskId: created.taskId,
      prompt: `${label} ${resolution}`,
      model,
      settings: { resolution, duration, ratio: body?.ratio },
      referenceVideos: [sourceUrl],
      conversationId: body?.conversationId ?? body?.workflowId,
      conversationTitle: body?.conversationTitle,
      workflowId: body?.workflowId,
      workflowNodeId: body?.workflowNodeId,
      flow: body?.workflowId ? "workflow" : "conversation",
      creditSource: body?.metadata?.creditSource ?? "workflow_video_enhance",
      extra: { enhanceSourceUrl: sourceUrl },
      metadata: (body?.metadata ?? { creditSource: "workflow_video_enhance" }) as Prisma.InputJsonValue,
    });
    quotaHandedToJob = true;
    void appendGenerationDiagnosticsLog({ event: "video-enhance-create-success", requestId, userId: user?.id, mode: "video", provider: "mediakit", model, taskId: created.taskId, durationMs: Date.now() - startedAt, extra: { resolution, duration, durationSource: resolvedDuration.source, probedSeconds: resolvedDuration.probedSeconds, clientDuration: body?.duration } });
    return NextResponse.json({ id: created.taskId, status: "running", reservedNames: job.reservedNames ?? undefined });
  } catch (error) {
    if (isUnauthenticatedError(error)) return NextResponse.json({ error: UNAUTHENTICATED_ERROR_MESSAGE }, { status: 401 });
    if (isGenerationQuotaError(error)) return NextResponse.json({ error: error instanceof Error ? error.message : "积分不足，请充值后再使用模型。" }, { status: 402 });
    const codedError = await createCodedApiError(error, GENERIC_MEDIA_ERROR_MESSAGE, "video enhance failed");
    void appendGenerationDiagnosticsLog({ event: "video-enhance-create-failed", requestId: body?.requestId, userId: currentUserId, mode: "video", provider: "mediakit", model, durationMs: Date.now() - startedAt, error, extra: { errorCode: codedError.errorCode, userError: codedError.error } });
    if (body?.requestId) {
      void recordGenerationEvent({ userId: currentUserId, requestId: body.requestId, kind: "video", creditSource: body.metadata?.creditSource ?? "workflow_video_enhance", model, provider: "mediakit", status: "failed", failureReason: codedError.error, failureCode: codedError.errorCode });
    }
    return NextResponse.json(codedError, { status: 500 });
  } finally {
    if (quotaRequestId && !quotaHandedToJob) void releaseGenerationQuota(quotaRequestId);
  }
}
