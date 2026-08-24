import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { assertUserCanUseCredits, chargeCredits, isUnauthenticatedError, UNAUTHENTICATED_ERROR_MESSAGE } from "@/lib/credits";
import { planAgentTask } from "@/lib/openrouter";
import { CONTENT_POLICY_ERROR_CODE, CONTENT_POLICY_ERROR_MESSAGE, enforceContentPolicy } from "@/lib/content-moderation";
import { DEFAULT_CHAT_MODEL, isModelName } from "@/lib/models";
import { createCodedApiError } from "@/lib/error-code";
import { appendGeneralTaskLog } from "@/lib/general-task-log";
import { appendUploadRuleFeedbackLog, summarizeMessageUploads } from "@/lib/upload-rule-feedback-log";
import { resolveUnlockLimitsForUser } from "@/lib/account-features";
import { getAgentAutoChatModelIds, isRetryableAgentChatError, rememberAgentChatModelSkip } from "@/lib/system-settings";

function withChargedUsage<T extends { usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number; usd?: number } }>(result: T, credit: Awaited<ReturnType<typeof chargeCredits>> | undefined) {
  if (!credit || credit.skipped) return result;
  return { ...result, usage: { ...(result.usage ?? {}), usd: credit.chargedUsd, cny: credit.chargedCny } };
}

export async function POST(request: Request) {
  let body: {
    model?: string;
    messages?: Array<{ role: "user" | "assistant"; content: string; images?: string[] }>;
    conversationId?: string;
    conversationTitle?: string;
    requestId?: string;
    mode?: "agent" | "general";
  } | undefined;

  try {
    body = (await request.json()) as {
      model?: string;
      messages?: Array<{ role: "user" | "assistant"; content: string; images?: string[] }>;
      conversationId?: string;
      conversationTitle?: string;
      requestId?: string;
      mode?: "agent" | "general";
    };

    const requestedModel = body.model || DEFAULT_CHAT_MODEL;
    const planModels = body.mode === "general"
      ? [requestedModel]
      : (getAgentAutoChatModelIds(requestedModel).length > 0 ? getAgentAutoChatModelIds(requestedModel) : [requestedModel]);
    if (!isModelName(requestedModel) || !Array.isArray(body.messages)) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }

    const user = await getCurrentUser();
    if (body.mode === "general" && !user?.generalModeEnabled) {
      return NextResponse.json({ error: "通用模式未开通" }, { status: 403 });
    }
    const moderationPrompt = [...body.messages].reverse().find((message) => message.role === "user")?.content ?? "";
    const [, policy, unlockLimits] = await Promise.all([
      assertUserCanUseCredits(user, "text"),
      enforceContentPolicy({ prompt: moderationPrompt, userId: user?.id, requestId: body.requestId, kind: "chat", source: body.mode === "general" ? "general" : "agent" }),
      resolveUnlockLimitsForUser(user?.id),
    ]);
    if (policy.blocked) return NextResponse.json({ error: CONTENT_POLICY_ERROR_MESSAGE, errorCode: CONTENT_POLICY_ERROR_CODE }, { status: 400 });
    let result: Awaited<ReturnType<typeof planAgentTask>> | undefined;
    let lastError: unknown;
    let usedModel = requestedModel;
    for (const chatModel of planModels) {
      try {
        result = await planAgentTask({ model: chatModel, messages: body.messages, mode: body.mode === "general" ? "general" : "agent", unlockLimits });
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
    if (body.mode === "general") {
      const latestUserMessage = [...body.messages].reverse().find((message) => message.role === "user");
      void appendGeneralTaskLog({
        userId: user?.id,
        conversationId: body.conversationId,
        conversationTitle: body.conversationTitle,
        requestId: body.requestId,
        model: usedModel,
        taskText: latestUserMessage?.content,
        intent: result.intent,
        needsClarification: result.needsClarification,
        hasImages: Boolean(latestUserMessage?.images?.length),
      });
    }
    const credit = user ? await chargeCredits(user.id, "text", result.usage, { conversationId: body.conversationId, conversationTitle: body.conversationTitle, requestId: body.requestId ? `${body.requestId}:plan` : undefined, label: "Agent 规划", model: usedModel }) : undefined;

    return NextResponse.json({ ...withChargedUsage(result, credit), credit });
    } catch (error) {
      // ⭐ 登录状态已失效：回 401，前端会直接跳首页（不弹提示、不记失败）。详见 credits.ts 注释。
      if (isUnauthenticatedError(error)) return NextResponse.json({ error: UNAUTHENTICATED_ERROR_MESSAGE }, { status: 401 });
      const uploadSummary = summarizeMessageUploads(body?.messages);

    if (uploadSummary.imageCount > 0 || uploadSummary.documentCount > 0) {
      void appendUploadRuleFeedbackLog({
        source: "agent-plan",
        mode: body?.mode ?? "agent",
        model: body?.model ?? DEFAULT_CHAT_MODEL,
        requestId: body?.requestId,
        conversationId: body?.conversationId,
        conversationTitle: body?.conversationTitle,
        error,
        ...uploadSummary,
      });
    }
    const codedError = await createCodedApiError(error, "Agent 规划失败，请稍后再试。", `agent-plan request failed mode=${body?.mode ?? "agent"} model=${body?.model ?? DEFAULT_CHAT_MODEL} requestId=${body?.requestId ?? ""}`);
    return NextResponse.json(codedError, { status: 500 });
  }
}
