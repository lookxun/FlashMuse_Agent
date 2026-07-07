import { Prisma } from "@prisma/client";
import { getCreditSettings } from "@/lib/credits";
import { prisma } from "@/lib/prisma";

type WorkspaceWorkflowRow = {
  workflowId: string;
  workflowCode: string | null;
  title: string;
  nextImageNumber: number;
  nextVideoNumber: number;
  updatedAt: Date;
  createdAt: Date;
  deletedAt: Date | null;
  canvasJson: Prisma.JsonValue;
  usageSummary: Prisma.JsonValue | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toDate(value: unknown) {
  const date = typeof value === "number" || typeof value === "string" ? new Date(value) : value instanceof Date ? value : new Date();
  return Number.isFinite(date.getTime()) ? date : new Date();
}

function toNullableDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const date = toDate(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function toJsonObject(value: unknown): Prisma.InputJsonObject {
  return isRecord(value) ? value as Prisma.InputJsonObject : {};
}

function toPositiveInt(value: unknown, fallback = 1) {
  const number = typeof value === "number" || typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function metadataNumber(metadata: unknown, key: string) {
  if (!isRecord(metadata)) return undefined;
  const value = metadata[key];
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function getWorkflowCodeFromTitle(title: string) {
  const number = Number(title.match(/^工作流_(\d+)$/)?.[1]);
  return Number.isFinite(number) && number > 0 ? `w${number}` : undefined;
}

function normalizeWorkflowCode(value: unknown, title: string) {
  if (typeof value === "string" && /^w\d+$/.test(value)) return value;
  return getWorkflowCodeFromTitle(title);
}

function getWorkflowActionCount(value: unknown) {
  if (!isRecord(value)) return 0;
  const canvas = isRecord(value.canvas) ? value.canvas : undefined;
  const nodes = Array.isArray(canvas?.nodes) ? canvas.nodes.length : 0;
  const edges = Array.isArray(canvas?.edges) ? canvas.edges.length : 0;
  return nodes + edges;
}

function getCanvasActionCount(value: unknown) {
  if (!isRecord(value)) return 0;
  const nodes = Array.isArray(value.nodes) ? value.nodes.length : 0;
  const edges = Array.isArray(value.edges) ? value.edges.length : 0;
  return nodes + edges;
}

type WorkflowJobResult = { kind: "image" | "video"; urls: string[]; posterUrl?: string; dimensions?: Record<string, unknown> };

/**
 * Load succeeded backend generation jobs for the given workflows, keyed by workflowId → nodeId → result.
 * Used when persisting the canvas so a stale browser tab (old JS still sending isRunning:true / empty
 * media) can never overwrite a node whose backend job already finished; the server fills the result in.
 */
async function getSucceededWorkflowJobResults(userId: string, workflowIds: string[]): Promise<Map<string, Map<string, WorkflowJobResult>>> {
  const byWorkflow = new Map<string, Map<string, WorkflowJobResult>>();
  const ids = Array.from(new Set(workflowIds.filter(Boolean)));
  if (ids.length === 0) return byWorkflow;
  try {
    const rows = await prisma.$queryRaw<Array<{ workflowId: string | null; workflowNodeId: string | null; kind: string; resultUrls: unknown; resultDimensions: unknown; posterUrl: string | null }>>`
      SELECT "workflowId", "workflowNodeId", "kind", "resultUrls", "resultDimensions", "posterUrl"
      FROM "GenerationJob"
      WHERE "userId" = ${userId} AND "status" = 'succeeded' AND "workflowNodeId" IS NOT NULL
        AND "workflowId" IN (${Prisma.join(ids)})
    `;
    for (const row of rows) {
      if (!row.workflowId || !row.workflowNodeId) continue;
      const urls = Array.isArray(row.resultUrls) ? (row.resultUrls as unknown[]).filter((url): url is string => typeof url === "string" && Boolean(url)) : [];
      if (urls.length === 0) continue;
      const nodeMap = byWorkflow.get(row.workflowId) ?? new Map<string, WorkflowJobResult>();
      nodeMap.set(row.workflowNodeId, { kind: row.kind === "video" ? "video" : "image", urls, posterUrl: row.posterUrl ?? undefined, dimensions: isRecord(row.resultDimensions) ? row.resultDimensions : undefined });
      byWorkflow.set(row.workflowId, nodeMap);
    }
  } catch (error) {
    console.warn("[workspace-workflows] getSucceededWorkflowJobResults failed", { error: error instanceof Error ? error.message : String(error) });
  }
  return byWorkflow;
}

function mergeWorkflowCanvasMedia(existingCanvas: unknown, incomingCanvas: Prisma.InputJsonObject, jobResultsByNodeId?: Map<string, WorkflowJobResult>) {
  if (!Array.isArray(incomingCanvas.nodes)) return incomingCanvas;
  const existingNodes = new Map<string, Record<string, unknown>>();
  if (isRecord(existingCanvas) && Array.isArray(existingCanvas.nodes)) {
    existingCanvas.nodes.filter(isRecord).forEach((node) => {
      if (typeof node.id === "string" && node.id) existingNodes.set(node.id, node);
    });
  }
  const hasNonEmptyArray = (value: unknown) => Array.isArray(value) && value.length > 0;
  const hasString = (value: unknown) => typeof value === "string" && Boolean(value.trim());
  const nodes = incomingCanvas.nodes.map((node) => {
    if (!isRecord(node) || typeof node.id !== "string") return node;
    const existing = existingNodes.get(node.id);
    const existingData = isRecord(existing?.data) ? existing!.data as Record<string, unknown> : {};
    const data = isRecord(node.data) ? node.data : {};
    const nextData: Record<string, unknown> = { ...data };
    const job = jobResultsByNodeId?.get(node.id);

    // Restore generated media that the client payload is missing (empty array counts as missing).
    // Priority: keep client's own non-empty result, else the DB's, else the succeeded backend job's.
    if (!hasNonEmptyArray(nextData.images)) {
      if (hasNonEmptyArray(existingData.images)) nextData.images = existingData.images;
      else if (job?.kind === "image" && job.urls.length > 0) nextData.images = job.urls;
    }
    if (!isRecord(nextData.imageDimensions)) {
      if (isRecord(existingData.imageDimensions)) nextData.imageDimensions = existingData.imageDimensions;
      else if (job?.dimensions) nextData.imageDimensions = job.dimensions;
    }
    if (!isRecord(nextData.mediaSystemNames) && isRecord(existingData.mediaSystemNames)) nextData.mediaSystemNames = existingData.mediaSystemNames;
    if (!hasString(nextData.videoUrl)) {
      if (hasString(existingData.videoUrl)) nextData.videoUrl = existingData.videoUrl;
      else if (job?.kind === "video" && job.urls.length > 0) nextData.videoUrl = job.urls[0];
    }
    if (!hasString(nextData.posterUrl)) {
      if (hasString(existingData.posterUrl)) nextData.posterUrl = existingData.posterUrl;
      else if (job?.posterUrl) nextData.posterUrl = job.posterUrl;
    }

    // If media is now present, a stale "generating" state from an old browser tab must not win:
    // clear the running/waiting flags so the node shows its result instead of a stuck waiting card.
    const nodeKind = typeof node.kind === "string" ? node.kind : undefined;
    const hasImage = hasNonEmptyArray(nextData.images);
    const hasVideo = hasString(nextData.videoUrl);
    if ((nodeKind === "image" && hasImage) || (nodeKind === "video" && hasVideo)) {
      delete nextData.isRunning;
      delete nextData.imageRequestId;
      delete nextData.videoRequestId;
      delete nextData.taskId;
      delete nextData.startedAt;
      if (!hasString(nextData.error)) delete nextData.error;
    }
    return { ...node, data: nextData };
  });
  return { ...incomingCanvas, nodes };
}

function normalizeWorkflowItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).flatMap((workflow) => {
    const workflowId = typeof workflow.id === "string" ? workflow.id : "";
    if (!workflowId) return [];
    const title = typeof workflow.title === "string" && workflow.title.trim() ? workflow.title.trim() : "新工作流";
    return [{
      workflowId,
      workflowCode: normalizeWorkflowCode(workflow.workflowCode, title),
      title,
      nextImageNumber: toPositiveInt(workflow.nextImageNumber),
      nextVideoNumber: toPositiveInt(workflow.nextVideoNumber),
      updatedAt: toDate(workflow.updatedAt),
      deletedAt: toNullableDate(workflow.deletedAt),
      canvasJson: toJsonObject(workflow.canvas),
      usageSummary: toJsonObject(workflow.usageSummary),
    }];
  });
}

export function stripWorkflowsFromWorkspaceState(state: unknown) {
  if (!isRecord(state)) return state;
  const { workflowItems: _workflowItems, ...rest } = state;
  return rest;
}

export async function upsertWorkspaceWorkflows(userId: string, workflowItems: unknown, options: { activePanel?: unknown } = {}) {
  if (!Array.isArray(workflowItems)) return;
  const incoming = normalizeWorkflowItems(workflowItems);
  if (incoming.length === 0) return;

  const existingRows = await prisma.workspaceWorkflow.findMany({
    where: { userId, deletedAt: null },
    select: { workflowId: true, canvasJson: true },
  });
  const existingCanvasByWorkflowId = new Map(existingRows.map((row) => [row.workflowId, row.canvasJson]));
  const jobResultsByWorkflowId = await getSucceededWorkflowJobResults(userId, incoming.map((workflow) => workflow.workflowId));
  const existingActionCount = existingRows.reduce((sum, row) => sum + getCanvasActionCount(row.canvasJson), 0);
  const incomingActionCount = workflowItems.filter(isRecord).reduce((sum, item) => sum + getWorkflowActionCount(item), 0);
  const incomingLooksAutoEmpty = incoming.length <= 1 && incomingActionCount === 0;
  if (options.activePanel !== "workflow" && incomingLooksAutoEmpty && existingActionCount > 0) return;

  await Promise.all(incoming.map((workflow) => {
    const canvasJson = mergeWorkflowCanvasMedia(existingCanvasByWorkflowId.get(workflow.workflowId), workflow.canvasJson, jobResultsByWorkflowId.get(workflow.workflowId));
    return prisma.workspaceWorkflow.upsert({
      where: { userId_workflowId: { userId, workflowId: workflow.workflowId } },
      create: { userId, workflowId: workflow.workflowId, workflowCode: workflow.workflowCode, workspaceKind: "workflow", title: workflow.title, nextImageNumber: workflow.nextImageNumber, nextVideoNumber: workflow.nextVideoNumber, updatedAt: workflow.updatedAt, deletedAt: workflow.deletedAt, canvasJson, usageSummary: workflow.usageSummary },
      update: { workspaceKind: "workflow", workflowCode: workflow.workflowCode, title: workflow.title, nextImageNumber: workflow.nextImageNumber, nextVideoNumber: workflow.nextVideoNumber, updatedAt: workflow.updatedAt, deletedAt: workflow.deletedAt, canvasJson, usageSummary: workflow.usageSummary },
    });
  }));

  // Deletion is explicit through each workflow's deletedAt. A partial or stale
  // client payload must never delete workflows merely because they are absent.
}

export async function migrateWorkspaceWorkflowsFromState(userId: string, state: unknown) {
  if (!isRecord(state) || !Array.isArray(state.workflowItems) || state.workflowItems.length === 0) return false;
  const count = await prisma.workspaceWorkflow.count({ where: { userId } });
  if (count > 0) return false;
  await upsertWorkspaceWorkflows(userId, state.workflowItems, { activePanel: state.activePanel });
  return true;
}

export function workspaceWorkflowRowToPayload(row: WorkspaceWorkflowRow) {
  return {
    id: row.workflowId,
    workflowCode: row.workflowCode ?? getWorkflowCodeFromTitle(row.title),
    title: row.title,
    nextImageNumber: row.nextImageNumber,
    nextVideoNumber: row.nextVideoNumber,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    deletedAt: row.deletedAt ? row.deletedAt.getTime() : undefined,
    canvas: isRecord(row.canvasJson) ? row.canvasJson : {},
    usageSummary: isRecord(row.usageSummary) ? row.usageSummary : undefined,
  };
}

async function getWorkflowUsageSummariesFromLedger(userId: string) {
  const [settings, ledgers] = await Promise.all([
    getCreditSettings(),
    prisma.creditLedger.findMany({
      where: { userId, direction: "consume", workspaceKind: "workflow", workspaceId: { not: null } },
      select: { workspaceId: true, credits: true, promptTokens: true, completionTokens: true, totalTokens: true, metadata: true },
    }),
  ]);

  const summaries = new Map<string, { promptTokens: number; completionTokens: number; totalTokens: number; usd: number; cny: number; credits: number }>();
  for (const item of ledgers) {
    if (!item.workspaceId) continue;
    const summary = summaries.get(item.workspaceId) ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0, usd: 0, cny: 0, credits: 0 };
    const chargedCny = metadataNumber(item.metadata, "chargedCny") ?? (settings.creditsPerCny > 0 ? item.credits / settings.creditsPerCny : 0);
    const chargedUsd = metadataNumber(item.metadata, "chargedUsd") ?? (settings.usdToCnyRate > 0 ? chargedCny / settings.usdToCnyRate : 0);
    summary.promptTokens += item.promptTokens;
    summary.completionTokens += item.completionTokens;
    summary.totalTokens += item.totalTokens;
    summary.usd += chargedUsd;
    summary.cny += chargedCny;
    summary.credits += item.credits;
    summaries.set(item.workspaceId, summary);
  }
  return summaries;
}

export async function getWorkspaceWorkflowPayloads(userId: string, fallbackState?: unknown) {
  await migrateWorkspaceWorkflowsFromState(userId, fallbackState);
  const rows = await prisma.workspaceWorkflow.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ updatedAt: "desc" }, { workflowId: "desc" }],
    select: { workflowId: true, workflowCode: true, title: true, nextImageNumber: true, nextVideoNumber: true, createdAt: true, updatedAt: true, deletedAt: true, canvasJson: true, usageSummary: true },
  });
  if (rows.length > 0) {
    const ledgerSummaries = await getWorkflowUsageSummariesFromLedger(userId);
    return rows.map((row) => {
      const payload = workspaceWorkflowRowToPayload(row);
      const ledgerSummary = ledgerSummaries.get(row.workflowId);
      return ledgerSummary ? { ...payload, usageSummary: ledgerSummary } : payload;
    });
  }
  return normalizeWorkflowItems(isRecord(fallbackState) ? fallbackState.workflowItems : undefined).filter((workflow) => !workflow.deletedAt).map((workflow) => ({
    id: workflow.workflowId,
    workflowCode: workflow.workflowCode,
    title: workflow.title,
    nextImageNumber: workflow.nextImageNumber,
    nextVideoNumber: workflow.nextVideoNumber,
    updatedAt: workflow.updatedAt.getTime(),
    canvas: workflow.canvasJson,
    usageSummary: workflow.usageSummary,
  }));
}
