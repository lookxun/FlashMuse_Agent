import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getBytePlusBaseUrl, getBytePlusModelForRequest, getConfiguredBytePlusApiKey, getConfiguredOpenRouterApiKey, getModelProviderPreference, isBytePlusPreferenceEnabled } from "@/lib/system-settings";

export const CONTENT_POLICY_ERROR_CODE = "CONTENT_POLICY_BLOCKED";
export const CONTENT_POLICY_ERROR_MESSAGE = "你输入的内容不符合平台规则，请更换内容后重试！";
export const SENSITIVE_POLITICS_CATEGORY = "sensitive_politics";

/**
 * 语义审核模型候选链（唯一权威，后台「模型开关 → 内容审核语义模型」那一行就是这两个）。
 * ⭐ 顺序固定：先 OpenRouter GPT-5.6 Terra Pro，连不上/关闭再用 BytePlus Seed 2.0 Pro。
 * ⛔ 别在别处再写一份模型 id：新增模型要三处一起改（这里 + system-settings 默认值 + 后台面板那一行）。
 */
const MODERATION_MODEL_CHAIN = [
  { providerKey: "moderation.priority", provider: "openrouter" as const, modelId: "openai/gpt-5.6-terra-pro" },
  { providerKey: "moderation.seed-2-0-pro", provider: "byteplus" as const, modelId: "byteplus:chat.seed-2-0-pro" },
];

// ⛔ 审核请求必须有超时：它跑在常驻 worker 的 tick 里，卡住会连带拖慢整条队列。
const MODERATION_REQUEST_TIMEOUT_MS = 20000;
// 审核记录保留期：只留最近这些天，避免表无上限增长（后台只看最近 300 条）。
const MODERATION_EVENT_RETENTION_DAYS = 30;
const MODERATION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

type ActiveTerm = { category: string; value: string; normalized: string };
type SemanticReviewJob = { id: string; prompt: string };

let queueRunning = false;
let lastCleanupAt = 0;

export function normalizeContentModerationText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}_]+/gu, "");
}

export function splitContentModerationTerms(value: string) {
  return [...new Set(value.split(/[\n,，]+/).map((item) => item.trim()).filter(Boolean))];
}

export async function findContentPolicyMatch(prompt: string) {
  const normalizedPrompt = normalizeContentModerationText(prompt);
  if (!normalizedPrompt) return undefined;
  const terms = await prisma.$queryRaw<ActiveTerm[]>`
    SELECT g."category", t."value", t."normalized"
    FROM "ContentModerationRuleGroup" g
    INNER JOIN "ContentModerationTerm" t ON t."groupId" = g."id"
    WHERE g."enabled" = true
    ORDER BY length(t."normalized") DESC
  `;
  return terms.find((term) => term.normalized.length > 0 && normalizedPrompt.includes(term.normalized));
}

async function isCategoryEnabled(category: string) {
  const rows = await prisma.$queryRaw<Array<{ enabled: boolean }>>`
    SELECT "enabled" FROM "ContentModerationRuleGroup" WHERE "category" = ${category} LIMIT 1
  `;
  return rows[0]?.enabled === true;
}

async function createEvent(input: {
  userId?: string;
  requestId?: string;
  kind: "image" | "video";
  source: string;
  category: string;
  action: "keyword_block" | "semantic_review";
  status: "blocked" | "pending";
  prompt: string;
  matchedTerm?: string;
}) {
  await prisma.$executeRaw`
    INSERT INTO "ContentModerationEvent" ("id", "userId", "requestId", "kind", "source", "category", "action", "status", "prompt", "matchedTerm", "updatedAt")
    VALUES (${randomUUID()}, ${input.userId ?? null}, ${input.requestId ?? null}, ${input.kind}, ${input.source}, ${input.category}, ${input.action}, ${input.status}, ${input.prompt}, ${input.matchedTerm ?? null}, NOW())
  `;
}

/**
 * ⭐ `prompt` 必须传「用户自己写的那句」（各路由的 `sourcePrompt`），⛔ 不要传发给模型的完整提示词：
 * 资产库/工作流会在前面拼一大段规则文本和参考图说明 —— 那样后台看到的是系统文本而不是用户的话，
 * 而且关键词会拿我们自己拼进去的规则文本去匹配，可能凭空命中。
 */
export async function enforceContentPolicy(input: { prompt: string; userId?: string; requestId?: string; kind: "image" | "video"; source: string; recordEvent?: boolean }) {
  const match = await findContentPolicyMatch(input.prompt);
  if (match) {
    if (input.recordEvent !== false) await createEvent({ ...input, category: match.category, action: "keyword_block", status: "blocked", matchedTerm: match.value });
    return { blocked: true as const, category: match.category, matchedTerm: match.value };
  }

  // Semantic review is observation-only for now. It is queued before generation so a process restart cannot lose it.
  if (input.recordEvent !== false && await isCategoryEnabled(SENSITIVE_POLITICS_CATEGORY)) {
    await createEvent({ ...input, category: SENSITIVE_POLITICS_CATEGORY, action: "semantic_review", status: "pending" });
  }
  return { blocked: false as const };
}

