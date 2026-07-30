/**
 * 量「打开工作台那个接口」的响应体大小，并对比本次瘦身优化前后的收益。
 *
 * 背景 / 根因排查全文：`handover/06-memo-tasks.md` 的 **M024**（还没做的那一半是 **M025**）。
 * 一句话：`/api/workspace-state?summary=1&panel=chat` 的响应线上实测最大 **1.19MB**，
 * 撑爆 nginx 默认 32KB 缓冲 → nginx 落盘到磁盘临时文件再转发 → 打开工作台转圈 17~30 秒。
 *
 * ⭐ 用它干两件事：
 *  ① **改之前**：找出响应最大的那些用户、以及大头到底是哪个字段（别看代码猜，铁律）；
 *  ② **改之后**：拿真实重度用户数据再跑一次，确认到底省了多少、还剩多少。
 *
 * 怎么跑（必须在容器里跑，才找得到 @prisma/client）：
 *   scp scripts/measure-workspace-state-size.mjs ubuntu@119.28.116.16:/tmp/
 *   ssh ... "sudo docker cp /tmp/measure-workspace-state-size.mjs flashmuse-flashmuse-app-1:/app/mw.mjs \
 *            && sudo docker exec -w /app flashmuse-flashmuse-app-1 node mw.mjs"
 *   （测试服把容器名换成 flashmuse-staging-staging-app-1）
 *
 * ⚠️ 只读，不写任何数据。
 * ⚠️ 下面的 `project()` 是 `src/lib/workspace-sessions.ts` 里
 *    `projectWorkspaceMessageForClient()` 的**复刻**——改了那边记得同步这里，否则量出来的收益是假的。
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const B = (v) => (v === undefined ? 0 : Buffer.byteLength(JSON.stringify(v), "utf8"));
const kb = (n) => (n / 1024).toFixed(1) + "KB";
const isRecord = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);

/** 复刻 projectWorkspaceMessageForClient（下行投影：重复的提示词副本不下发）。 */
function project(value) {
  if (!isRecord(value)) return value;
  const next = { ...value };
  const meta = isRecord(next.generationMeta) ? { ...next.generationMeta } : undefined;
  const content = typeof next.content === "string" ? next.content : undefined;
  const originalPrompt = meta && typeof meta.originalPrompt === "string" ? meta.originalPrompt : undefined;
  const baseline = originalPrompt !== undefined ? originalPrompt : content;
  if (meta) {
    if (Array.isArray(meta.itemPrompts) && baseline !== undefined && meta.itemPrompts.length > 0 && meta.itemPrompts.every((i) => i === baseline)) delete meta.itemPrompts;
    if (typeof meta.originalPrompt === "string" && content !== undefined && meta.originalPrompt === content) delete meta.originalPrompt;
    if (Object.keys(meta).length > 0) next.generationMeta = meta; else delete next.generationMeta;
  }
  if (isRecord(next.videoPrompts) && baseline !== undefined) {
    const metaAfter = isRecord(next.generationMeta) ? next.generationMeta : undefined;
    const itemPromptsStillDiffer = Array.isArray(metaAfter && metaAfter.itemPrompts);
    const values = Object.values(next.videoPrompts);
    if (!itemPromptsStillDiffer && values.length > 0 && values.every((i) => i === baseline)) delete next.videoPrompts;
  }
  return next;
}

/** 自动挑出"数据最多"的重度用户（工作流画布最大 + 消息最多），比手填 ID 靠谱。 */
async function findHeavyUsers() {
  const wfAgg = await prisma.$queryRawUnsafe(`
    SELECT "userId", sum(pg_column_size("canvasJson"))::int AS b
    FROM "WorkspaceWorkflow" WHERE "deletedAt" IS NULL
    GROUP BY "userId" ORDER BY b DESC LIMIT 5
  `);
  const msgAgg = await prisma.$queryRawUnsafe(`
    SELECT "userId", count(*)::int AS n
    FROM "WorkspaceMessage" GROUP BY "userId" ORDER BY n DESC LIMIT 5
  `);
  return [...new Set([...wfAgg.map((r) => r.userId), ...msgAgg.map((r) => r.userId)])];
}

