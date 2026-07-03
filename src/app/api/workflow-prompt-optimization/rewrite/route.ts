import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { assertUserCanUseCredits, chargeCredits, recordCreditFailure } from "@/lib/credits";
import { createCodedApiError } from "@/lib/error-code";
import { toUserErrorMessage } from "@/lib/error-message";
import { rewriteGptImagePromptForSafety } from "@/lib/openrouter";

export const dynamic = "force-dynamic";

function mergeMetadata(extra: Prisma.InputJsonObject): Prisma.InputJsonValue {
  return { creditSource: "prompt_optimization", ...extra };
}

export async function POST(request: Request) {
  let body: { originalPrompt?: string; failureReason?: string; previousPrompts?: string[]; attemptIndex?: number; maxAttempts?: number; workflowId?: string; workflowTitle?: string; workflowNodeId?: string; requestId?: string } | undefined;
  let user: Awaited<ReturnType<typeof getCurrentUser>> = null;
  try {
    body = await request.json() as typeof body;
    const originalPrompt = body?.originalPrompt?.trim() ?? "";
    if (!originalPrompt) return NextResponse.json({ error: "缺少原提示词" }, { status: 400 });
    const attemptIndex = Math.max(1, Math.floor(Number(body?.attemptIndex) || 1));
    const maxAttempts = Math.max(attemptIndex, Math.min(10, Math.floor(Number(body?.maxAttempts) || attemptIndex)));

    user = await getCurrentUser();
    await assertUserCanUseCredits(user, "text", mergeMetadata({ workflowId: body?.workflowId, workflowNodeId: body?.workflowNodeId }));

    const result = await rewriteGptImagePromptForSafety({
      originalPrompt,
      failureReason: body?.failureReason,
      previousPrompts: body?.previousPrompts,
      attemptIndex,
      maxAttempts,
      requestId: body?.requestId,
    });

    const credit = user ? await chargeCredits(user.id, "text", result.usage, {
      conversationId: body?.workflowId,
      conversationTitle: body?.workflowTitle,
      requestId: body?.requestId ? `${body.requestId}:rewrite:${attemptIndex}` : undefined,
      label: "GPT生图提示词安全改写",
      model: result.optimizerModel,
      metadata: mergeMetadata({ workflowId: body?.workflowId, workflowNodeId: body?.workflowNodeId, attemptIndex, maxAttempts, outputPrompt: result.optimizedPrompt }),
    }) : undefined;

    return NextResponse.json({ ...result, credit });
  } catch (error) {
    if (user?.id) {
      await recordCreditFailure(user.id, "text", {
        conversationId: body?.workflowId,
        conversationTitle: body?.workflowTitle,
        requestId: body?.requestId ? `${body.requestId}:rewrite:${body?.attemptIndex ?? 1}` : undefined,
        label: "GPT生图提示词安全改写",
        model: "prompt-optimization-fallback",
        metadata: mergeMetadata({ workflowId: body?.workflowId, workflowNodeId: body?.workflowNodeId, status: "failed", failureReason: toUserErrorMessage(error, "提示词安全改写失败") }),
      }).catch(() => undefined);
    }
    const codedError = await createCodedApiError(error, "提示词安全改写失败，请稍后再试。", `workflow prompt optimization rewrite failed workflowId=${body?.workflowId ?? ""} nodeId=${body?.workflowNodeId ?? ""}`);
    return NextResponse.json(codedError, { status: 500 });
  }
}
