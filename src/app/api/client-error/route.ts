import { getCurrentUser } from "@/lib/auth";
import { appendUploadDiagnosticsLog } from "@/lib/upload-diagnostics-log";

export const runtime = "nodejs";

// ⭐ 上传链路的客户端上报必须**落盘**，不能只进 console（docker logs 会滚掉、事后查不到）。
// 这几条都是「发送那一刻还在补救上传」的现场，是红字 A5「参考素材不是可审核的公网地址」的源头信号：
// 2026-07-29 起对话流改成"上传完当场转正"，正常情况下这几条应该**一条都不再出现**，
// 出现就说明还有漏网的路径。查法：grep 这些 event 名字 .runtime/upload-diagnostics-log.jsonl。
const PERSISTED_CLIENT_EVENTS = new Set([
  "send-time-commit-still-needed",
  "send-time-data-url-fallback",
  "send-time-data-url-fallback-failed",
  "send-time-persist-uploaded-images-failed",
]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.slice(0, 1000) : "";
  const stack = typeof body.stack === "string" ? body.stack.slice(0, 2000) : "";
  const href = typeof body.href === "string" ? body.href.slice(0, 500) : "";
  const userAgent = typeof body.userAgent === "string" ? body.userAgent.slice(0, 500) : "";
  console.error("[client-error]", {
    message,
    source: typeof body.source === "string" ? body.source.slice(0, 500) : "",
    lineno: body.lineno,
    colno: body.colno,
    stack,
    href,
    userAgent,
  });

  if (PERSISTED_CLIENT_EVENTS.has(message)) {
    const user = await getCurrentUser().catch(() => undefined);
    void appendUploadDiagnosticsLog({ event: `client-${message}`, userId: user?.id, extra: { detail: stack, href, userAgent } });
  }

  return Response.json({ ok: true });
}