async function main() {
  const users = await findHeavyUsers();
  console.log("重度用户：" + users.join(", ") + "\n");

  let sumBefore = 0;
  let sumAfter = 0;
  for (const userId of users) {
    // ① workflowItems：接口把该用户所有未删工作流的完整 canvas 都返回（无分页、无裁剪）→ 这就是 M025 要治的
    const wfRows = await prisma.workspaceWorkflow.findMany({ where: { userId, deletedAt: null }, select: { title: true, canvasJson: true } });
    const wfBytes = wfRows.reduce((s, r) => s + B(r.canvasJson) + B(r.title), 0);

    // ② 会话摘要（前 10 条 = DEFAULT_WORKSPACE_SESSION_LIMIT）
    const sRows = await prisma.workspaceSession.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ updatedAt: "desc" }],
      select: { sessionId: true, title: true, summaryJson: true, usageSummary: true, memorySummary: true },
    });
    const first10 = sRows.slice(0, 10);
    const summaryBytes = first10.reduce((s, r) => s + B(r.summaryJson) + B(r.usageSummary) + B(r.memorySummary) + B(r.title), 0);

    // ③ 活跃会话的消息：改动前 = 50 条不投影；改动后 = 30 条 + 投影
    const active = first10[0]?.sessionId;
    let msgBefore = 0;
    let msgAfter = 0;
    let n50 = 0;
    let n30 = 0;
    if (active) {
      const rows = await prisma.workspaceMessage.findMany({ where: { userId, sessionId: active }, orderBy: { createdAt: "desc" }, take: 50, select: { messageJson: true } });
      n50 = rows.length;
      msgBefore = rows.reduce((s, r) => s + B(r.messageJson), 0);
      const only30 = rows.slice(0, 30);
      n30 = only30.length;
      msgAfter = only30.reduce((s, r) => s + B(project(r.messageJson)), 0);
    }

    // ④ 外壳字段 + feedbackLogs（改动后不下发 feedbackLogs）
    const ws = await prisma.userWorkspaceState.findUnique({ where: { userId }, select: { state: true } });
    const st = ws && isRecord(ws.state) ? ws.state : {};
    const shellBytes = ["activePanel", "activeSessionId", "assetFilter", "assetScrollTopByFilter", "activeWorkflowId", "nextConversationNumber", "nextWorkflowNumber", "inputSettings", "intentMemoryRules"].reduce((s, k) => s + B(st[k]), 0);
    const fbBytes = B(st.feedbackLogs);

    const before = wfBytes + summaryBytes + msgBefore + shellBytes + fbBytes;
    const after = wfBytes + summaryBytes + msgAfter + shellBytes;
    sumBefore += before;
    sumAfter += after;
    const cut = before > 0 ? ((1 - after / before) * 100).toFixed(1) : "0.0";
    console.log(`${userId}  ${kb(before).padStart(9)} -> ${kb(after).padStart(9)}   省 ${String(cut).padStart(5)}%   [消息 ${n50}条${kb(msgBefore)} -> ${n30}条${kb(msgAfter)} | feedbackLogs ${kb(fbBytes)} -> 0 | 工作流canvas ${kb(wfBytes)} 未动]`);
  }

  console.log(`\n合计 ${kb(sumBefore)} -> ${kb(sumAfter)}   总省 ${((1 - sumAfter / sumBefore) * 100).toFixed(1)}%`);
  console.log("⭐ 2026-07-30 首次实测基线：4905KB -> 2688KB，总省 45.2%");
  console.log("⚠️ 「工作流canvas 未动」那一列就是 M025 还没做的部分 —— 某些用户 98.7% 都在这里，所以他们省 0%。");
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
