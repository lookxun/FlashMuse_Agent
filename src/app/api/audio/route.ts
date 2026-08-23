import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { assertUserCanUseCredits, chargeCredits, isUnauthenticatedError, UNAUTHENTICATED_ERROR_MESSAGE, type CreditChargeResult } from "@/lib/credits";
import { generateOpenRouterAudio } from "@/lib/openrouter-audio";
import { createCodedApiError } from "@/lib/error-code";
import { GENERIC_MEDIA_ERROR_MESSAGE } from "@/lib/error-message";
import { isAudioModel } from "@/lib/models";
import { isConversationAudioModelEnabled } from "@/lib/system-settings";
import { normalizeAudioVoiceForModel } from "@/lib/audio-voices";
import { applyAudioEmotionToProviderInput, getMiniMaxAudioEmotion, normalizeAudioEmotionForModel } from "@/lib/audio-emotions";
import { CONTENT_POLICY_ERROR_CODE, CONTENT_POLICY_ERROR_MESSAGE, enforceContentPolicy } from "@/lib/content-moderation";
import { recordGenerationEvent } from "@/lib/analytics-events";
import { appendGenerationDiagnosticsLog } from "@/lib/generation-diagnostics-log";
import { prisma } from "@/lib/prisma";
import { buildMediaAssetRecord, buildUserAssetStateRecord, classifyAsset } from "@/lib/media-asset-record";
import { resolvePersistableMediaAssetUrl, normalizeMediaAssetUrl } from "@/lib/media-assets";
import { validateMediaUploadMetadata } from "@/lib/media-upload-validation";
import { probeUploadedMedia } from "@/lib/media-upload-probe";
import { resolveGeneratedFilePath } from "@/lib/generated-asset-path";
import { getUploadRule, normalizeAudioReferenceModeForModel, type AudioReferenceMode } from "@/lib/upload-rules";

/**
 * ⭐ 语音生成（TTS）路由 —— 对话流「语音生成」模式。
 *
 * 与图片/视频不同，TTS 又快又是一次性 HTTP 调用（OpenRouter `/api/v1/audio/speech` 返回音频字节），
 * 所以这里走**同步**：直接出音频 → 落库进资产库（conversation_audios）→ 扣费 → 返回 url。
 * 不进 GenerationJob / worker（TTS 几秒完成，不需要断线续跑那套）。
 *
 * 计费走唯一权威 chargeCredits(kind:"audio")；审核走 enforceContentPolicy(kind:"audio")。
 *
 * 刷新/多标签会带着同一个 requestId 再打一次。没有 job 可轮询，所以：
 * ① 已成功落库的 requestId 直接回上次 url，不再调上游；
 * ② 同进程进行中的同一个 requestId 共用一次上游调用。
 */

const skippedCredit: CreditChargeResult = { chargedCredits: 0, expectedCredits: 0, chargedCny: 0, chargedUsd: 0, skipped: true };

type AudioRouteResult = { url: string; name?: string; characters: number; credit: CreditChargeResult; reused: boolean };

const inflightAudioByRequest = new Map<string, Promise<AudioRouteResult>>();

async function findExistingAudioByRequestId(userId: string, requestId: string | undefined) {
  if (!requestId) return null;
  return prisma.mediaAsset.findFirst({
    where: { userId, requestId, mediaType: "audio" },
    select: { url: true, systemName: true },
    orderBy: { createdAt: "desc" },
  });
}

async function reserveAudioName(tx: Prisma.TransactionClient, userId: string, conversationCode: string | undefined) {
  const code = (conversationCode ?? "").trim() || "d0";
  const prefix = `audio_`;
  const suffix = `_${code}`;
  const rows = await tx.mediaAsset.findMany({
    where: { userId, systemName: { startsWith: prefix } },
    select: { systemName: true },
  });
  const used = new Set(rows.map((r) => r.systemName).filter((n): n is string => Boolean(n)));
  let n = 1;
  while (used.has(`audio_${n}${suffix}`)) n += 1;
  return `audio_${n}${suffix}`;
}

