import { NextResponse } from "next/server";
import { sendPlainOpenRouterMessages } from "@/lib/openrouter";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as {
    model?: string;
    stream?: boolean;
    messages?: Array<{ role: "user" | "assistant"; content: string }>;
  } | null;
  const model = body?.model?.trim() ?? "";
  if (!model || !Array.isArray(body?.messages)) {
    return NextResponse.json({ error: "参数不完整" }, { status: 400 });
  }
  if (body.stream) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };
        const started = Date.now();
        try {
          const result = await sendPlainOpenRouterMessages({
            model,
            messages: body.messages ?? [],
            onDelta: (piece) => send({ delta: piece }),
            onReasoning: (piece) => send({ reasoning: piece }),
          });
          send({ done: true, firstMs: result.firstMs, model: result.model, ms: Date.now() - started });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          send({ error: message });
        }
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  }
  try {
    const started = Date.now();
    const result = await sendPlainOpenRouterMessages({ model, messages: body.messages });
    return NextResponse.json({ ...result, ms: Date.now() - started, firstMs: result.firstMs });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
