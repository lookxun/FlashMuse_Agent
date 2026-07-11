import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { chargeCredits } from "@/lib/credits";
import { generateOpenRouterImage } from "@/lib/openrouter";
import { createCodedApiError } from "@/lib/error-code";
import { GENERIC_MEDIA_ERROR_MESSAGE } from "@/lib/error-message";
import { getExpectedImageDimensions } from "@/lib/models";
import { recordGenerationEvent } from "@/lib/analytics-events";
import { appendGenerationDiagnosticsLog, summarizeGeneratedReference } from "@/lib/generation-diagnostics-log";
import { resolvePersistableMediaAssetUrl } from "@/lib/media-assets";
import { buildMediaAssetRecord, buildUserAssetStateRecord, classifyAsset, type AssetGenerationKind } from "@/lib/media-asset-record";
import { getOpenRouterVideoTask } from "@/lib/openrouter-video";
import { enqueueRemoteAssetSave, waitForMediaSaveJob } from "@/lib/media-save-queue";
import { upsertVideoManifestEntry } from "@/lib/video-manifest";

/**
 * 后端持久生成任务（GenerationJob）。原则：模型申请一旦提交，后端就负责跑到底
 * （生成/存盘/扣费/落状态），前端断开/刷新/退出/服务重启都不影响。前端只做提交与展示。
 * 使用原始 SQL 读写，避免本地 Windows 常锁定 Prisma 查询引擎导致 `prisma generate` 失败
 * （与 GenerationEvent / GptImagePromptOptimizationCase 相同思路）。
 */

export type GenerationJobStatus = "queued" | "running" | "succeeded" | "failed";
export type GenerationJobKind = "image" | "video";

export type GenerationJobRow = {
  id: string;
  userId: string;
  requestId: string;
  kind: GenerationJobKind;
  status: GenerationJobStatus;
  flow: string | null;
  creditSource: string | null;
  model: string | null;
  provider: string | null;
  prompt: string | null;
  settingsJson: { ratio?: string; resolution?: string; duration?: string } | null;
  referenceImages: string[] | null;
  referenceVideos: string[] | null;
  referenceAudios: string[] | null;
  referenceMode: string | null;
  conversationId: string | null;
  conversationTitle: string | null;
  messageId: string | null;
  workflowId: string | null;
  workflowNodeId: string | null;
  itemIndex: number | null;
  count: number;
  providerTaskId: string | null;
  reservedNames: string[] | null;
  resultUrls: string[] | null;
  resultDimensions: Record<string, { width: number; height: number }> | null;
  posterUrl: string | null;
  usageJson: Record<string, unknown> | null;
  creditJson: Record<string, unknown> | null;
  metadataJson: Record<string, unknown> | null;
  extraJson: Record<string, unknown> | null;
  error: string | null;
  errorCode: string | null;
  attempts: number;
  leaseAt: Date | null;
  nextRunAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function jsonParam(value: unknown): string | null {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

function assetNameSuffix(source: string | null | undefined) {
  return source === "scene_image_generation" ? "scene" : source === "shot_image_generation" ? "storyboard" : "role";
}

async function reserveJobNames(tx: Prisma.TransactionClient, input: { userId: string; kind: GenerationJobKind; count: number; flow?: string; workflowId?: string; conversationId?: string; conversationCode?: string; creditSource?: string }) {
  const assetFlow = isAssetImageCreditSource(input.creditSource);
  const scope = assetFlow ? `asset:${input.userId}` : input.flow === "workflow" && input.workflowId ? `workflow:${input.userId}:${input.workflowId}:${input.kind}` : `conversation:${input.userId}:${input.conversationId ?? "d0"}:${input.kind}`;
  // The caller keeps this lock until the job row containing the reservation is inserted.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${scope}))`;
  const [assets, jobs, workflow] = await Promise.all([
    tx.mediaAsset.findMany({ where: { userId: input.userId }, select: { systemName: true, initialName: true } }),
    tx.$queryRaw<Array<{ reservedNames: string[] | null }>>`SELECT "reservedNames" FROM "GenerationJob" WHERE "userId" = ${input.userId} AND "status" IN ('queued', 'running')`,
    input.flow === "workflow" && input.workflowId ? tx.workspaceWorkflow.findUnique({ where: { userId_workflowId: { userId: input.userId, workflowId: input.workflowId } }, select: { workflowCode: true, title: true } }) : null,
  ]);
  const used = new Set<string>();
  for (const asset of assets) for (const name of [asset.systemName, asset.initialName]) if (name) used.add(name);
  for (const job of jobs) for (const name of job.reservedNames ?? []) used.add(name);
  let code: string;
  if (input.flow === "workflow") {
    code = deriveWorkflowCode(workflow?.workflowCode ?? null, workflow?.title ?? null);
  } else {
    // 对话流：用会话稳定编号 conversationCode（image_序号_d编号）。优先取调用方传入，
    // 缺失时回退读 WorkspaceSession.summaryJson.conversationCode，都没有才 d0。
    code = input.conversationCode?.trim() || "";
    if (!code && input.conversationId) {
      const session = await tx.workspaceSession.findUnique({
        where: { userId_sessionId: { userId: input.userId, sessionId: input.conversationId } },
        select: { summaryJson: true },
      });
      const summaryCode = session && typeof session.summaryJson === "object" && session.summaryJson
        ? (session.summaryJson as Record<string, unknown>).conversationCode
        : undefined;
      if (typeof summaryCode === "string" && summaryCode.trim()) code = summaryCode.trim();
    }
    if (!code) code = "d0";
  }
  const suffix = assetNameSuffix(input.creditSource);
  const prefix = assetFlow ? "asset" : input.kind;
  const names: string[] = [];
  let number = 1;
  while (names.length < input.count) {
    const name = assetFlow ? `asset_${number}_${suffix}` : `${prefix}_${number}_${code}`;
    if (!used.has(name)) {
      names.push(name);
      used.add(name);
    }
    number += 1;
  }
  return names;
}

async function ensureJobReservedNames(job: GenerationJobRow) {
  if (job.reservedNames?.length) return job.reservedNames;
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ reservedNames: string[] | null }>>`SELECT "reservedNames" FROM "GenerationJob" WHERE "id" = ${job.id} FOR UPDATE`;
    if (rows[0]?.reservedNames?.length) return rows[0].reservedNames;
    const names = await reserveJobNames(tx, { userId: job.userId, kind: job.kind, count: Math.max(1, job.count), flow: job.flow ?? undefined, workflowId: job.workflowId ?? undefined, conversationId: job.conversationId ?? undefined, conversationCode: typeof job.extraJson?.conversationCode === "string" ? job.extraJson.conversationCode : undefined, creditSource: job.creditSource ?? undefined });
    await tx.$executeRaw`UPDATE "GenerationJob" SET "reservedNames" = ${jsonParam(names)}::jsonb, "updatedAt" = NOW() WHERE "id" = ${job.id}`;
    return names;
  });
}