async function persistGeneratedAudio(input: {
  userId: string;
  url: string;
  text: string;
  model: string;
  conversationId?: string;
  conversationCode?: string;
  messageId?: string;
  requestId?: string;
  audioReferenceMode?: AudioReferenceMode;
  referenceAudios?: string[];
}): Promise<{ name?: string; url: string; reused: boolean } | undefined> {
  const resolved = resolvePersistableMediaAssetUrl(input.userId, input.url);
  if (!resolved) return undefined;
  return prisma.$transaction(async (tx) => {
    const scope = `conversation:${input.userId}:${input.conversationId ?? "d0"}:audio`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${scope}))`;
    const existing = input.requestId
      ? await tx.mediaAsset.findFirst({
          where: { userId: input.userId, requestId: input.requestId, mediaType: "audio" },
          select: { url: true, systemName: true },
          orderBy: { createdAt: "desc" },
        })
      : null;
    if (existing?.url) return { name: existing.systemName ?? undefined, url: existing.url, reused: true };
    const name = await reserveAudioName(tx, input.userId, input.conversationCode);
    const initialCategory = classifyAsset({ origin: "generated", flow: "conversation", mediaType: "audio" }).initialCategory;
    const media = await tx.mediaAsset.upsert({
      where: { userId_normalizedUrl: { userId: input.userId, normalizedUrl: resolved.normalizedUrl } },
      create: buildMediaAssetRecord({
        userId: input.userId, origin: "generated", flow: "conversation", mediaType: "audio",
        url: resolved.url, normalizedUrl: resolved.normalizedUrl, originalUrl: resolved.originalUrl,
        name, sourcePrompt: input.text,
        model: input.model, conversationId: input.conversationId, messageId: input.messageId, requestId: input.requestId,
        generationSettings: (input.audioReferenceMode || input.referenceAudios?.length)
          ? {
              audioReferenceMode: input.audioReferenceMode,
              referenceAudios: input.referenceAudios ?? [],
              inputReferences: (input.referenceAudios ?? []).map((url) => ({ url, kind: "audio" })),
            } as Prisma.InputJsonValue
          : undefined,
      }),
      update: { model: input.model, requestId: input.requestId ?? undefined },
      select: { id: true },
    });
    const existingState = await tx.userAssetState.findUnique({ where: { userId_mediaAssetId: { userId: input.userId, mediaAssetId: media.id } }, select: { id: true } });
    if (!existingState) await tx.userAssetState.create({ data: buildUserAssetStateRecord({ userId: input.userId, mediaAssetId: media.id, name, initialCategory }) });
    return { name, url: resolved.url, reused: false };
  });
}

export async function POST(request: Request) {
  const routeStartedAt = Date.now();
    let body: { prompt?: string; text?: string; sourcePrompt?: string; model?: string; voice?: string; emotion?: string; audioReferenceMode?: AudioReferenceMode; referenceAudios?: string[]; conversationId?: string; conversationTitle?: string; conversationCode?: string; messageId?: string; requestId?: string } | undefined;
  let userId: string | undefined;
  try {
    body = (await request.json()) as typeof body;
    const text = (body?.prompt ?? body?.text ?? "").trim();
    if (!text) return NextResponse.json({ error: "缺少要转成语音的文字" }, { status: 400 });
    const model = body?.model;
    if (!model || !isAudioModel(model) || !isConversationAudioModelEnabled(model)) return NextResponse.json({ error: "连接不到模型，请联系管理员！" }, { status: 400 });
    const audioReferenceMode = normalizeAudioReferenceModeForModel(model, body?.audioReferenceMode);
    const referenceAudios = Array.isArray(body?.referenceAudios) ? body.referenceAudios.filter((url): url is string => typeof url === "string" && url.trim().length > 0).map((url) => url.trim()) : [];
    const uploadRule = getUploadRule({ mode: "audio", modelId: model, audioReferenceMode });
    if (audioReferenceMode === "clone") {
      if (referenceAudios.length < 1) return NextResponse.json({ error: "音色克隆必须上传一段参考音频" }, { status: 400 });
      if (referenceAudios.length > uploadRule.audio.maxCount) return NextResponse.json({ error: `当前模型最多支持 ${uploadRule.audio.maxCount} 个参考音频` }, { status: 400 });
    }

    const user = await getCurrentUser();
    await assertUserCanUseCredits(user, "audio");

    const moderationPrompt = (typeof body?.sourcePrompt === "string" && body.sourcePrompt.trim()) ? body.sourcePrompt.trim() : text;
    const policy = await enforceContentPolicy({ prompt: moderationPrompt, userId: user?.id, requestId: body?.requestId, kind: "audio", source: "conversation" });
    if (policy.blocked) return NextResponse.json({ error: CONTENT_POLICY_ERROR_MESSAGE, errorCode: CONTENT_POLICY_ERROR_CODE }, { status: 400 });

    if (!user) return NextResponse.json({ error: UNAUTHENTICATED_ERROR_MESSAGE }, { status: 401 });
    userId = user.id;

    let cloneReferenceUrl = audioReferenceMode === "clone" ? referenceAudios[0] : undefined;
    if (cloneReferenceUrl) {
      const owned = await prisma.mediaAsset.findFirst({
        where: { userId: user.id, mediaType: "audio", archivedAt: null, OR: [{ normalizedUrl: normalizeMediaAssetUrl(cloneReferenceUrl) }, { url: cloneReferenceUrl }], userStates: { some: { userId: user.id, deletedAt: null, hiddenAt: null } } },
        select: { durationSeconds: true, url: true, normalizedUrl: true },
      });
      if (!owned) return NextResponse.json({ error: "参考音频必须来自当前账号已上传的资产" }, { status: 400 });
      let durationSeconds = owned.durationSeconds ?? undefined;
      if (!Number.isFinite(durationSeconds) || !durationSeconds) {
        const filePath = resolveGeneratedFilePath(owned.normalizedUrl || owned.url);
        if (filePath) {
          const probed = await probeUploadedMedia(readFileSync(filePath), extname(filePath).replace(/^\./, ""), "audio");
          durationSeconds = probed?.durationSeconds;
        }
      }
      const durationError = validateMediaUploadMetadata("audio", { durationSeconds }, { minSeconds: uploadRule.audio.minSeconds, maxSeconds: uploadRule.audio.maxSeconds });
      if (durationError) return NextResponse.json({ error: durationError }, { status: 400 });
      cloneReferenceUrl = owned.normalizedUrl || owned.url;
    }

    const existing = await findExistingAudioByRequestId(user.id, body?.requestId);
    if (existing?.url) {
      void appendGenerationDiagnosticsLog({ event: "audio-route-reused", requestId: body?.requestId, conversationId: body?.conversationId, userId: user.id, mode: "audio", model, extra: { url: existing.url, name: existing.systemName } });
      return NextResponse.json({ url: existing.url, name: existing.systemName ?? undefined, characters: 0, credit: skippedCredit, reused: true });
    }

    const emotion = audioReferenceMode === "clone" ? undefined : normalizeAudioEmotionForModel(model, body?.emotion);
    const voice = audioReferenceMode === "clone" ? undefined : normalizeAudioVoiceForModel(model, body?.voice);
    void appendGenerationDiagnosticsLog({ event: "audio-route-request-start", requestId: body?.requestId, conversationId: body?.conversationId, conversationTitle: body?.conversationTitle, userId: user.id, mode: "audio", model, prompt: text, extra: { voice, emotion, audioReferenceMode, referenceAudio: cloneReferenceUrl, characters: [...text].length } });

    const inflightKey = body?.requestId ? `${user.id}:${body.requestId}` : "";
    let work = inflightKey ? inflightAudioByRequest.get(inflightKey) : undefined;
    if (!work) {
      work = (async (): Promise<AudioRouteResult> => {
        const again = await findExistingAudioByRequestId(user.id, body?.requestId);
        if (again?.url) return { url: again.url, name: again.systemName ?? undefined, characters: 0, credit: skippedCredit, reused: true };

        const result = await generateOpenRouterAudio(audioReferenceMode === "clone" ? text : applyAudioEmotionToProviderInput(model, text, emotion), { model, voice, emotion: getMiniMaxAudioEmotion(model, emotion), referenceAudioUrl: cloneReferenceUrl, requestId: body?.requestId, userId: user.id });
        const persisted = await persistGeneratedAudio({
          userId: user.id,
          url: result.url,
          text,
          model,
          conversationId: body?.conversationId,
          conversationCode: body?.conversationCode,
          messageId: body?.messageId,
          requestId: body?.requestId,
          audioReferenceMode,
          referenceAudios: (audioReferenceMode === "clone" && cloneReferenceUrl) ? [cloneReferenceUrl] : (referenceAudios.length > 0 ? referenceAudios : undefined),
        });
        const credit = await chargeCredits(user.id, "audio", { usd: result.usage.usd }, {
          conversationId: body?.conversationId, conversationTitle: body?.conversationTitle, requestId: body?.requestId,
          label: "语音生成", model, metadata: { characters: result.usage.characters, sourcePrompt: text, audioReferenceMode, referenceAudio: cloneReferenceUrl } as Prisma.InputJsonObject,
        });
        return { url: persisted?.url ?? result.url, name: persisted?.name, characters: result.usage.characters, credit, reused: Boolean(persisted?.reused) };
      })().finally(() => {
        if (inflightKey) inflightAudioByRequest.delete(inflightKey);
      });
      if (inflightKey) inflightAudioByRequest.set(inflightKey, work);
    }

    const result = await work;
    void recordGenerationEvent({ userId: user.id, requestId: body?.requestId, kind: "audio", model, provider: "openrouter", status: "success", durationMs: Date.now() - routeStartedAt });
    void appendGenerationDiagnosticsLog({ event: result.reused ? "audio-route-reused" : "audio-route-success", requestId: body?.requestId, conversationId: body?.conversationId, userId: user.id, mode: "audio", model, prompt: text, durationMs: Date.now() - routeStartedAt, extra: { url: result.url, name: result.name, characters: result.characters, credit: result.credit, reused: result.reused } });
    return NextResponse.json({ url: result.url, name: result.name, characters: result.characters, credit: result.credit, reused: result.reused });
  } catch (error) {
    if (isUnauthenticatedError(error)) return NextResponse.json({ error: UNAUTHENTICATED_ERROR_MESSAGE }, { status: 401 });
    const codedError = await createCodedApiError(error, GENERIC_MEDIA_ERROR_MESSAGE, "audio-generation request failed", { model: body?.model });
    void appendGenerationDiagnosticsLog({ event: "audio-route-failed", requestId: body?.requestId, conversationId: body?.conversationId, userId, mode: "audio", model: body?.model, prompt: body?.prompt ?? body?.text, durationMs: Date.now() - routeStartedAt, error, extra: { errorCode: codedError.errorCode, userError: codedError.error } });
    void recordGenerationEvent({ userId, requestId: body?.requestId, kind: "audio", model: body?.model, provider: "openrouter", status: "failed", failureReason: codedError.error, failureCode: codedError.errorCode, durationMs: Date.now() - routeStartedAt });
    return NextResponse.json(codedError, { status: 500 });
  }
}
