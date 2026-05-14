import { NextResponse } from "next/server";
import { planAgentTask } from "@/lib/openrouter";
import { DEFAULT_CHAT_MODEL, isModelName } from "@/lib/models";
import { toUserErrorMessage } from "@/lib/error-message";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      model?: string;
      messages?: Array<{ role: "user" | "assistant"; content: string; images?: string[] }>;
    };

    const model = body.model || DEFAULT_CHAT_MODEL;

    if (!isModelName(model) || !Array.isArray(body.messages)) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }

    const result = await planAgentTask({ model, messages: body.messages });

    return NextResponse.json(result);
  } catch (error) {
    const message = toUserErrorMessage(error, "Agent 规划失败，请稍后再试。");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