export type CreateImageJobInput = {
  userId: string;
  requestId: string;
  prompt: string;
  model?: string;
  referenceImages?: string[];
  settings?: { ratio?: string; resolution?: string };
  count?: number;
  candidateMode?: "all" | "best";
  creditSource?: string;
  conversationId?: string;
  conversationTitle?: string;
  conversationCode?: string;
  messageId?: string;
  workflowId?: string;
  workflowNodeId?: string;
  itemIndex?: number;
  flow?: "conversation" | "workflow";
  metadata?: Prisma.InputJsonValue;
  extra?: Record<string, unknown>;
};

export type CreateVideoJobInput = {
  userId: string;
  requestId: string;
  providerTaskId: string;
  prompt: string;
  model?: string;
  referenceImages?: string[];
  referenceVideos?: string[];
  referenceAudios?: string[];
  referenceMode?: string;
  settings?: { ratio?: string; resolution?: string; duration?: string };
  creditSource?: string;
  conversationId?: string;
  conversationTitle?: string;
  conversationCode?: string;
  messageId?: string;
  workflowId?: string;
  workflowNodeId?: string;
  itemIndex?: number;
  flow?: "conversation" | "workflow";
  usage?: Record<string, unknown>;
  metadata?: Prisma.InputJsonValue;
  extra?: Record<string, unknown>;
};

/** 建一条排队中的图片任务（幂等：同 requestId 已存在则直接返回原任务）。 */
export async function createImageJob(input: CreateImageJobInput): Promise<GenerationJobRow> {
  const existing = await getGenerationJobByRequestId(input.requestId);
  if (existing) return existing;

  const id = randomUUID();
  const provider = input.model?.startsWith("byteplus:") ? "byteplus" : "openrouter";
  const count = Math.min(4, Math.max(1, Math.floor(input.count ?? 1)));
  const extra = { ...(input.extra ?? {}), ...(input.candidateMode ? { candidateMode: input.candidateMode } : {}), ...(input.conversationCode ? { conversationCode: input.conversationCode } : {}) };
  await prisma.$transaction(async (tx) => {
    const reservedNames = await reserveJobNames(tx, { userId: input.userId, kind: "image", count, flow: input.flow, workflowId: input.workflowId, conversationId: input.conversationId, conversationCode: input.conversationCode, creditSource: input.creditSource });
    await tx.$executeRaw`
    INSERT INTO "GenerationJob" (
      "id", "userId", "requestId", "kind", "status", "flow", "creditSource", "model", "provider",
      "prompt", "settingsJson", "referenceImages", "conversationId", "conversationTitle",
       "messageId", "workflowId", "workflowNodeId", "itemIndex", "count", "reservedNames", "metadataJson", "extraJson",
      "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${input.userId}, ${input.requestId}, 'image', 'queued', ${input.flow ?? null}, ${input.creditSource ?? null}, ${input.model ?? null}, ${provider},
      ${input.prompt}, ${jsonParam(input.settings)}::jsonb, ${jsonParam(input.referenceImages ?? [])}::jsonb, ${input.conversationId ?? null}, ${input.conversationTitle ?? null},
       ${input.messageId ?? null}, ${input.workflowId ?? null}, ${input.workflowNodeId ?? null}, ${input.itemIndex ?? null}, ${count}, ${jsonParam(reservedNames)}::jsonb, ${jsonParam(input.metadata)}::jsonb, ${jsonParam(extra)}::jsonb,
      NOW(), NOW()
    )
    ON CONFLICT ("requestId") DO NOTHING
    `;
  });
  const created = await getGenerationJobByRequestId(input.requestId);
  if (!created) throw new Error("创建生成任务失败");
  // 立即触发 worker，尽快开始（worker 内有 lease 防重复）。
  void import("@/lib/generation-worker").then((mod) => mod.nudgeGenerationWorker()).catch(() => undefined);
  return created;
}