async function claimSemanticReviewJobs(limit: number) {
  return prisma.$queryRaw<SemanticReviewJob[]>`
    UPDATE "ContentModerationEvent" SET "leaseAt" = NOW(), "attempts" = "attempts" + 1, "updatedAt" = NOW()
    WHERE "id" IN (
      SELECT "id" FROM "ContentModerationEvent"
      WHERE "action" = 'semantic_review' AND "status" = 'pending'
        AND ("leaseAt" IS NULL OR "leaseAt" <= NOW() - INTERVAL '10 minutes')
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id", "prompt"
  `;
}

function getModerationProviderConfig(entry: (typeof MODERATION_MODEL_CHAIN)[number]) {
  if (entry.provider === "byteplus") {
    if (!isBytePlusPreferenceEnabled(entry.providerKey)) return undefined;
    const apiKey = getConfiguredBytePlusApiKey();
    if (!apiKey) return undefined;
    return {
      url: `${getBytePlusBaseUrl()}/chat/completions`,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      model: getBytePlusModelForRequest(entry.providerKey),
      label: entry.modelId,
    };
  }

  if (getModelProviderPreference(entry.providerKey) === "byteplus") return undefined;
  const apiKey = getConfiguredOpenRouterApiKey();
  if (!apiKey) return undefined;
  return {
    url: "https://openrouter.ai/api/v1/chat/completions",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    model: entry.modelId,
    label: entry.modelId,
  };
}

async function classifyWithModel(config: NonNullable<ReturnType<typeof getModerationProviderConfig>>, prompt: string) {
  const response = await fetch(config.url, {
    method: "POST",
    headers: config.headers,
    signal: AbortSignal.timeout(MODERATION_REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      model: config.model,
      temperature: 0,
      messages: [
        { role: "system", content: "你是内容审核分类器。只判断用户提示词是否疑似涉及敏感政治内容。只返回严格 JSON：{\"flagged\":true|false,\"reason\":\"不超过40字\"}。不要解释，不要改写提示词。" },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!response.ok) throw new Error(`审核模型请求失败：${response.status}`);
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const raw = data.choices?.[0]?.message?.content ?? "";
  const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? raw;
  const parsed = JSON.parse(json) as { flagged?: unknown; reason?: unknown };
  return { flagged: parsed.flagged === true, reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 240) : undefined };
}

/** 按候选链依次尝试：前一个关闭/没配密钥就跳过，报错/超时就换下一个，全都不行才抛错。 */
async function classifySensitivePolitics(prompt: string) {
  let lastError: unknown;
  let hasCandidate = false;
  for (const entry of MODERATION_MODEL_CHAIN) {
    const config = getModerationProviderConfig(entry);
    if (!config) continue;
    hasCandidate = true;
    try {
      return await classifyWithModel(config, prompt);
    } catch (error) {
      lastError = error;
    }
  }
  if (!hasCandidate) throw new Error("没有可用的语义审核模型（后台模型开关已全部关闭或未配置密钥）");
  throw lastError instanceof Error ? lastError : new Error("审核失败");
}

async function cleanupExpiredModerationEvents() {
  if (Date.now() - lastCleanupAt < MODERATION_CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = Date.now();
  await prisma.$executeRawUnsafe(
    `DELETE FROM "ContentModerationEvent" WHERE "createdAt" < NOW() - INTERVAL '${MODERATION_EVENT_RETENTION_DAYS} days'`,
  ).catch(() => 0);
}

/**
 * ⛔ 调用方**不要 await 它**（worker 里用 `void`）：它会打外网模型，
 * 一旦上游变慢就会把生成任务的认领 tick 一起拖住。内部已有并发保护。
 */
export async function processContentModerationQueue(limit = 2) {
  if (queueRunning) return;
  queueRunning = true;
  try {
    await cleanupExpiredModerationEvents();
    const jobs = await claimSemanticReviewJobs(limit);
    await Promise.all(jobs.map(async (job) => {
      try {
        const result = await classifySensitivePolitics(job.prompt);
        await prisma.$executeRaw`
          UPDATE "ContentModerationEvent"
          SET "status" = ${result.flagged ? "flagged" : "clear"}, "semanticReason" = ${result.reason ?? null}, "reviewedAt" = NOW(), "leaseAt" = NULL, "updatedAt" = NOW()
          WHERE "id" = ${job.id}
        `;
      } catch (error) {
        await prisma.$executeRaw`
          UPDATE "ContentModerationEvent"
          SET "status" = CASE WHEN "attempts" >= 3 THEN 'error' ELSE 'pending' END, "semanticReason" = ${error instanceof Error ? error.message.slice(0, 240) : "审核失败"}, "leaseAt" = NULL, "updatedAt" = NOW()
          WHERE "id" = ${job.id}
        `;
      }
    }));
  } catch (error) {
    console.warn("[content-moderation] queue failed", { error: error instanceof Error ? error.message : String(error) });
  } finally {
    queueRunning = false;
  }
}
