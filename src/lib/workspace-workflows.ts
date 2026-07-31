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

/**
 * ⭐⭐ 工作流"点哪个读哪个"（按需加载·第二阶段：**其余工作流只发标题**）。
 *
 * 打开工作台时，只有「当前活跃的工作流」和「后端还有生成任务在跑的工作流」
 * （= route.ts 传进来的 runningWorkflowIds，来自 GenerationJob 表）会读 + 下发 canvasJson；
 * 其余工作流**连数据库都不读 canvasJson**，只下发标题/编号/时间这些列，并标 `canvasTrimmed: true`。
 * 前端切到某个工作流时用 `GET /api/workspace-state?workflowCanvasId=xxx` 补拉完整画布。
 *
 * 为什么必须做（用户 2026-07-30 拍板）：第一阶段的骨架版仍然是"每个工作流都发"，
 * 每节点约 560 字节 → 1000 个工作流仍是几十 MB，随数据量线性膨胀。只发标题才是断根。
 *
 * ⛔ 前提（已在第一阶段全部收口，别再退回去）：前端**不允许有任何"跨工作流遍历画布"的逻辑**。
 *    · 哪些工作流在生成 → 服务端 `getRunningWorkflowIds()`（GenerationJob 表）
 *    · 媒体属于哪个工作流/节点/叫什么 → 服务端 `getSavedMediaOrigins()`（MediaAsset 表）
 *    · 远端临时地址换本地地址 → 服务端 `applyWorkflowJobResultToCanvas()`（落地那刻就改）
 *    新增功能时若又想"扫所有工作流的画布"，一律改成服务端出数据。
 */

/**
 * 兼容判定：老浏览器标签页（部署前的 JS）回传的是**第一阶段的骨架版**
 * （节点还在、只少了 data.prompt / data.uploads / 顶层两个历史备份），
 * 它带着 `canvasTrimmed: true`，第一道防线就拦住了；这份清单只用于第二道防线的"逐字段相等"比对。
 * ⛔ 只用于判定，禁止再拿它生成下行数据。
 */
const LEGACY_TRIMMED_CANVAS_NODE_DATA_FIELDS = ["prompt", "uploads"] as const;
const LEGACY_TRIMMED_CANVAS_TOP_FIELDS = ["historicalMediaNodes", "historicalTextNodes"] as const;

/** 把画布摘成「第一阶段骨架版」——只用于 PUT 侧兼容老标签页的比对。 */
function legacyTrimWorkflowCanvasForList(canvas: unknown) {
  if (!isRecord(canvas)) return canvas;
  const trimmed: Record<string, unknown> = { ...canvas };
  LEGACY_TRIMMED_CANVAS_TOP_FIELDS.forEach((field) => { delete trimmed[field]; });
  if (!Array.isArray(canvas.nodes)) return trimmed;
  trimmed.nodes = canvas.nodes.map((node) => {
    if (!isRecord(node) || !isRecord(node.data)) return node;
    const nodeData = node.data as Record<string, unknown>;
    if (LEGACY_TRIMMED_CANVAS_NODE_DATA_FIELDS.every((field) => nodeData[field] === undefined)) return node;
    const data = { ...nodeData };
    LEGACY_TRIMMED_CANVAS_NODE_DATA_FIELDS.forEach((field) => { delete data[field]; });
    return { ...node, data };
  });
  return trimmed;
}

/** 画布"有没有实际内容"。只发标题时前端手里没有 nodes/edges，回传的必然是空对象。 */
function canvasHasContent(canvas: unknown) {
  if (!isRecord(canvas)) return false;
  return (Array.isArray(canvas.nodes) && canvas.nodes.length > 0) || (Array.isArray(canvas.edges) && canvas.edges.length > 0);
}

