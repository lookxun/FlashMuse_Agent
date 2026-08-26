import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { assertUserCanUseCredits, chargeCredits, isUnauthenticatedError, recordCreditFailure, UNAUTHENTICATED_ERROR_MESSAGE } from "@/lib/credits";
import { toUserErrorMessage } from "@/lib/error-message";
import { sendToOpenRouter } from "@/lib/openrouter";
import { CONTENT_POLICY_ERROR_CODE, CONTENT_POLICY_ERROR_MESSAGE, enforceContentPolicy } from "@/lib/content-moderation";
import { DEFAULT_CHAT_MODEL, isModelName } from "@/lib/models";
import { createCodedApiError } from "@/lib/error-code";
import type { Prisma } from "@prisma/client";
import { appendUploadRuleFeedbackLog, summarizeMessageUploads } from "@/lib/upload-rule-feedback-log";
import { getAgentAutoChatModelIds, getUploadRuleOverrides, isRetryableAgentChatError, rememberAgentChatModelSkip } from "@/lib/system-settings";
import { validateReferenceImageCount } from "@/lib/upload-rules";
import { resolveUnlockLimitsForUser } from "@/lib/account-features";

function mergeChatCreditMetadata(metadata: Prisma.InputJsonValue | undefined, extra: Prisma.InputJsonObject): Prisma.InputJsonValue {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? { ...metadata, ...extra } : extra;
}

function getCreditSource(metadata: Prisma.InputJsonValue | undefined) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Record<string, unknown>).creditSource : undefined;
}

function isPromptToolCreditSource(value: unknown) {
  return value === "image_prompt_reverse" || value === "prompt_optimization";
}

function shouldRecordPromptToolFailure(metadata: Prisma.InputJsonValue | undefined) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? Boolean((metadata as Record<string, unknown>).recordFailure) : false;
}

function withChargedUsage<T extends { usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number; usd?: number } }>(result: T, credit: Awaited<ReturnType<typeof chargeCredits>> | undefined) {
  if (!credit || credit.skipped) return result;
  return { ...result, usage: { ...(result.usage ?? {}), usd: credit.chargedUsd, cny: credit.chargedCny } };
}

