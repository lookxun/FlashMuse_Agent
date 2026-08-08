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
  // ⭐⭐ 参考图"用户意愿 vs 实际发出去"取证组（2026-08-05 加，纯日志、不改任何行为）。
  //
  // 起因：用户 ID_947011 报「把第二张参考图换成裁剪后的新图，点生成还是用了原来那张」。
  // 我在测试服把 6 个变体全试过（先删后传 / 先传后删 / 不删直传 / 同名不同字节 /
  // 提示词带 @名 / 直接用他那张透明 PNG）**一个都没复现**，而正式服那次是**零上传**
  // （磁盘无新文件 + upload-diagnostics 无任何记录）→ **根因至今未确定**。
  // ⛔ 所以这一轮**只加日志、不动任何逻辑**，等它再发生时一次定案。
  //
  // 另外这套也是给 ID_868181 那类「删掉了、发送时又被捞回来」准备的 ——
  // 那次是音频：`ensureMediaFileMentions` 在提交那一刻把用户删掉的 @音频名拼回提示词最前面
  //（函数已删除）。图片这边结构一样的地方还活着：`getOrderedExplicitImageReferences`
  // 会拿提示词里的 @名去**整个资产库**反查，命中的**排在最前面** →
  // 所以 `send-reference-snapshot` 里的 `assetLibrary` 来源标记是**抓这类问题的关键**。
  "input-image-dropped-before-upload",
  "input-image-removed",
  "copy-prompt-restored",
  "send-reference-snapshot",
  // ⭐⭐ 「发送后消息丢失 + 聊天区卡在『加载中...0%』」取证组（2026-08-08 加，纯日志、不改任何行为）。
  //
  // 现象（2026-08-08 测试服真走界面发被内容审核拦截的提示词，3 次里中 1 次）：
  // 整屏「加载中...0%」+ 没有红字 + 库里那条对话**标题存了但 msgs=0**。
  // 🗣️ 用户一句话推翻了"初始加载没好"的假设：**输入框能用、能打字发送 = 加载早完成了**
  // → 这个加载态是**发送之后**才出现的。3 次只中 1 次、根因未坐实 → 按铁律只加日志。
  //
  // ⭐ 三条客户端 + 一条服务端（`workspace-session-messages-skipped`，在 `workspace-sessions.ts`）
  //   配成一套，能把责任切干净：
  //   · send 时有消息 + PUT 时形状异常 + 服务端 skipped → **是那条持久化闸门吞的**；
  //   · send 时有消息但服务端没 skipped              → 消息在客户端被后续 setState 覆盖了；
  //   · send 时就 0 条消息                          → 乐观插入压根没成功；
  //   · stuck-loading 里 byLoadingSessionIds=true    → 是 loadSessionDetails 卡住（它的
  //     `if (!data.session) return` 会让 messagesLoaded 永远留在 false）。
  "chat-session-stuck-loading",
  "chat-send-suspicious-session-shape",
  "chat-put-session-shape-suspicious",
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
