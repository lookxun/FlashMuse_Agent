import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getLatestSucceededJobForWorkflowNode } from "@/lib/generation-jobs";

export const runtime = "nodejs";

type ReferenceItem = { url: string; name?: string; kind: "image" | "video" | "audio" };

// Return the reference inputs (images/videos/audios + display names) that a workflow node's generation
// actually used, read from the authoritative GenerationJob record. Used by "使用提示词" to restore the
// reference thumbnails and blue @mentions without bloating the canvas JSON with a per-node copy.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await request.json().catch(() => undefined) as { workflowId?: string; workflowNodeId?: string } | undefined;
  const workflowId = typeof body?.workflowId === "string" ? body.workflowId : "";
  const workflowNodeId = typeof body?.workflowNodeId === "string" ? body.workflowNodeId : "";
  if (!workflowId || !workflowNodeId) return NextResponse.json({ error: "缺少参数" }, { status: 400 });

  const job = await getLatestSucceededJobForWorkflowNode(user.id, workflowId, workflowNodeId);
  if (!job) return NextResponse.json({ references: [], prompt: undefined });

  const names = job.referenceNames ?? {};
  const build = (urls: string[] | null, kind: ReferenceItem["kind"]): ReferenceItem[] =>
    (urls ?? []).filter((url) => typeof url === "string" && Boolean(url)).map((url) => ({ url, name: names[url], kind }));

  const references: ReferenceItem[] = [
    ...build(job.referenceImages, "image"),
    ...build(job.referenceVideos, "video"),
    ...build(job.referenceAudios, "audio"),
  ];

  return NextResponse.json({ references, prompt: job.prompt ?? undefined, referenceMode: job.referenceMode ?? undefined });
}
