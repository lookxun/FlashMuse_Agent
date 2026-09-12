import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { assertUserCanUseCredits, chargeCredits, isUnauthenticatedError, UNAUTHENTICATED_ERROR_MESSAGE } from "@/lib/credits";
import { generateOpenRouterImage } from "@/lib/openrouter";
import { createCodedApiError } from "@/lib/error-code";
import { GENERIC_MEDIA_ERROR_MESSAGE } from "@/lib/error-message";
import { getExpectedImageDimensions } from "@/lib/models";
import { getMembershipSettings, getUploadRuleOverrides, isAgentImageModelEnabled, isAssetImageModelEnabled, isConversationImageModelEnabled } from "@/lib/system-settings";
import { CONTENT_POLICY_ERROR_CODE, CONTENT_POLICY_ERROR_MESSAGE, enforceContentPolicy } from "@/lib/content-moderation";
import { validateReferenceImageCount } from "@/lib/upload-rules";
import type { Prisma } from "@prisma/client";
import { appendUploadRuleFeedbackLog } from "@/lib/upload-rule-feedback-log";
import { appendGenerationDiagnosticsLog, summarizeGeneratedReference } from "@/lib/generation-diagnostics-log";
import { logPromptLengthOverLimit } from "@/lib/prompt-length-server";
import { recordGenerationEvent } from "@/lib/analytics-events";
import { createImageJob } from "@/lib/generation-jobs";
import { getBytePlusProviderKey } from "@/lib/byteplus-provider-key";
import { normalizeReferenceAssetUrls } from "@/lib/reference-asset-url";
import { resolveUnlockLimitsForUser } from "@/lib/account-features";
import { MEMBERSHIP_MODEL_DENIED_MESSAGE, sanitizeMembershipSettings } from "@/lib/membership";
import { assertMembershipImageAllowed, getUserMembershipTier, isMembershipDeniedError, shouldEnforceMembershipGenerationLimit } from "@/lib/membership-guard";
import { CREDITS_NOT_ENOUGH_MESSAGE, isGenerationQuotaError, releaseGenerationQuota, reserveGenerationQuota } from "@/lib/generation-quota";
import { prisma } from "@/lib/prisma";
import { imageModelEnforcesReferenceImageSizeRules, validateImageReferenceImages, getImageReferenceSizeRule } from "@/lib/image-reference-image-rules";

function normalizeMediaUrlForMatch(value: string) {
  return value.split("?")[0].split("#")[0].replace(/^https?:\/\/[^/]+/, "");
}

function getRequestedImageCount(value: unknown) {
  const count = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 1;
  return Math.min(4, Math.max(1, Math.floor(Number.isFinite(count) ? count : 1)));
}

function mergeImageCreditMetadata(metadata: Prisma.InputJsonValue | undefined, extra: Prisma.InputJsonObject): Prisma.InputJsonValue {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? { ...metadata, ...extra } : extra;
}

function getCreditSource(metadata: Prisma.InputJsonValue | undefined) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) && typeof (metadata as Record<string, unknown>).creditSource === "string" ? (metadata as Record<string, string>).creditSource : undefined;
}

function pickImageDimensions(dimensions: Record<string, { width: number; height: number }> | undefined, urls: string[]) {
  if (!dimensions) return dimensions;
  return Object.fromEntries(urls.map((url) => [url, dimensions[url]]).filter((item): item is [string, { width: number; height: number }] => Boolean(item[1])));
}

function getImageCreditParameterMetadata(settings: { ratio?: string; resolution?: string } | undefined, dimensions: Record<string, { width: number; height: number }> | undefined): Prisma.InputJsonObject {
  const sizes = Object.values(dimensions ?? {}).map((item) => `${item.width}x${item.height}`).filter(Boolean);
  return {
    settings: {
      ratio: settings?.ratio ?? "",
      resolution: settings?.resolution ?? "",
    },
    ratio: settings?.ratio ?? "",
    resolution: settings?.resolution ?? "",
    size: sizes[0] ?? "",
    sizes,
  };
}

function isSameImageDimensions(a: { width: number; height: number } | undefined, b: { width: number; height: number } | undefined) {
  return Boolean(a && b && a.width === b.width && a.height === b.height);
}

function pickRequestedImages(images: string[], dimensions: Record<string, { width: number; height: number }> | undefined, requestedCount: number, model: string | undefined, settings: { ratio?: string; resolution?: string } | undefined) {
  const expected = getExpectedImageDimensions(model, settings?.resolution, settings?.ratio);
  if (!expected.width || !expected.height || !dimensions) return images.slice(0, requestedCount);
  const matched = images.filter((url) => isSameImageDimensions(dimensions[url], expected));
  return (matched.length > 0 ? matched : images).slice(0, requestedCount);
}