/** 创建一条视频轮询任务（创建阶段仍由 /api/video 处理，worker 只负责轮询到完成）。 */
export async function createVideoJob(input: CreateVideoJobInput): Promise<GenerationJobRow> {
  const existing = await getGenerationJobByRequestId(input.requestId);
  if (existing) return existing;

  const id = randomUUID();
  const provider = input.model?.startsWith("byteplus:video.") ? "byteplus" : "openrouter";
  const extra = { ...(input.extra ?? {}), ...(input.conversationCode ? { conversationCode: input.conversationCode } : {}) };
  await prisma.$transaction(async (tx) => {
    const reservedNames = await reserveJobNames(tx, { userId: input.userId, kind: "video", count: 1, flow: input.flow, workflowId: input.workflowId, conversationId: input.conversationId, conversationCode: input.conversationCode, creditSource: input.creditSource });
    await tx.$executeRaw`
    INSERT INTO "GenerationJob" (
      "id", "userId", "requestId", "kind", "status", "flow", "creditSource", "model", "provider",
      "prompt", "settingsJson", "referenceImages", "referenceVideos", "referenceAudios", "referenceMode",
       "conversationId", "conversationTitle", "messageId", "workflowId", "workflowNodeId", "itemIndex", "count", "reservedNames", "providerTaskId",
      "usageJson", "metadataJson", "extraJson", "nextRunAt", "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${input.userId}, ${input.requestId}, 'video', 'running', ${input.flow ?? null}, ${input.creditSource ?? null}, ${input.model ?? null}, ${provider},
      ${input.prompt}, ${jsonParam(input.settings)}::jsonb, ${jsonParam(input.referenceImages ?? [])}::jsonb, ${jsonParam(input.referenceVideos ?? [])}::jsonb, ${jsonParam(input.referenceAudios ?? [])}::jsonb, ${input.referenceMode ?? null},
       ${input.conversationId ?? null}, ${input.conversationTitle ?? null}, ${input.messageId ?? null}, ${input.workflowId ?? null}, ${input.workflowNodeId ?? null}, ${input.itemIndex ?? null}, 1, ${jsonParam(reservedNames)}::jsonb, ${input.providerTaskId},
      ${jsonParam(input.usage)}::jsonb, ${jsonParam(input.metadata)}::jsonb, ${jsonParam(extra)}::jsonb, NOW(), NOW(), NOW()
    )
    ON CONFLICT ("requestId") DO NOTHING
    `;
  });
  const created = await getGenerationJobByRequestId(input.requestId);
  if (!created) throw new Error("创建视频生成任务失败");
  void import("@/lib/generation-worker").then((mod) => mod.nudgeGenerationWorker()).catch(() => undefined);
  return created;
}

export async function getGenerationJobByRequestId(requestId: string): Promise<GenerationJobRow | undefined> {
  const rows = await prisma.$queryRaw<GenerationJobRow[]>`SELECT * FROM "GenerationJob" WHERE "requestId" = ${requestId} LIMIT 1`;
  return rows[0];
}

export async function getGenerationJobsByRequestIds(userId: string, requestIds: string[]): Promise<GenerationJobRow[]> {
  const ids = requestIds.filter((id) => typeof id === "string" && id).slice(0, 200);
  if (ids.length === 0) return [];
  return prisma.$queryRaw<GenerationJobRow[]>`SELECT * FROM "GenerationJob" WHERE "userId" = ${userId} AND "requestId" IN (${Prisma.join(ids)})`;
}

/** 拉取该用户所有仍在进行 + 最近完成的任务，供前端加载/重连时对齐展示。 */
export async function getActiveGenerationJobs(userId: string, sinceMs = 6 * 60 * 60 * 1000): Promise<GenerationJobRow[]> {
  const since = new Date(Date.now() - sinceMs);
  return prisma.$queryRaw<GenerationJobRow[]>`
    SELECT * FROM "GenerationJob"
    WHERE "userId" = ${userId}
      AND ("status" IN ('queued','running') OR "updatedAt" >= ${since})
    ORDER BY "updatedAt" DESC
    LIMIT 200
  `;
}

// ---- image helpers (mirrors src/app/api/image/route.ts, kept in sync) ----

function isAssetImageCreditSource(source: string | null | undefined) {
  return source === "character_image_generation" || source === "scene_image_generation" || source === "shot_image_generation";
}

function isAgentImageCreditSource(source: string | null | undefined) {
  return source === "agent_image_generation";
}

function getBytePlusProviderKey(modelId: string | null | undefined, source: string | null | undefined) {
  if (!modelId?.startsWith("byteplus:")) return undefined;
  const prefix = isAssetImageCreditSource(source) ? "asset-image" : isAgentImageCreditSource(source) ? "agent-image" : "conversation-image";
  if (modelId.endsWith("seedream-4-5")) return `${prefix}.seedream-4-5`;
  if (modelId.endsWith("seedream-5-0")) return `${prefix}.seedream-5-0`;
  return undefined;
}

function isSameImageDimensions(a: { width: number; height: number } | undefined, b: { width: number; height: number } | undefined) {
  return Boolean(a && b && a.width === b.width && a.height === b.height);
}

