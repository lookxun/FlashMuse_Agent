import { NextResponse } from "next/server";
import { sendToOpenRouter } from "@/lib/openrouter";
import { DEFAULT_CHAT_MODEL, isModelName } from "@/lib/models";
import { toUserErrorMessage } from "@/lib/error-message";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      model?: string;
      mode?: "agent" | "chat" | "image" | "video";
      messages?: Array<{ role: "user" | "assistant"; content: string; images?: string[] }>;
      settings?: {
        ratio?: string;
        resolution?: string;
        style?: string;
        duration?: string;
      };
      originalPrompt?: string;
    };

    const model = body.model || DEFAULT_CHAT_MODEL;

    if (!isModelName(model) || !body.mode || !Array.isArray(body.messages)) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }

    if (body.mode !== "agent" && body.mode !== "chat" && body.mode !== "image" && body.mode !== "video") {
      return NextResponse.json({ error: "对话模式不正确" }, { status: 400 });
    }

    const result = await sendToOpenRouter({
      model,
      mode: body.mode,
      messages: body.messages,
      settings: body.settings,
      originalPrompt: body.originalPrompt,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = toUserErrorMessage(error, "对话请求失败，请稍后再试。");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