export async function POST(request: Request) {
  let body: {
    model?: string;
    models?: string[];
    mode?: "agent" | "general" | "chat" | "image" | "video";
    messages?: Array<{ role: "user" | "assistant"; content: string; images?: string[] }>;
    settings?: {
      ratio?: string;
      resolution?: string;
      style?: string;
      duration?: string;
    };
    originalPrompt?: string;
    conversationId?: string;
    conversationTitle?: string;
        requestId?: string;
    metadata?: Prisma.InputJsonValue;
    stream?: boolean;
  } | undefined;
  let model = DEFAULT_CHAT_MODEL;
  let user: Awaited<ReturnType<typeof getCurrentUser>> = null;

  try {
    body = (await request.json()) as {
      model?: string;
      mode?: "agent" | "general" | "chat" | "image" | "video";
      messages?: Array<{ role: "user" | "assistant"; content: string; images?: string[] }>;
      settings?: {
        ratio?: string;
        resolution?: string;
        style?: string;
        duration?: string;
      };
      originalPrompt?: string;
      conversationId?: string;
      conversationTitle?: string;
        requestId?: string;
        metadata?: Prisma.InputJsonValue;
        stream?: boolean;
      };

    model = body.model || DEFAULT_CHAT_MODEL;
    const chatModels = body.mode === "agent"
      ? (getAgentAutoChatModelIds(model).length > 0 ? getAgentAutoChatModelIds(model) : [model])
      : [model];

    if ((model !== "openai/gpt-5.5" && !isModelName(model)) || !body.mode || !Array.isArray(body.messages)) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }

    if (body.mode !== "agent" && body.mode !== "general" && body.mode !== "chat" && body.mode !== "image" && body.mode !== "video") {
      return NextResponse.json({ error: "对话模式不正确" }, { status: 400 });
    }

    const uploadSummary = summarizeMessageUploads(body.messages);
    const referenceLimitError = validateReferenceImageCount({ mode: body.mode === "general" ? "general" : "agent", modelId: model, transportMode: "local-base64" }, uploadSummary.imageCount, getUploadRuleOverrides());
    if (referenceLimitError) return NextResponse.json({ error: referenceLimitError }, { status: 400 });

    user = await getCurrentUser();
    if (body.mode === "general" && !user?.generalModeEnabled) {
      return NextResponse.json({ error: "通用模式未开通" }, { status: 403 });
    }
    const shouldModerateChat = body.mode === "agent" || body.mode === "general";
    const moderationPrompt = shouldModerateChat ? [...(body.messages ?? [])].reverse().find((message) => message.role === "user")?.content ?? "" : "";
    const [, policy, unlockLimits] = await Promise.all([
      assertUserCanUseCredits(user, "text", body.metadata),
      shouldModerateChat
        ? enforceContentPolicy({ prompt: moderationPrompt, userId: user?.id, requestId: body.requestId, kind: "chat", source: body.mode })
        : Promise.resolve({ blocked: false as const }),
      resolveUnlockLimitsForUser(user?.id),
    ]);
    if (policy.blocked) return NextResponse.json({ error: CONTENT_POLICY_ERROR_MESSAGE, errorCode: CONTENT_POLICY_ERROR_CODE }, { status: 400 });
    const creditLabel = body.mode === "agent" ? "Agent 回复" : body.mode === "general" ? "通用回复" : "提示词整理";
    const creditRequestId = body.requestId ? `${body.requestId}:chat` : undefined;
    const shouldStream = Boolean(body.stream) && (body.mode === "agent" || body.mode === "general");

    if (shouldStream) {
      const streamMode = body.mode;
      const streamMessages = body.messages;
      const streamSettings = body.settings;
      const streamOriginalPrompt = body.originalPrompt;
      const streamConversationId = body.conversationId;
      const streamConversationTitle = body.conversationTitle;
      const streamMetadata = body.metadata;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const send = (payload: unknown) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
          };
          try {
            let result: Awaited<ReturnType<typeof sendToOpenRouter>> | undefined;
            let lastError: unknown;
            let usedModel = model;
            const streamModels = [model];
            for (const chatModel of streamModels) {
              try {
                result = await sendToOpenRouter({
                  model: chatModel,
                  mode: streamMode,
                  messages: streamMessages,
                  settings: streamSettings,
                  originalPrompt: streamOriginalPrompt,
                  unlockLimits,
                  streamHandlers: {
                    onReasoning: (piece) => send({ reasoning: piece }),
                    onDelta: (piece) => {
                      send({ delta: piece });
                    },
                  },
                });
                usedModel = chatModel;
                lastError = undefined;
                break;
              } catch (error) {
                lastError = error;
                rememberAgentChatModelSkip(chatModel, error);
                if (!isRetryableAgentChatError(error)) throw error;
              }
            }
            if (!result) throw lastError instanceof Error ? lastError : new Error("连接不到模型，请联系管理员！");
            if (isPromptToolCreditSource(getCreditSource(streamMetadata)) && !result.content.trim()) {
              throw new Error("服务器繁忙，请稍候再试！");
            }
            const hasBillableUsage = (result.usage?.usd ?? 0) > 0;
            const credit = user && hasBillableUsage ? await chargeCredits(user.id, "text", result.usage, { conversationId: streamConversationId, conversationTitle: streamConversationTitle, requestId: creditRequestId, label: creditLabel, model: usedModel, metadata: mergeChatCreditMetadata(streamMetadata, { outputPrompt: result.content ?? "" }) }) : undefined;
            send({ done: true, ...withChargedUsage(result, credit), credit, model: usedModel });
          } catch (error) {
            if (isUnauthenticatedError(error)) {
              send({ error: UNAUTHENTICATED_ERROR_MESSAGE, status: 401 });
            } else {
              const codedError = await createCodedApiError(error, "对话请求失败，请稍后再试。", `chat request failed mode=${body?.mode ?? "unknown"} model=${model} requestId=${body?.requestId ?? ""}`);
              send({ error: codedError.error ?? "对话请求失败，请稍后再试。", errorCode: codedError.errorCode });
            }
          }
          controller.close();
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    let result: Awaited<ReturnType<typeof sendToOpenRouter>> | undefined;
    let lastError: unknown;
    let usedModel = model;
    for (const chatModel of chatModels) {
      try {
        result = await sendToOpenRouter({
          model: chatModel,
          mode: body.mode,
          messages: body.messages,
          settings: body.settings,
          originalPrompt: body.originalPrompt,
          unlockLimits,
        });
        usedModel = chatModel;
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        rememberAgentChatModelSkip(chatModel, error);
        if (!isRetryableAgentChatError(error)) throw error;
      }
    }
    if (!result) throw lastError instanceof Error ? lastError : new Error("连接不到模型，请联系管理员！");
    if (isPromptToolCreditSource(getCreditSource(body.metadata)) && !result.content.trim()) {
      throw new Error("服务器繁忙，请稍候再试！");
    }
    const credit = user ? await chargeCredits(user.id, "text", result.usage, { conversationId: body.conversationId, conversationTitle: body.conversationTitle, requestId: creditRequestId, label: creditLabel, model: usedModel, metadata: mergeChatCreditMetadata(body.metadata, { outputPrompt: result.content ?? "" }) }) : undefined;

    return NextResponse.json({ ...withChargedUsage(result, credit), credit });
    } catch (error) {
      // ⭐ 登录状态已失效：回 401，前端会直接跳首页（不弹提示、不记失败）。详见 credits.ts 注释。
      if (isUnauthenticatedError(error)) return NextResponse.json({ error: UNAUTHENTICATED_ERROR_MESSAGE }, { status: 401 });
      const uploadSummary = summarizeMessageUploads(body?.messages);

    if (uploadSummary.imageCount > 0 || uploadSummary.documentCount > 0) {
      void appendUploadRuleFeedbackLog({
        source: "chat",
        mode: body?.mode,
        model,
        requestId: body?.requestId,
        conversationId: body?.conversationId,
        conversationTitle: body?.conversationTitle,
        error,
        ...uploadSummary,
      });
    }
    if (user?.id && body && isPromptToolCreditSource(getCreditSource(body.metadata)) && shouldRecordPromptToolFailure(body.metadata)) {
      await recordCreditFailure(user.id, "text", {
        conversationId: body.conversationId,
        conversationTitle: body.conversationTitle,
        requestId: body.requestId ? `${body.requestId}:chat` : undefined,
        label: body.mode === "agent" ? "Agent 回复" : body.mode === "general" ? "通用回复" : "提示词整理",
        model,
        metadata: mergeChatCreditMetadata(body.metadata, { status: "failed", failureReason: toUserErrorMessage(error, "服务器繁忙，请稍候再试！") }),
      }).catch(() => undefined);
    }
    const codedError = await createCodedApiError(error, "对话请求失败，请稍后再试。", `chat request failed mode=${body?.mode ?? "unknown"} model=${model} requestId=${body?.requestId ?? ""}`);
    return NextResponse.json(codedError, { status: 500 });
  }
}