function pickRequestedImages(images: string[], dimensions: Record<string, { width: number; height: number }> | undefined, requestedCount: number, model: string | undefined, settings: { ratio?: string; resolution?: string } | undefined) {
  const expected = getExpectedImageDimensions(model, settings?.resolution, settings?.ratio);
  if (!expected.width || !expected.height || !dimensions) return images.slice(0, requestedCount);
  const matched = images.filter((url) => isSameImageDimensions(dimensions[url], expected));
  return (matched.length > 0 ? matched : images).slice(0, requestedCount);
}

function pickImageDimensions(dimensions: Record<string, { width: number; height: number }> | undefined, urls: string[]) {
  if (!dimensions) return dimensions;
  return Object.fromEntries(urls.map((url) => [url, dimensions[url]]).filter((item): item is [string, { width: number; height: number }] => Boolean(item[1])));
}

function getImageCreditParameterMetadata(settings: { ratio?: string; resolution?: string } | undefined, dimensions: Record<string, { width: number; height: number }> | undefined): Prisma.InputJsonObject {
  const sizes = Object.values(dimensions ?? {}).map((item) => `${item.width}x${item.height}`).filter(Boolean);
  return { settings: { ratio: settings?.ratio ?? "", resolution: settings?.resolution ?? "" }, ratio: settings?.ratio ?? "", resolution: settings?.resolution ?? "", size: sizes[0] ?? "", sizes };
}

function mergeImageCreditMetadata(metadata: Prisma.InputJsonValue | undefined, extra: Prisma.InputJsonObject): Prisma.InputJsonValue {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? { ...metadata, ...extra } : extra;
}

async function markJobSucceeded(id: string, patch: { resultUrls: string[]; reservedNames?: string[]; resultDimensions?: Record<string, { width: number; height: number }>; posterUrl?: string; usage?: unknown; credit?: unknown }) {
  await prisma.$executeRaw`
    UPDATE "GenerationJob" SET
      "status" = 'succeeded', "resultUrls" = ${jsonParam(patch.resultUrls)}::jsonb, "reservedNames" = ${jsonParam(patch.reservedNames)}::jsonb, "resultDimensions" = ${jsonParam(patch.resultDimensions)}::jsonb,
      "posterUrl" = ${patch.posterUrl ?? null}, "usageJson" = ${jsonParam(patch.usage)}::jsonb, "creditJson" = ${jsonParam(patch.credit)}::jsonb,
      "error" = NULL, "errorCode" = NULL, "completedAt" = NOW(), "leaseAt" = NULL, "updatedAt" = NOW()
    WHERE "id" = ${id}
  `;
}

async function scheduleJobRetry(id: string, delayMs: number) {
  await prisma.$executeRaw`
    UPDATE "GenerationJob" SET "nextRunAt" = ${new Date(Date.now() + delayMs)}, "leaseAt" = NULL, "updatedAt" = NOW()
    WHERE "id" = ${id}
  `;
}

function getFiniteNumber(value: unknown) {
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function getUsageMeta(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const usage = record.usage && typeof record.usage === "object" ? record.usage as Record<string, unknown> : record;
  const promptTokens = Math.max(0, Math.floor(getFiniteNumber(usage.promptTokens ?? usage.prompt_tokens) ?? 0));
  const completionTokens = Math.max(0, Math.floor(getFiniteNumber(usage.completionTokens ?? usage.completion_tokens) ?? 0));
  const totalTokens = Math.max(0, Math.floor(getFiniteNumber(usage.totalTokens ?? usage.total_tokens) ?? promptTokens + completionTokens));
  const usd = getFiniteNumber(usage.usd ?? usage.cost ?? usage.totalCost ?? usage.total_cost ?? usage.amount);
  if (totalTokens > 0 || usd !== undefined) return { promptTokens, completionTokens, totalTokens, ...(usd !== undefined ? { usd } : {}) };
  for (const key of ["data", "result", "task", "content", "payload"]) {
    const nestedUsage = getUsageMeta(record[key]);
    if (nestedUsage) return nestedUsage;
  }
  return undefined;
}

function withBytePlusVideoUsd(usage: Record<string, unknown> | undefined, model: string | null | undefined, settings?: { resolution?: string }) {
  if (!usage || usage.usd !== undefined || !model?.startsWith("byteplus:video.")) return usage;
  const outputTokens = Math.max(0, Number(usage.completionTokens ?? usage.totalTokens ?? 0));
  const pricePerMillion = model === "byteplus:video.seedance-2-0-fast" ? 5.6 : settings?.resolution === "1080p" ? 7.7 : 7.0;
  return { ...usage, usd: (outputTokens / 1_000_000) * pricePerMillion };
}

function withChargedUsage(usage: Record<string, unknown> | undefined, credit: Awaited<ReturnType<typeof chargeCredits>> | undefined) {
  if (!credit || credit.skipped) return usage;
  return { ...(usage ?? {}), usd: credit.chargedUsd, cny: credit.chargedCny };
}

function normalizeVideoStatus(status: unknown) {
  if (typeof status === "number") {
    if (status === 0) return "queued";
    if (status === 1) return "running";
    if (status === 2) return "succeeded";
    if (status === 3) return "failed";
    if (status === 4) return "cancelled";
  }
  if (typeof status === "string") {
    const value = status.trim().toLowerCase();
    if (value === "pending") return "queued";
    if (value === "in_progress" || value === "processing") return "running";
    if (value === "completed" || value === "complete" || value === "done") return "succeeded";
    return value;
  }
  return undefined;
}

function getTaskStatus(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const status = normalizeVideoStatus(record.status ?? record.state ?? record.taskStatus ?? record.task_status);
  if (status) return status;
  for (const key of ["data", "result", "task", "content", "payload"]) {
    const nestedStatus = getTaskStatus(record[key]);
    if (nestedStatus) return nestedStatus;
  }
  return undefined;
}

function getVideoErrorMessage(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const success = record.success;
  const code = record.code;
  const message = record.msg ?? record.message ?? record.error;
  if (success === false || (typeof code === "string" && code !== "0" && code !== "200")) {
    return [typeof code === "string" || typeof code === "number" ? `code=${code}` : "", typeof message === "string" ? message : "视频平台返回失败"].filter(Boolean).join("，");
  }
  if (typeof message === "string" && message.trim()) return message.trim();
  if (message && typeof message === "object" && typeof (message as { message?: unknown }).message === "string") return (message as { message: string }).message;
  for (const key of ["data", "result", "task", "content", "payload"]) {
    const nestedMessage = getVideoErrorMessage(record[key]);
    if (nestedMessage) return nestedMessage;
  }
  return undefined;
}

function getVideoUrl(value: unknown): string | undefined {
  if (typeof value === "string" && /^https?:\/\//.test(value) && /(\.mp4|\.mov|\.webm)(\?|$)/i.test(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string" && /^https?:\/\//.test(item)) return item;
      const videoUrl = getVideoUrl(item);
      if (videoUrl) return videoUrl;
    }
    return undefined;
  }
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ["video_url", "videoUrl", "url", "video", "outputUrl", "output_url", "message", "unsigned_urls", "urls"]) {
    const item = record[key];
    if (typeof item === "string" && item.trim()) return item.trim();
  }
  for (const item of Object.values(record)) {
    const videoUrl = getVideoUrl(item);
    if (videoUrl) return videoUrl;
  }
  return undefined;
}

