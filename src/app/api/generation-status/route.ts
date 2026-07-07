import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getActiveGenerationJobs, getGenerationJobsByRequestIds, type GenerationJobRow } from "@/lib/generation-jobs";

export const runtime = "nodejs";

function toClientJob(job: GenerationJobRow) {
  return {
    jobId: job.id,
    requestId: job.requestId,
    kind: job.kind,
    status: job.status,
    flow: job.flow ?? undefined,
    model: job.model ?? undefined,
    prompt: job.prompt ?? undefined,
    settings: job.settingsJson ?? undefined,
    conversationId: job.conversationId ?? undefined,
    messageId: job.messageId ?? undefined,
    workflowId: job.workflowId ?? undefined,
    workflowNodeId: job.workflowNodeId ?? undefined,
    itemIndex: job.itemIndex ?? undefined,
    providerTaskId: job.providerTaskId ?? undefined,
    resultUrls: job.resultUrls ?? undefined,
    resultDimensions: job.resultDimensions ?? undefined,
    posterUrl: job.posterUrl ?? undefined,
    usage: job.usageJson ?? undefined,
    credit: job.creditJson ?? undefined,
    extra: job.extraJson ?? undefined,
    error: job.error ?? undefined,
    errorCode: job.errorCode ?? undefined,
    updatedAt: job.updatedAt instanceof Date ? job.updatedAt.getTime() : undefined,
  };
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await request.json().catch(() => undefined) as { requestIds?: string[]; active?: boolean } | undefined;
  const requestIds = Array.isArray(body?.requestIds) ? body.requestIds.filter((id): id is string => typeof id === "string" && Boolean(id)) : [];

  let jobs: GenerationJobRow[] = [];
  if (requestIds.length > 0) {
    jobs = await getGenerationJobsByRequestIds(user.id, requestIds);
  } else if (body?.active) {
    jobs = await getActiveGenerationJobs(user.id);
  }

  return NextResponse.json({ jobs: jobs.map(toClientJob) });
}
