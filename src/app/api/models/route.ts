import { NextResponse } from "next/server";
import { getOpenRouterConversationModels } from "@/lib/openrouter";
import { toUserErrorMessage } from "@/lib/error-message";

export async function GET() {
  try {
    const models = await getOpenRouterConversationModels();

    return NextResponse.json({ models });
  } catch (error) {
    const message = toUserErrorMessage(error, "模型列表获取失败。");

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