async function markJobFailed(id: string, error: string, errorCode?: string) {
  await prisma.$executeRaw`
    UPDATE "GenerationJob" SET
      "status" = 'failed', "error" = ${error.slice(0, 500)}, "errorCode" = ${errorCode ?? null},
      "reservedNames" = NULL,
      "completedAt" = NOW(), "leaseAt" = NULL, "updatedAt" = NOW()
    WHERE "id" = ${id}
  `;
}

const MAX_IMAGE_JOB_ATTEMPTS = 6;

function deriveWorkflowCode(workflowCode: string | null, title: string | null): string {
  if (workflowCode && workflowCode.trim()) return workflowCode.trim();
  const match = (title ?? "").match(/(\d+)/);
  if (match) return `w${Number(match[1])}`;
  return "w0";
}

/**
 * 后端在图片任务成功时直接写入资产库（MediaAsset + UserAssetState）。
 * 这样即使用户永远不回来，成品图也一定进资产库、不丢。名称在提交任务时已原子保留，
 * 成功时直接提交该名称，避免完成顺序和前端计数器影响命名。
 */
async function finalizeImageJobAsset(job: GenerationJobRow, images: string[], dimensions: Record<string, { width: number; height: number }> | undefined) {
  const isWorkflow = job.flow === "workflow" && Boolean(job.workflowId);
  const isAsset = isAssetImageCreditSource(job.creditSource);
  const sourcePrompt = (job.extraJson?.cleanPrompt as string | undefined) || job.prompt || undefined;
  const settings = job.settingsJson ?? undefined;
  const flow = isAsset ? "asset" : isWorkflow ? "workflow" : "conversation";
  const assetKind: AssetGenerationKind | undefined = isAsset ? (job.creditSource === "scene_image_generation" ? "scene" : job.creditSource === "shot_image_generation" ? "shot" : "character") : undefined;
  const initialCategory = classifyAsset({ origin: "generated", flow, mediaType: "image", assetKind }).initialCategory;

  await prisma.$transaction(async (tx) => {
    for (const [index, rawUrl] of images.entries()) {
      const resolved = resolvePersistableMediaAssetUrl(job.userId, rawUrl);
      if (!resolved) continue;
      const dim = dimensions?.[rawUrl];
      const name = job.reservedNames?.[index];
      if (!name) throw new Error(`Missing image name reservation for ${job.requestId}`);
      const media = await tx.mediaAsset.upsert({
        where: { userId_normalizedUrl: { userId: job.userId, normalizedUrl: resolved.normalizedUrl } },
        create: buildMediaAssetRecord({
          userId: job.userId, origin: "generated", flow, mediaType: "image", assetKind,
          url: resolved.url, normalizedUrl: resolved.normalizedUrl, originalUrl: resolved.originalUrl, thumbnailUrl: resolved.thumbnailUrl,
          name, sourcePrompt,
          model: job.model ?? undefined, ratio: settings?.ratio, resolution: settings?.resolution,
          generationSettings: (settings ?? undefined) as Prisma.InputJsonValue | undefined,
          width: dim?.width, height: dim?.height,
          conversationId: job.conversationId ?? undefined, messageId: job.messageId ?? undefined,
          workflowId: job.workflowId ?? undefined, workflowNodeId: job.workflowNodeId ?? undefined,
          requestId: job.requestId,
        }),
        // 出生即冻结：记录已存在则完全不改内容。
        update: {},
        select: { id: true },
      });
      const existingState = await tx.userAssetState.findUnique({ where: { userId_mediaAssetId: { userId: job.userId, mediaAssetId: media.id } }, select: { id: true } });
      if (!existingState) {
        await tx.userAssetState.create({ data: buildUserAssetStateRecord({ userId: job.userId, mediaAssetId: media.id, name, initialCategory }) });
      }
    }
  });
}


