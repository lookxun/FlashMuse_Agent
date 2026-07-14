import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildJobReferenceItems, getGenerationJobByMediaUrl, getLatestSucceededJobForWorkflowNode } from "@/lib/generation-jobs";

export const runtime = "nodejs";

// Return the reference inputs (images/videos/audios + display names) that a workflow node's generation
// actually used, read from the authoritative GenerationJob record. Used by "使用提示词" to restore the
// reference thumbnails and blue @mentions without bloating the canvas JSON with a per-node copy.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await request.json().catch(() => undefined) as { workflowId?: string; workflowNodeId?: string; mediaUrl?: string } | undefined;
  const workflowId = typeof body?.workflowId === "string" ? body.workflowId : "";
  const workflowNodeId = typeof body?.workflowNodeId === "string" ? body.workflowNodeId : "";
  const mediaUrl = typeof body?.mediaUrl === "string" ? body.mediaUrl : "";
  if (!workflowId || !workflowNodeId) return NextResponse.json({ error: "缺少参数" }, { status: 400 });

  // 优先按本工作流节点找它这次生成的 job；找不到（例如从资产库导入的、在对话流/别处生成的资产）再按媒体 url 回溯原始生成任务。
  const job = (await getLatestSucceededJobForWorkflowNode(user.id, workflowId, workflowNodeId))
    ?? (mediaUrl ? await getGenerationJobByMediaUrl(user.id, mediaUrl) : undefined);
  if (!job) return NextResponse.json({ references: [], prompt: undefined });

  const references = buildJobReferenceItems(job);

  // 用户真实提示词（不含参考图 hint）：统一存在 extra.cleanPrompt（图片/视频一致）。
  // 老 job 没有 cleanPrompt 就返回 undefined，让前端回退用画布节点自带 prompt（不把带 hint 的 job.prompt 塞进输入框）。
  const cleanPrompt = (typeof job.extraJson?.cleanPrompt === "string" && job.extraJson.cleanPrompt.trim())
    ? job.extraJson.cleanPrompt
    : undefined;

  return NextResponse.json({ references, prompt: cleanPrompt, referenceMode: job.referenceMode ?? undefined });
}
