import { NextResponse } from "next/server";
import { generateOpenRouterImage } from "@/lib/openrouter";

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
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
