import { NextResponse } from "next/server";
import { generateOpenRouterImage } from "@/lib/openrouter";
import { toUserErrorMessage } from "@/lib/error-message";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { prompt?: string; model?: string; referenceImages?: string[]; settings?: { ratio?: string; resolution?: string }; count?: number };
    const prompt = body.prompt?.trim();

    if (!prompt) {
      return NextResponse.json({ error: "缺少提示词" }, { status: 400 });
    }

    const result = await generateOpenRouterImage(prompt, Array.isArray(body.referenceImages) ? body.referenceImages : [], {
      model: body.model,
      settings: body.settings,
      count: body.count,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = toUserErrorMessage(error, "图片生成失败，请稍后再试。");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