/**
 * 键顺序无关的稳定序列化。用于 PUT 侧判断"客户端这份画布是不是原封不动的骨架版"
 * （见 upsertWorkspaceWorkflows 里的第二道防线）。
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
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
  const isRemoteUrl = (value: unknown) => typeof value === "string" && /^https?:\/\//i.test(value);
  const nodes = incomingCanvas.nodes.map((node) => {
    if (!isRecord(node) || typeof node.id !== "string") return node;
    const existing = existingNodes.get(node.id);
    const existingData = isRecord(existing?.data) ? existing!.data as Record<string, unknown> : {};
    const data = isRecord(node.data) ? node.data : {};
    const nextData: Record<string, unknown> = { ...data };
    const job = jobResultsByNodeId?.get(node.id);

    // ⭐ 客户端还挂着平台的**临时远端地址**、而后端任务已经落地成本地地址 → 一律用本地的。
    //   （applyWorkflowJobResultToCanvas 已经在落地那刻改过库了；这里防的是"改完客户端又把旧的存回来"
    //     那一下并发覆盖。远端地址会过期，留着就是死链。）
    if (job?.kind === "image" && job.urls.length > 0 && Array.isArray(nextData.images) && nextData.images.some(isRemoteUrl)) {
      nextData.images = job.urls;
      if (job.dimensions) nextData.imageDimensions = job.dimensions;
    }
    if (job?.kind === "video" && job.urls.length > 0 && isRemoteUrl(nextData.videoUrl)) {
      nextData.videoUrl = job.urls[0];
      if (job.posterUrl) nextData.posterUrl = job.posterUrl;
    }

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

    // ⭐ 第三道防线（按需加载 / 骨架版画布）：客户端**整个字段都没带**（严格 undefined）而库里有内容
    // → 认为是"下行摘掉过、客户端手里本来就没有"，从库里补回来，绝不让整体覆盖把它删掉。
    // ⛔ 只认 undefined：用户真的把提示词清空时前端传的是空字符串 ""，那种情况必须让它覆盖成空，
    //    否则用户永远清不掉提示词。（节点创建时 prompt 一律初始化成 ""，所以"没有这个键"只可能来自下行摘除。）
    if (nextData.prompt === undefined && hasString(existingData.prompt)) nextData.prompt = existingData.prompt;

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
  const merged: Record<string, unknown> = { ...incomingCanvas, nodes };
  // 画布顶层被摘掉的两个字段同理：整个键都没带（严格 undefined）→ 从库里补回来。
  // 真的清空时前端传的是 []，不会走到这里。
  if (isRecord(existingCanvas)) {
    LEGACY_TRIMMED_CANVAS_TOP_FIELDS.forEach((field) => {
      if (merged[field] === undefined && existingCanvas[field] !== undefined) merged[field] = existingCanvas[field];
    });
  }
  return merged as Prisma.InputJsonObject;
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
      canvasTrimmed: workflow.canvasTrimmed === true,
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

  // ⭐⭐ 这里**故意不加 `deletedAt: null`**（2026-07-30 踩坑修）：删掉一个"只发了标题"的工作流后，
  //   客户端仍会把它（带 deletedAt）继续 PUT 上来。若这张表只查未删的行，那条已删工作流就查不到
  //   existingCanvas → 下面三道防线全部失效（都以 `existingCanvas !== undefined` 为前提）
  //   → 它的画布会被客户端手里的空对象覆盖成 `{}` = **回收站里的画布被真删掉**（本地实测过）。
  //   ⛔ 只有这一处的取数范围能救它，别再加回过滤条件。
  const existingRows = await prisma.workspaceWorkflow.findMany({
    where: { userId },
    select: { workflowId: true, canvasJson: true, deletedAt: true },
  });
  const existingCanvasByWorkflowId = new Map(existingRows.map((row) => [row.workflowId, row.canvasJson]));
  const jobResultsByWorkflowId = await getSucceededWorkflowJobResults(userId, incoming.map((workflow) => workflow.workflowId));
  // "库里到底有没有内容"只算未删的行（口径与原来一致，别把回收站里的算进来）。
  const existingActionCount = existingRows.filter((row) => !row.deletedAt).reduce((sum, row) => sum + getCanvasActionCount(row.canvasJson), 0);
  const incomingActionCount = workflowItems.filter(isRecord).reduce((sum, item) => sum + getWorkflowActionCount(item), 0);
  const incomingLooksAutoEmpty = incoming.length <= 1 && incomingActionCount === 0;
  if (options.activePanel !== "workflow" && incomingLooksAutoEmpty && existingActionCount > 0) return;

  await Promise.all(incoming.map((workflow) => {
    const existingCanvas = existingCanvasByWorkflowId.get(workflow.workflowId);
    // ⭐⭐ 按需加载的三道"绝不覆盖"防线（第四道在 mergeWorkflowCanvasMedia 里）：
    //   1. 客户端明确回传 canvasTrimmed:true → 它手里没有这个工作流的画布，这份没有权威性，直接不写。
    //   2. **不依赖客户端标记的结构性兜底**（"只发标题"的命门）：库里这个工作流有内容，
    //      而客户端回传的画布里**连 nodes 数组都没有** → 它手里根本没有画布，不写。
    //      · 判据用"有没有 nodes 数组"而不是"nodes 是不是空"：前端只要加载过画布，
    //        存库前的 stripWorkflowItemTransientUploadState 一定会写 `nodes: [...]`（哪怕是空数组）。
    //        所以「用户真的把画布清空」传的是 `nodes: []`（有数组）→ 照常写，清空能生效；
    //        而「没加载过」传的是 `{}`（没有这个键）→ 拦住。两种情况结构上天然可分。
    //   3. 客户端没带标记，但这份画布与"库里画布摘成【第一阶段骨架版】"逐字段相等（键顺序无关）
    //      → 部署窗口里的老标签页原样回传，同样不写。
    // ⛔ 三道都只影响 canvasJson，标题/编号/deletedAt 照常写 —— 否则在列表里重命名、删除一个
    //    没打开过的工作流就会失效。
    const skipCanvasWrite = existingCanvas !== undefined && (
      workflow.canvasTrimmed
      || (canvasHasContent(existingCanvas) && !Array.isArray(workflow.canvasJson.nodes))
      || stableStringify(workflow.canvasJson) === stableStringify(legacyTrimWorkflowCanvasForList(existingCanvas))
    );
    const canvasJson = skipCanvasWrite
      ? undefined
      : mergeWorkflowCanvasMedia(existingCanvas, workflow.canvasJson, jobResultsByWorkflowId.get(workflow.workflowId));
    return prisma.workspaceWorkflow.upsert({
      where: { userId_workflowId: { userId, workflowId: workflow.workflowId } },
      create: { userId, workflowId: workflow.workflowId, workflowCode: workflow.workflowCode, workspaceKind: "workflow", title: workflow.title, nextImageNumber: workflow.nextImageNumber, nextVideoNumber: workflow.nextVideoNumber, updatedAt: workflow.updatedAt, deletedAt: workflow.deletedAt, canvasJson: canvasJson ?? workflow.canvasJson, usageSummary: workflow.usageSummary },
      update: { workspaceKind: "workflow", workflowCode: workflow.workflowCode, title: workflow.title, nextImageNumber: workflow.nextImageNumber, nextVideoNumber: workflow.nextVideoNumber, updatedAt: workflow.updatedAt, deletedAt: workflow.deletedAt, ...(canvasJson === undefined ? {} : { canvasJson }), usageSummary: workflow.usageSummary },
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

export function workspaceWorkflowRowToPayload(row: Omit<WorkspaceWorkflowRow, "canvasJson"> & { canvasJson?: Prisma.JsonValue }) {
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

/**
 * ⭐ 列表用的"只发标题"列清单：**故意不含 canvasJson** —— 连数据库都不读它，
 * 这样响应体和数据库出口流量都不再随工作流数量/画布大小膨胀。
 * （需要完整画布的那一两个工作流，由 getWorkspaceWorkflowPayloads 第二步单独按 id 读。）
 */