function isAssetImageCreditSource(source: string | undefined) {
  return source === "character_image_generation" || source === "scene_image_generation" || source === "prop_image_generation" || source === "shot_image_generation";
}

function isAgentImageCreditSource(source: string | undefined) {
  return source === "agent_image_generation";
}

function isImageModelEnabledForSource(model: string, source: string | undefined) {
  if (isAssetImageCreditSource(source)) return isAssetImageModelEnabled(model);
  // Agent 自动生图：首选（agent 开关）或「图片生成」里已开启的兜底模型都放行。
  if (isAgentImageCreditSource(source)) return isAgentImageModelEnabled(model) || isConversationImageModelEnabled(model);
  return isConversationImageModelEnabled(model);
}

function withChargedUsage<T extends { usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number; usd?: number } }>(result: T, credit: Awaited<ReturnType<typeof chargeCredits>> | undefined) {
  if (!credit || credit.skipped) return result;
  return { ...result, usage: { ...(result.usage ?? {}), usd: credit.chargedUsd, cny: credit.chargedCny } };
}

export async function POST(request: Request) {
  let body: { prompt?: string; sourcePrompt?: string; model?: string; referenceImages?: string[]; settings?: { ratio?: string; resolution?: string; quality?: string }; count?: number; candidateMode?: "all" | "best"; conversationId?: string; conversationTitle?: string; conversationCode?: string; requestId?: string; metadata?: Prisma.InputJsonValue; async?: boolean; workflowId?: string; workflowNodeId?: string; flow?: "conversation" | "workflow"; transparent?: boolean; bgRemove?: boolean; editFunction?: boolean; suppressContentModerationRecord?: boolean } | undefined;
  const routeStartedAt = Date.now();
  // 额度占位的 requestId：走同步路径时要在 finally 里释放（异步 job 由任务落地时释放）。
  let quotaRequestId: string | undefined;
  let quotaHandedToJob = false;
  try {
    body = (await request.json()) as { prompt?: string; sourcePrompt?: string; model?: string; referenceImages?: string[]; settings?: { ratio?: string; resolution?: string; quality?: string }; count?: number; candidateMode?: "all" | "best"; conversationId?: string; conversationTitle?: string; conversationCode?: string; requestId?: string; metadata?: Prisma.InputJsonValue; async?: boolean; workflowId?: string; workflowNodeId?: string; flow?: "conversation" | "workflow"; transparent?: boolean; bgRemove?: boolean; editFunction?: boolean; suppressContentModerationRecord?: boolean };
    const prompt = body.prompt?.trim();

    if (!prompt) {
      return NextResponse.json({ error: "缺少提示词" }, { status: 400 });
    }
    const creditSource = getCreditSource(body.metadata);
    if (body.model && !isImageModelEnabledForSource(body.model, creditSource)) return NextResponse.json({ error: "连接不到模型，请联系管理员！" }, { status: 400 });
    // 参考图统一归一化：剥自家主机绝对前缀 / 把 `/api/media-thumbnail?url=` 还原成原图静态直链
    // （否则平台来拉我们的动态缩略图接口会超时，整个任务失败）。唯一权威见 lib/reference-asset-url.ts。
    const referenceImages = normalizeReferenceAssetUrls(body.referenceImages);
    const referenceLimitError = validateReferenceImageCount({ mode: isAssetImageCreditSource(creditSource) ? "asset-image" : "image", modelId: body.model, transportMode: "local-base64" }, referenceImages.length, getUploadRuleOverrides());
    if (referenceLimitError) return NextResponse.json({ error: referenceLimitError }, { status: 400 });

    const user = await getCurrentUser();
    const membershipTier = getUserMembershipTier(user);
    const membershipSettings = sanitizeMembershipSettings(getMembershipSettings());
    if (shouldEnforceMembershipGenerationLimit({ creditSource, editFunction: body.editFunction })) {
      assertMembershipImageAllowed(membershipTier, body.model, body.settings?.resolution, membershipSettings, body.settings?.ratio);
    }
    // 服务端兜底：参考图边长不合规的直接 400 拦掉（对话流/工作流已在发送前拦，这里保证 Agent、资产库、
    // 任何入口都拦得住）。规则唯一来源 image-reference-image-rules，受约束的模型集合也由它唯一判定。
    // ⚠️ 这道兜底靠 MediaAsset.width/height 查库，历史资产这两列常常是 null（查不到就不拦），
    // 真正拦得住的是前端那道"现场量图"——所以两道都要在，别以为有服务端就够了。
    if (imageModelEnforcesReferenceImageSizeRules(body.model) && referenceImages.length > 0) {
      const rule = getImageReferenceSizeRule(body.model);
      const localReferenceImages = referenceImages.filter((url) => !url.startsWith("asset://") && !url.startsWith("data:"));
      if (rule && localReferenceImages.length > 0) {
        const dimensionRows = await prisma.mediaAsset.findMany({
          where: { normalizedUrl: { in: localReferenceImages.map((url) => normalizeMediaUrlForMatch(url)) } },
          select: { normalizedUrl: true, width: true, height: true, systemName: true },
        }).catch(() => []);
        const dimensionByUrl = new Map(dimensionRows.map((row) => [row.normalizedUrl, row]));
        const sizeError = validateImageReferenceImages(localReferenceImages.map((url) => {
          const row = dimensionByUrl.get(normalizeMediaUrlForMatch(url));
          return { name: row?.systemName ?? undefined, url, width: row?.width ?? undefined, height: row?.height ?? undefined };
        }), rule);
        if (sizeError) {
          void appendGenerationDiagnosticsLog({ event: "image-route-reference-image-size-rejected", requestId: body.requestId, conversationId: body.conversationId, userId: user?.id, mode: "image", model: body.model, error: sizeError, extra: { referenceImageCount: referenceImages.length } });
          return NextResponse.json({ error: sizeError }, { status: 400 });
        }
      }
    }
    const moderationPrompt = (typeof body.sourcePrompt === "string" && body.sourcePrompt.trim()) ? body.sourcePrompt.trim() : prompt;
    const [, policy] = await Promise.all([
      assertUserCanUseCredits(user, "image", body.metadata),
      enforceContentPolicy({ prompt: moderationPrompt, userId: user?.id, requestId: body.requestId, kind: "image", source: creditSource?.startsWith("workflow_") ? "workflow" : isAssetImageCreditSource(creditSource) ? "asset" : creditSource === "agent_image_generation" ? "agent" : "conversation", recordEvent: !body.suppressContentModerationRecord }),
    ]);
    if (policy.blocked) return NextResponse.json({ error: CONTENT_POLICY_ERROR_MESSAGE, errorCode: CONTENT_POLICY_ERROR_CODE }, { status: 400 });
    // ⛔ 并发上限 + 「积分够不够」必须在**花钱之前**原子判定（唯一实现 lib/generation-quota.ts）。
    // 放在内容审核之后：被审核拦下的请求压根不该占额度。
    quotaRequestId = body.requestId?.trim() || undefined;
    await reserveGenerationQuota({
      userId: user?.id,
      requestId: quotaRequestId,
      tier: membershipTier,
      membershipSettings,
      target: { kind: "image", model: body.model, count: body.count, ratio: body.settings?.ratio, resolution: body.settings?.resolution, quality: body.settings?.quality },
    });
    // ⭐ 提示词超字数：**只记日志、不拦**（用户拍板先观察）。唯一实现 lib/prompt-length-server.ts。
    logPromptLengthOverLimit({
      context: { mode: isAssetImageCreditSource(creditSource) ? "asset-image" : "image", modelId: body.model },
      sourcePrompt: moderationPrompt,
      requestId: body.requestId,
      userId: user?.id,
      model: body.model,
      creditSource,
      flow: body.flow,
    });

    // 后端持久任务模式：建 job 立即返回 jobId，由常驻 worker 跑到底（断开/刷新/重启不影响）。
    if (body.async) {
      // 兜底防御（正常走不到：上面 assertUserCanUseCredits 已经先抛 401 了）
      if (!user) return NextResponse.json({ error: UNAUTHENTICATED_ERROR_MESSAGE }, { status: 401 });
      const requestId = body.requestId?.trim();
      if (!requestId) return NextResponse.json({ error: "缺少 requestId" }, { status: 400 });
      const job = await createImageJob({
        userId: user.id,
        requestId,
        prompt,
        model: body.model,
        referenceImages,
        settings: body.settings,
        count: body.count,
        candidateMode: body.candidateMode,
        creditSource,
        conversationId: body.conversationId,
        conversationTitle: body.conversationTitle,
        conversationCode: body.conversationCode,
        workflowId: body.workflowId,
        workflowNodeId: body.workflowNodeId,
        flow: body.flow ?? (creditSource?.startsWith("workflow_") ? "workflow" : "conversation"),
        metadata: body.metadata,
        transparent: body.transparent,
        bgRemove: body.bgRemove,
        editFunction: body.editFunction,
        // 统一存「用户真实提示词」(不含参考图 hint)：与视频 extra.cleanPrompt 一致。
        // finalizeImageJobAsset 会优先用它写 MediaAsset.sourcePrompt；"使用提示词"也读它。
        extra: { cleanPrompt: (typeof body.sourcePrompt === "string" && body.sourcePrompt.trim()) ? body.sourcePrompt : prompt },
      });
      // 占位交给这条 job：worker 跑完（成功或失败）时释放，别在这里删。
      quotaHandedToJob = true;
      return NextResponse.json({ jobId: job.id, requestId: job.requestId, status: job.status, reservedNames: job.reservedNames ?? undefined });
    }

    const requestedImageCount = getRequestedImageCount(body.count);
    void appendGenerationDiagnosticsLog({
      event: "image-route-request-start",
      requestId: body.requestId,
      conversationId: body.conversationId,
      conversationTitle: body.conversationTitle,
      userId: user?.id,
      mode: "image",
      model: body.model,
      prompt,
      settings: body.settings,
      references: referenceImages.map((image, index) => summarizeGeneratedReference(image, index)),
      extra: { requestedImageCount, rawCount: body.count, candidateMode: body.candidateMode, creditSource },
    });
    console.log("[image-generation] api request start", {
      requestId: body.requestId,
      model: body.model,
      bytePlusProviderKey: getBytePlusProviderKey(body.model, creditSource),
      settings: body.settings,
      requestedImageCount,
      referenceCount: referenceImages.length,
      creditSource,
    });
    const result = await generateOpenRouterImage(prompt, referenceImages, {
      model: body.model,
      bytePlusProviderKey: getBytePlusProviderKey(body.model, creditSource),
      settings: body.settings,
      count: body.count,
      candidateMode: body.candidateMode,
      requestId: body.requestId,
      userId: user?.id,
      // 按账号的「解除限制」（后台「帐号功能管理」）。拿不到用户时回落全局开关。
      unlockLimits: await resolveUnlockLimitsForUser(user?.id),
    });
    const providerReturnedImageCount = result.images.length;
    const deliveredImages = pickRequestedImages(result.images, result.imageDimensions, requestedImageCount, body.model, body.settings);
    if (deliveredImages.length === 0) {
      if (referenceImages.length > 0) {
        void appendUploadRuleFeedbackLog({
          source: "image",
          mode: "image",
          model: body.model,
          requestId: body.requestId,
        conversationId: body.conversationId,
        conversationTitle: body.conversationTitle,
          error: "图片平台没有返回图片，且没有返回可用原因。",
          referenceImageCount: referenceImages.length,
          imageCount: referenceImages.length,
          settings: body.settings,
        });
      }
      const codedError = await createCodedApiError(new Error("图片平台没有返回图片，且没有返回可用原因。"), GENERIC_MEDIA_ERROR_MESSAGE, "image-generation empty delivery");
      void appendGenerationDiagnosticsLog({
        event: "image-route-empty-delivery",
        requestId: body.requestId,
        conversationId: body.conversationId,
        conversationTitle: body.conversationTitle,
        userId: user?.id,
        mode: "image",
        model: body.model,
        prompt,
        settings: body.settings,
        references: referenceImages.map((image, index) => summarizeGeneratedReference(image, index)),
        durationMs: Date.now() - routeStartedAt,
        error: codedError.error,
        extra: { requestedImageCount, providerReturnedImageCount },
      });
      void recordGenerationEvent({ userId: user?.id, requestId: body.requestId, kind: "image", creditSource, model: body.model, provider: body.model?.startsWith("byteplus:") ? "byteplus" : "openrouter", status: "failed", failureReason: codedError.error, failureCode: codedError.errorCode, durationMs: Date.now() - routeStartedAt, referenceImageCount: referenceImages.length });
      return NextResponse.json(codedError, { status: 502 });
    }
    const billableImageCount = deliveredImages.length;
    const deliveredImageDimensions = pickImageDimensions(result.imageDimensions, deliveredImages);
    const credit = user ? await chargeCredits(user.id, "image", result.usage, { conversationId: body.conversationId, conversationTitle: body.conversationTitle, requestId: body.requestId, label: "图片生成", model: body.model, imageCount: billableImageCount, metadata: mergeImageCreditMetadata(body.metadata, { ...getImageCreditParameterMetadata(body.settings, deliveredImageDimensions), originalPrompt: body.prompt, requestedImageCount, returnedImageCount: deliveredImages.length, providerReturnedImageCount, billableImageCount, mediaUrls: deliveredImages, allMediaUrls: deliveredImages, extraMediaUrls: [], delivered: deliveredImages.length > 0 }) }) : undefined;
    void appendGenerationDiagnosticsLog({
      event: "image-route-success",
      requestId: body.requestId,
      conversationId: body.conversationId,
      conversationTitle: body.conversationTitle,
      userId: user?.id,
      mode: "image",
      model: body.model,
      prompt,
      settings: body.settings,
      references: referenceImages.map((image, index) => summarizeGeneratedReference(image, index)),
      durationMs: Date.now() - routeStartedAt,
      extra: { requestedImageCount, returnedImageCount: deliveredImages.length, providerReturnedImageCount, billableImageCount, deliveredImages: deliveredImages.map((url, index) => summarizeGeneratedReference(url, index)), dimensions: deliveredImageDimensions, credit },
    });
    void recordGenerationEvent({ userId: user?.id, requestId: body.requestId, kind: "image", creditSource, model: body.model, provider: body.model?.startsWith("byteplus:") ? "byteplus" : "openrouter", status: "success", durationMs: Date.now() - routeStartedAt, referenceImageCount: referenceImages.length });
    return NextResponse.json({ ...withChargedUsage(result, credit), images: deliveredImages, imageDimensions: deliveredImageDimensions, requestedImageCount, returnedImageCount: deliveredImages.length, providerReturnedImageCount, billableImageCount, credit });
  } catch (error) {
    // ⭐ 登录状态已失效：回 401，前端会直接跳首页；且**不记 GenerationEvent**（这不是生成失败）。详见 credits.ts 注释。
    if (isUnauthenticatedError(error)) return NextResponse.json({ error: UNAUTHENTICATED_ERROR_MESSAGE }, { status: 401 });
    if (isMembershipDeniedError(error)) return NextResponse.json({ error: error instanceof Error ? error.message : MEMBERSHIP_MODEL_DENIED_MESSAGE }, { status: 400 });
    // 并发上限 / 积分不足：给用户看原话，且不记成"生成失败"（压根没开始生成）。
    if (isGenerationQuotaError(error)) return NextResponse.json({ error: error instanceof Error ? error.message : CREDITS_NOT_ENOUGH_MESSAGE }, { status: 400 });
    const referenceImageCount = Array.isArray(body?.referenceImages) ? body.referenceImages.length : 0;
    if (referenceImageCount > 0) {
      void appendUploadRuleFeedbackLog({
        source: "image",
        mode: "image",
        model: body?.model,
        requestId: body?.requestId,
        conversationId: body?.conversationId,
        conversationTitle: body?.conversationTitle,
        error,
        referenceImageCount,
        imageCount: referenceImageCount,
        settings: body?.settings,
      });
    }
    const codedError = await createCodedApiError(error, GENERIC_MEDIA_ERROR_MESSAGE, "image-generation request failed", { model: body?.model });
    void appendGenerationDiagnosticsLog({
      event: "image-route-failed",
      requestId: body?.requestId,
      conversationId: body?.conversationId,
      conversationTitle: body?.conversationTitle,
      mode: "image",
      model: body?.model,
      prompt: body?.prompt,
      settings: body?.settings,
      references: Array.isArray(body?.referenceImages) ? body.referenceImages.map((image, index) => summarizeGeneratedReference(image, index)) : undefined,
      durationMs: Date.now() - routeStartedAt,
      error,
      extra: { errorCode: codedError.errorCode, userError: codedError.error, referenceImageCount },
    });
    void recordGenerationEvent({ requestId: body?.requestId, kind: "image", creditSource: getCreditSource(body?.metadata), model: body?.model, provider: body?.model?.startsWith("byteplus:") ? "byteplus" : "openrouter", status: "failed", failureReason: codedError.error, failureCode: codedError.errorCode, durationMs: Date.now() - routeStartedAt, referenceImageCount });
    return NextResponse.json(codedError, { status: 500 });
  } finally {
    // 同步路径：请求结束就把占位还回去。异步 job 的占位由任务落地时释放。
    if (quotaRequestId && !quotaHandedToJob) void releaseGenerationQuota(quotaRequestId);
  }
}