/** 执行一条图片任务：调模型 → 挑选交付 → 扣费 → 落成功/失败。可安全重复调用（扣费按 requestId 幂等）。 */
export async function runImageJob(job: GenerationJobRow) {
  const startedAt = Date.now();
  const creditSource = job.creditSource ?? undefined;
  const referenceImages = Array.isArray(job.referenceImages) ? job.referenceImages : [];
  const settings = job.settingsJson ?? undefined;
  const requestedImageCount = Math.min(4, Math.max(1, Math.floor(job.count ?? 1)));
  try {
    job = { ...job, reservedNames: await ensureJobReservedNames(job) };
    if (job.attempts > MAX_IMAGE_JOB_ATTEMPTS) {
      await markJobFailed(job.id, "生成任务多次尝试仍未完成。", "JOB_MAX_ATTEMPTS");
      return;
    }
    const user = job.userId ? await prisma.user.findUnique({ where: { id: job.userId }, select: { id: true } }) : null;
    const result = await generateOpenRouterImage(job.prompt ?? "", referenceImages, {
      model: job.model ?? undefined,
      bytePlusProviderKey: getBytePlusProviderKey(job.model, creditSource),
      settings,
      count: requestedImageCount,
      candidateMode: (job.extraJson?.candidateMode as "all" | "best" | undefined) ?? undefined,
      requestId: job.requestId,
      userId: job.userId,
    });
    const providerReturnedImageCount = result.images.length;
    const deliveredImages = pickRequestedImages(result.images, result.imageDimensions, requestedImageCount, job.model ?? undefined, settings);
    if (deliveredImages.length === 0) {
      const codedError = await createCodedApiError(new Error("图片平台没有返回图片，且没有返回可用原因。"), GENERIC_MEDIA_ERROR_MESSAGE, "image-generation empty delivery");
      await markJobFailed(job.id, codedError.error, codedError.errorCode);
      void recordGenerationEvent({ userId: job.userId, requestId: job.requestId, kind: "image", creditSource, model: job.model ?? undefined, provider: job.provider ?? undefined, status: "failed", failureReason: codedError.error, failureCode: codedError.errorCode, durationMs: Date.now() - startedAt, referenceImageCount: referenceImages.length });
      void appendGenerationDiagnosticsLog({ event: "image-job-empty-delivery", requestId: job.requestId, conversationId: job.conversationId ?? undefined, userId: job.userId, mode: "image", model: job.model ?? undefined, prompt: job.prompt ?? undefined, settings, durationMs: Date.now() - startedAt, error: codedError.error, extra: { requestedImageCount, providerReturnedImageCount } });
      return;
    }
    const deliveredImageDimensions = pickImageDimensions(result.imageDimensions, deliveredImages);
    // 统一持久化：有些图（如 byteplus 异步存盘）交付时还是远程 provider url。这里先等本地存盘拿到
    // 稳定本地 url 再落库，保证服务端 finalizeImageJobAsset 是唯一权威出生入口、参数齐全（走
    // buildMediaAssetRecord 存 model/settings/尺寸），避免客户端拿到本地 url 后凭空建空行。与视频同款。
    const localizedImages = await Promise.all(deliveredImages.map(async (imageUrl) => {
      if (!/^https?:\/\//i.test(imageUrl)) return { url: imageUrl, dimensions: deliveredImageDimensions?.[imageUrl] };
      const needsOpenRouterAuth = imageUrl.startsWith("https://openrouter.ai/api/v1/");
      let saveJob = await enqueueRemoteAssetSave({ remoteUrl: imageUrl, type: "image", authProvider: needsOpenRouterAuth ? "openrouter" : undefined, requestId: job.requestId, model: job.model ?? undefined, prompt: job.prompt ?? "", userId: job.userId });
      if (saveJob?.id && saveJob.status !== "saved") {
        const waited = await waitForMediaSaveJob(saveJob.id, 60_000);
        if (waited) saveJob = waited;
      }
      return { url: saveJob?.localUrl ?? imageUrl, dimensions: saveJob?.dimensions ?? deliveredImageDimensions?.[imageUrl] };
    }));
    const finalImages = localizedImages.map((item) => item.url);
    const finalImageDimensions = localizedImages.reduce<Record<string, { width: number; height: number }>>((acc, item) => { if (item.dimensions) acc[item.url] = item.dimensions; return acc; }, {});
    const hasFinalDimensions = Object.keys(finalImageDimensions).length > 0;
    const credit = user ? await chargeCredits(user.id, "image", result.usage, {
      conversationId: job.conversationId ?? undefined,
      conversationTitle: job.conversationTitle ?? undefined,
      requestId: job.requestId,
      label: "图片生成",
      model: job.model ?? undefined,
      imageCount: finalImages.length,
      metadata: mergeImageCreditMetadata(job.metadataJson as Prisma.InputJsonValue | undefined, { ...getImageCreditParameterMetadata(settings, hasFinalDimensions ? finalImageDimensions : deliveredImageDimensions), originalPrompt: job.prompt ?? "", requestedImageCount, returnedImageCount: finalImages.length, providerReturnedImageCount, billableImageCount: finalImages.length, mediaUrls: finalImages, allMediaUrls: finalImages, extraMediaUrls: [], delivered: true }),
    }) : undefined;
    const reservedNames = (job.reservedNames ?? []).slice(0, finalImages.length);
    await finalizeImageJobAsset({ ...job, reservedNames }, finalImages, hasFinalDimensions ? finalImageDimensions : undefined);
    await markJobSucceeded(job.id, { resultUrls: finalImages, reservedNames, resultDimensions: hasFinalDimensions ? finalImageDimensions : undefined, usage: result.usage, credit });
    void recordGenerationEvent({ userId: job.userId, requestId: job.requestId, kind: "image", creditSource, model: job.model ?? undefined, provider: job.provider ?? undefined, status: "success", durationMs: Date.now() - startedAt, referenceImageCount: referenceImages.length });
    void appendGenerationDiagnosticsLog({ event: "image-job-success", requestId: job.requestId, conversationId: job.conversationId ?? undefined, userId: job.userId, mode: "image", model: job.model ?? undefined, prompt: job.prompt ?? undefined, settings, durationMs: Date.now() - startedAt, extra: { requestedImageCount, returnedImageCount: deliveredImages.length, providerReturnedImageCount, deliveredImages: deliveredImages.map((url, index) => summarizeGeneratedReference(url, index)), dimensions: deliveredImageDimensions, credit } });
  } catch (error) {
    const codedError = await createCodedApiError(error, GENERIC_MEDIA_ERROR_MESSAGE, "image-job failed");
    await markJobFailed(job.id, codedError.error, codedError.errorCode);
    void recordGenerationEvent({ userId: job.userId, requestId: job.requestId, kind: "image", creditSource, model: job.model ?? undefined, provider: job.provider ?? undefined, status: "failed", failureReason: codedError.error, failureCode: codedError.errorCode, durationMs: Date.now() - startedAt, referenceImageCount: referenceImages.length });
    void appendGenerationDiagnosticsLog({ event: "image-job-failed", requestId: job.requestId, conversationId: job.conversationId ?? undefined, userId: job.userId, mode: "image", model: job.model ?? undefined, prompt: job.prompt ?? undefined, settings, durationMs: Date.now() - startedAt, error, extra: { errorCode: codedError.errorCode, userError: codedError.error } });
  }
}

/**
 * 认领一批待处理的图片任务（原子 UPDATE ... RETURNING）。同时回收"卡在 running 但 lease 过期"
 * 的任务（进程崩溃/重启遗留），实现重启自愈。新近 lease 的 running 任务会被跳过，避免并发重复执行。
 */
export async function claimImageJobs(limit = 3): Promise<GenerationJobRow[]> {
  return prisma.$queryRaw<GenerationJobRow[]>`
    UPDATE "GenerationJob" SET "status" = 'running', "leaseAt" = NOW(), "attempts" = "attempts" + 1, "startedAt" = COALESCE("startedAt", NOW()), "updatedAt" = NOW()
    WHERE "id" IN (
      SELECT "id" FROM "GenerationJob"
      WHERE "kind" = 'image'
        AND "status" IN ('queued','running')
        AND ("nextRunAt" IS NULL OR "nextRunAt" <= NOW())
        AND ("leaseAt" IS NULL OR "leaseAt" <= NOW() - INTERVAL '10 minutes')
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `;
}

async function finalizeVideoJobAsset(job: GenerationJobRow, videoUrl: string, posterUrl?: string, dimensions?: { width: number; height: number }) {
  const isWorkflow = job.flow === "workflow" && Boolean(job.workflowId);
  const sourcePrompt = (job.extraJson?.cleanPrompt as string | undefined) || job.prompt || undefined;
  const settings = job.settingsJson ?? undefined;
  const flow = isWorkflow ? "workflow" : "conversation";
  const initialCategory = classifyAsset({ origin: "generated", flow, mediaType: "video" }).initialCategory;
  const resolved = resolvePersistableMediaAssetUrl(job.userId, videoUrl);
  if (!resolved) return;
  const name = job.reservedNames?.[0];
  if (!name) throw new Error(`Missing video name reservation for ${job.requestId}`);
  await prisma.$transaction(async (tx) => {
    const media = await tx.mediaAsset.upsert({
      where: { userId_normalizedUrl: { userId: job.userId, normalizedUrl: resolved.normalizedUrl } },
      create: buildMediaAssetRecord({
        userId: job.userId, origin: "generated", flow, mediaType: "video",
        url: resolved.url, normalizedUrl: resolved.normalizedUrl, originalUrl: resolved.originalUrl,
        posterUrl, thumbnailUrl: posterUrl, name, sourcePrompt,
        model: job.model ?? undefined, ratio: settings?.ratio, resolution: settings?.resolution, videoDuration: settings?.duration,
        generationSettings: (settings ?? undefined) as Prisma.InputJsonValue | undefined,
        width: dimensions?.width, height: dimensions?.height,
        conversationId: job.conversationId ?? undefined, messageId: job.messageId ?? undefined,
        workflowId: job.workflowId ?? undefined, workflowNodeId: job.workflowNodeId ?? undefined,
        requestId: job.requestId,
      }),
      // 出生即冻结；仅回填晚到的视频封面。
      update: { posterUrl: posterUrl ?? undefined, thumbnailUrl: posterUrl ?? undefined },
      select: { id: true },
    });
    const existingState = await tx.userAssetState.findUnique({ where: { userId_mediaAssetId: { userId: job.userId, mediaAssetId: media.id } }, select: { id: true } });
    if (!existingState) await tx.userAssetState.create({ data: buildUserAssetStateRecord({ userId: job.userId, mediaAssetId: media.id, name, initialCategory }) });
  });
}

export async function runVideoJob(job: GenerationJobRow) {
  const providerTaskId = job.providerTaskId;
  if (!providerTaskId) return markJobFailed(job.id, "视频平台没有返回任务编号");
  try {
    job = { ...job, reservedNames: await ensureJobReservedNames(job) };
    const task = await getOpenRouterVideoTask(providerTaskId);
    const videoError = getVideoErrorMessage(task);
    if (videoError) {
      const codedError = await createCodedApiError(new Error(videoError), GENERIC_MEDIA_ERROR_MESSAGE, "video job polling failed");
      void recordGenerationEvent({ userId: job.userId, requestId: job.requestId, kind: "video", creditSource: job.creditSource ?? undefined, model: job.model ?? undefined, provider: job.provider ?? undefined, status: "failed", failureReason: codedError.error, failureCode: codedError.errorCode });
      await markJobFailed(job.id, codedError.error, codedError.errorCode);
      return;
    }
    const status = getTaskStatus(task) ?? normalizeVideoStatus((task as { status?: unknown }).status) ?? "running";
    const videoUrl = getVideoUrl(task);
    if (["succeeded", "success", "completed", "complete"].includes(status) && videoUrl) {
      const needsOpenRouterAuth = videoUrl.startsWith("https://openrouter.ai/api/v1/videos/");
      let saveJob = await enqueueRemoteAssetSave({ remoteUrl: videoUrl, type: "video", authProvider: needsOpenRouterAuth ? "openrouter" : undefined, videoTaskId: providerTaskId, requestId: job.requestId, model: job.model ?? undefined, prompt: job.prompt ?? "", userId: job.userId });
      // Wait for the local save so the durable job stores a stable local URL (the remote provider URL
      // expires ~24h) and the asset library actually gets the video even if the user never returns.
      if (saveJob?.id && saveJob.status !== "saved") {
        const waited = await waitForMediaSaveJob(saveJob.id, 60_000);
        if (waited) saveJob = waited;
      }
      const deliveredUrl = saveJob?.localUrl ?? videoUrl;
      await upsertVideoManifestEntry({ taskId: providerTaskId, prompt: job.prompt ?? "", localVideoUrl: deliveredUrl, remoteVideoUrl: videoUrl, posterUrl: saveJob?.posterUrl });
      const usage = withBytePlusVideoUsd(getUsageMeta(task) ?? job.usageJson ?? undefined, job.model, job.settingsJson ?? undefined);
      const credit = await chargeCredits(job.userId, "video", usage, { conversationId: job.conversationId ?? undefined, conversationTitle: job.conversationTitle ?? undefined, requestId: job.requestId, label: "视频生成", model: job.model ?? undefined, videoCount: 1, metadata: { ...(job.metadataJson ?? {}), settings: job.settingsJson, ratio: job.settingsJson?.ratio, resolution: job.settingsJson?.resolution, duration: job.settingsJson?.duration, originalPrompt: job.prompt, mediaUrls: [deliveredUrl], remoteMediaUrls: [videoUrl], posterUrl: saveJob?.posterUrl, delivered: true, savedLocal: saveJob?.status === "saved", localSaveStatus: saveJob?.status ?? "pending", mediaSaveJobId: saveJob?.id } });
      await finalizeVideoJobAsset(job, deliveredUrl, saveJob?.posterUrl, saveJob?.dimensions);
      await markJobSucceeded(job.id, { resultUrls: [deliveredUrl], reservedNames: job.reservedNames ?? [], posterUrl: saveJob?.posterUrl, usage: withChargedUsage(usage, credit), credit });
      void recordGenerationEvent({ userId: job.userId, requestId: job.requestId, kind: "video", creditSource: job.creditSource ?? undefined, model: job.model ?? undefined, provider: job.provider ?? undefined, status: "success" });
      return;
    }
    if (["succeeded", "success", "completed", "complete"].includes(status)) {
      const codedError = await createCodedApiError(new Error("视频平台返回已完成，但没有返回视频地址。"), GENERIC_MEDIA_ERROR_MESSAGE, "video job completed without url");
      await markJobFailed(job.id, codedError.error, codedError.errorCode);
      return;
    }
    await scheduleJobRetry(job.id, 8000);
  } catch (error) {
    console.warn("[generation-jobs] video poll transient", { requestId: job.requestId, error: error instanceof Error ? error.message : String(error) });
    await scheduleJobRetry(job.id, 10000);
  }
}

export async function claimVideoJobs(limit = 4): Promise<GenerationJobRow[]> {
  return prisma.$queryRaw<GenerationJobRow[]>`
    UPDATE "GenerationJob" SET "leaseAt" = NOW(), "attempts" = "attempts" + 1, "updatedAt" = NOW()
    WHERE "id" IN (
      SELECT "id" FROM "GenerationJob"
      WHERE "kind" = 'video'
        AND "status" = 'running'
        AND "providerTaskId" IS NOT NULL
        AND ("nextRunAt" IS NULL OR "nextRunAt" <= NOW())
        AND ("leaseAt" IS NULL OR "leaseAt" <= NOW() - INTERVAL '10 minutes')
      ORDER BY "updatedAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `;
}
