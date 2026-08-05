import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildJobReferenceItems, getWorkflowPromptReferenceRow, resolveReferenceMediaMetadata } from "@/lib/generation-jobs";

export const runtime = "nodejs";

// Return the reference inputs (images/videos/audios + display names) that a workflow node's generation
// actually used, read from the authoritative GenerationJob record. Used by "使用提示词" to restore the
// reference thumbnails and blue @mentions without bloating the canvas JSON with a per-node copy.
//
// ⭐ 这是**交互路径**（用户点了「使用提示词」，新节点的输入框正禁用着转圈等它），跨境每个 DB 往返 ~0.4s。
// 所以走窄查询 `getWorkflowPromptReferenceRow`（只查 6 个字段、两条 lookup 并发），⛔ 别改回 `SELECT *` 串行。
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await request.json().catch(() => undefined) as { workflowId?: string; workflowNodeId?: string; mediaUrl?: string } | undefined;
  const workflowId = typeof body?.workflowId === "string" ? body.workflowId : "";
  const workflowNodeId = typeof body?.workflowNodeId === "string" ? body.workflowNodeId : "";
  const mediaUrl = typeof body?.mediaUrl === "string" ? body.mediaUrl : "";
  if (!workflowId || !workflowNodeId) return NextResponse.json({ error: "缺少参数" }, { status: 400 });

  // 优先按本工作流节点找它这次生成的 job；找不到（例如从资产库导入的、在对话流/别处生成的资产）再按媒体 url 回溯原始生成任务。
  const job = await getWorkflowPromptReferenceRow(user.id, workflowId, workflowNodeId, mediaUrl);
  if (!job) return NextResponse.json({ references: [], prompt: undefined });

  const references = buildJobReferenceItems(job);

  // ⭐ 参考视频/音频必须带上「时长 + 宽高」：工作流发送前会逐个校验它们，读不到就报
  // 「视频时长读取失败」把发送拦死（2026-08-05 线上 bug）。只有真的有视频/音频参考时才多查一次库，
  // 纯参考图的常见情况仍是 1 个往返（这是交互路径，跨境每个往返 ~0.4s）。
  const mediaUrls = references.filter((item) => item.kind === "video" || item.kind === "audio").map((item) => item.url);
  const mediaMetaByUrl = mediaUrls.length > 0 ? await resolveReferenceMediaMetadata(user.id, mediaUrls) : {};
  const referencesWithMedia = references.map((item) => {
    if (item.kind === "image") return item;
    const meta = mediaMetaByUrl[item.url];
    return meta ? { ...item, durationSeconds: meta.durationSeconds, width: meta.width, height: meta.height } : item;
  });

  // 用户真实提示词（不含参考图 hint）：统一存在 extra.cleanPrompt（图片/视频一致）。
  // 老 job 没有 cleanPrompt 就返回 undefined，让前端回退用画布节点自带 prompt（不把带 hint 的 job.prompt 塞进输入框）。
  const cleanPrompt = (typeof job.cleanPrompt === "string" && job.cleanPrompt.trim()) ? job.cleanPrompt : undefined;

  return NextResponse.json({ references: referencesWithMedia, prompt: cleanPrompt, referenceMode: job.referenceMode ?? undefined });
}
