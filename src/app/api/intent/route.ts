import { NextResponse } from "next/server";
import { classifyOpenRouterIntent } from "@/lib/openrouter";
import { DEFAULT_CHAT_MODEL, isModelName } from "@/lib/models";
import { createCodedApiError } from "@/lib/error-code";
import { getCurrentUser } from "@/lib/auth";
import { resolveUnlockLimitsForUser } from "@/lib/account-features";

export async function POST(request: Request) {
  try {
    // 2026-08-02 审计 2.8a：原来不要求登录，任何人可以循环调用、用我们的 key 白烧 LLM 费用。
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "登录状态已失效，请重新登录后再试。" }, { status: 401 });
    }

    const body = (await request.json()) as {
      model?: string;
      messages?: Array<{ role: "user" | "assistant"; content: string; images?: string[] }>;
    };

    const model = body.model || DEFAULT_CHAT_MODEL;

    if (!isModelName(model) || !Array.isArray(body.messages)) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }

    const result = await classifyOpenRouterIntent({ model, messages: body.messages, unlockLimits: await resolveUnlockLimitsForUser(user.id) });

    return NextResponse.json(result);
  } catch (error) {
    const codedError = await createCodedApiError(error, "意图识别失败，请稍后再试。", "intent request failed");
    return NextResponse.json(codedError, { status: 500 });
  }
}