const workflowMetaRowSelect = { workflowId: true, workflowCode: true, title: true, nextImageNumber: true, nextVideoNumber: true, createdAt: true, updatedAt: true, deletedAt: true, usageSummary: true } as const;

/**
 * ⭐ 按需拉取**单个**工作流的完整画布（"点哪个读哪个"的那一半）。
 * 只回 canvas，不回 usageSummary 等 —— 那些列表响应里已经有了，避免重复查 CreditLedger。
 */
export async function getWorkspaceWorkflowCanvas(userId: string, workflowId: string) {
  if (!workflowId) return null;
  const row = await prisma.workspaceWorkflow.findFirst({
    where: { userId, workflowId, deletedAt: null },
    select: { workflowId: true, updatedAt: true, canvasJson: true },
  });
  if (!row) return null;
  return { id: row.workflowId, updatedAt: row.updatedAt.getTime(), canvas: isRecord(row.canvasJson) ? row.canvasJson : {} };
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

export async function getWorkspaceWorkflowPayloads(userId: string, fallbackState?: unknown, options: { activeWorkflowId?: string; runningWorkflowIds?: string[] } = {}) {
  await migrateWorkspaceWorkflowsFromState(userId, fallbackState);
  // ⭐ 第一步：只读元数据列（**不含 canvasJson**）。工作流再多，这一步都只有每条几十字节。
  const rows = await prisma.workspaceWorkflow.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ updatedAt: "desc" }, { workflowId: "desc" }],
    select: workflowMetaRowSelect,
  });
  if (rows.length > 0) {
    // ⭐ 活跃工作流兜底：activeWorkflowId 为空 / 指向已删掉的工作流时，取 updatedAt 最新那一个
    //   （rows 已按 updatedAt desc 排序）—— 否则会一个完整画布都不下发、用户看到空白画布。
    //   与对话流 nextActiveSessionId 的兜底口径一致。
    const activeWorkflowId = options.activeWorkflowId && rows.some((row) => row.workflowId === options.activeWorkflowId)
      ? options.activeWorkflowId
      : rows[0]?.workflowId ?? "";
    // 需要完整画布的只有两类：① 活跃的那一个；② 后端还有生成任务在跑的（切走后回填结果要用完整画布）。
    // ⛔ 别再用"画布里有节点 isRunning"来判断：那要先把所有画布读出来，等于白做按需加载；
    //    而且 isRunning 是持久化标记，任务早挂了它也不会清（详见 getRunningWorkflowIds 注释）。
    const fullCanvasIds = Array.from(new Set([activeWorkflowId, ...(options.runningWorkflowIds ?? [])]
      .filter((id) => id && rows.some((row) => row.workflowId === id))));
    const [ledgerSummaries, canvasRows] = await Promise.all([
      getWorkflowUsageSummariesFromLedger(userId),
      fullCanvasIds.length > 0
        ? prisma.workspaceWorkflow.findMany({ where: { userId, workflowId: { in: fullCanvasIds }, deletedAt: null }, select: { workflowId: true, canvasJson: true } })
        : Promise.resolve([] as Array<{ workflowId: string; canvasJson: Prisma.JsonValue }>),
    ]);
    const canvasByWorkflowId = new Map(canvasRows.map((row) => [row.workflowId, row.canvasJson]));
    return rows.map((row) => {
      const canvasJson = canvasByWorkflowId.get(row.workflowId);
      const payload = workspaceWorkflowRowToPayload({ ...row, canvasJson });
      const ledgerSummary = ledgerSummaries.get(row.workflowId);
      const withUsage = ledgerSummary ? { ...payload, usageSummary: ledgerSummary } : payload;
      if (canvasJson !== undefined) return withUsage;
      // ⭐ 其余只发标题：**连 canvas 键都不下发**（前端据 canvasTrimmed 去补拉；
      //   PUT 侧靠"没有 nodes 数组"这一结构特征拦住覆盖，见 upsertWorkspaceWorkflows 第二道防线）。
      const { canvas: _canvas, ...withoutCanvas } = withUsage;
      return { ...withoutCanvas, canvasTrimmed: true as const };
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

/**
 * ⭐ 生成任务成功后，把工作流画布里那个节点的媒体地址**直接改成本地地址**（服务端做，一次到位）。
 *
 * 以前这件事在前端：轮询 /api/media-save-status → 在内存里把远端 url 换成本地 url → 整份 PUT 回来。
 * 两个毛病：
 *   ① 为了找出"哪些节点还挂着远端地址"，前端必须扫**所有工作流**的画布 → 逼着接口下发全部画布，
 *      工作流一多就卡（这是工作流按需加载的最后一道阻力）；
 *   ② ⛔ **只在用户开着页面时才会换**。用户关了页面，画布里就一直留着平台的临时地址，
 *      而那地址会过期 → 变成死链。
 * 服务端在落地成功那一刻就知道 workflowId + workflowNodeId + 最终本地地址，直接改掉最省事也最可靠。
 *
 * 只动这一个节点的媒体字段，其余一律不碰（提示词/位置/连线都不动）。
 */
export async function applyWorkflowJobResultToCanvas(input: {
  userId: string;
  workflowId: string;
  workflowNodeId: string;
  kind: "image" | "video";
  urls: string[];
  reservedNames?: string[];
  posterUrl?: string;
  dimensions?: Record<string, { width: number; height: number }>;
}) {
  const localUrls = input.urls.filter((url) => url && !/^https?:\/\//i.test(url));
  if (localUrls.length === 0) return false;
  try {
    const row = await prisma.workspaceWorkflow.findFirst({
      where: { userId: input.userId, workflowId: input.workflowId },
      select: { canvasJson: true },
    });
    const canvas = row?.canvasJson;
    if (!isRecord(canvas) || !Array.isArray(canvas.nodes)) return false;

    let changed = false;
    const nodes = canvas.nodes.map((node) => {
      if (!isRecord(node) || node.id !== input.workflowNodeId) return node;
      const data = isRecord(node.data) ? { ...(node.data as Record<string, unknown>) } : {};
      const oldUrls = input.kind === "image"
        ? (Array.isArray(data.images) ? data.images.filter((url): url is string => typeof url === "string") : [])
        : (typeof data.videoUrl === "string" && data.videoUrl ? [data.videoUrl] : []);
      // 画布里已经是这批本地地址了 → 什么都不用做（避免无意义写库）。
      if (oldUrls.length === localUrls.length && oldUrls.every((url, index) => url === localUrls[index])) return node;

      // mediaSystemNames / imageDimensions 是**以 url 为键**的，换地址必须同步换键，否则名字和尺寸会对不上。
      const oldNames = isRecord(data.mediaSystemNames) ? data.mediaSystemNames as Record<string, unknown> : {};
      const nextNames: Record<string, unknown> = {};
      Object.entries(oldNames).forEach(([url, name]) => { if (!oldUrls.includes(url)) nextNames[url] = name; });
      localUrls.forEach((url, index) => {
        const name = input.reservedNames?.[index] ?? (oldUrls[index] ? oldNames[oldUrls[index]] : undefined);
        if (name) nextNames[url] = name;
      });
      data.mediaSystemNames = nextNames;

      if (input.kind === "image") {
        data.images = localUrls;
        const oldDims = isRecord(data.imageDimensions) ? data.imageDimensions as Record<string, unknown> : {};
        const nextDims: Record<string, unknown> = {};
        Object.entries(oldDims).forEach(([url, dim]) => { if (!oldUrls.includes(url)) nextDims[url] = dim; });
        localUrls.forEach((url, index) => {
          const dim = input.dimensions?.[url] ?? (oldUrls[index] ? oldDims[oldUrls[index]] : undefined);
          if (dim) nextDims[url] = dim;
        });
        data.imageDimensions = nextDims;
      } else {
        data.videoUrl = localUrls[0];
        if (input.posterUrl) data.posterUrl = input.posterUrl;
      }
      // 结果已经落地 → 清掉等待态，否则会留一张永久转圈的等待卡。
      delete data.isRunning;
      delete data.imageRequestId;
      delete data.videoRequestId;
      delete data.taskId;
      delete data.startedAt;
      changed = true;
      return { ...node, data };
    });

    if (!changed) return false;
    await prisma.workspaceWorkflow.update({
      where: { userId_workflowId: { userId: input.userId, workflowId: input.workflowId } },
      data: { canvasJson: { ...canvas, nodes } as Prisma.InputJsonObject },
    });
    return true;
  } catch (error) {
    // best-effort：改不动也不能影响生成任务本身（前端下次保存时 mergeWorkflowCanvasMedia 还会兜一次）。
    console.warn("[workspace-workflows] applyWorkflowJobResultToCanvas failed", { workflowId: input.workflowId, nodeId: input.workflowNodeId, error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}
