import type { UsageLike } from "@/lib/credits";
import { getBytePlusVideoPricePerMillionUsd, HAILUO3_VIDEO_MODEL_ID } from "@/lib/models";

/**
 * 视频生成「用量 → 美元成本」的唯一权威（2026-08-03 收敛）。
 *
 * ⛔ 收敛前 `src/app/api/video/route.ts`（前台同步轮询那条路）和 `src/lib/generation-jobs.ts`
 *    （后台任务队列那条路）**各存一份一字不差的 `getUsageMeta` / `withBytePlusVideoUsd` / `withChargedUsage`**。
 *    扣费金额是钱，两份各自演化的后果是"对话流扣对了、工作流白送"这类静默漏收 —— 按
 *    `AGENTS.md`「能统一一律统一」必须只有一份。改扣费口径**只改本文件**。
 *
 * ⭐ 2026-08-03 实测确认（不是推测）：OpenRouter 视频轮询响应**确实带 `usage.cost`** ——
 *    `GET /api/v1/videos/{id}` 对已完成的 MiniMax H3 任务返回
 *    `{"status":"completed","usage":{"cost":1.95,"is_byok":false}}`（15 秒 2K）。
 *    本地 `creditLedger` 那 5 笔 `minimax/hailuo-3` 也都是 `usd=1.95 / credits=137`，
 *    → **整条按成本扣费链路是通的**，H3 不需要单独配价格表。
 */
export type VideoUsageMeta = UsageLike & { cny?: number };

function getFiniteNumber(value: unknown) {
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

/**
 * 从上游任意形状的响应里递归挖出用量/成本。
 * `usd` 认这些别名：`usd` / `cost` / `totalCost` / `total_cost` / `amount`（OpenRouter 视频用的是 `usage.cost`）。
 */
export function getVideoUsageMeta(value: unknown): VideoUsageMeta | undefined {
  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  const usage = record.usage && typeof record.usage === "object" ? (record.usage as Record<string, unknown>) : record;
  const promptTokens = Math.max(0, Math.floor(getFiniteNumber(usage.promptTokens ?? usage.prompt_tokens) ?? 0));
  const completionTokens = Math.max(0, Math.floor(getFiniteNumber(usage.completionTokens ?? usage.completion_tokens) ?? 0));
  const totalTokens = Math.max(0, Math.floor(getFiniteNumber(usage.totalTokens ?? usage.total_tokens) ?? promptTokens + completionTokens));
  const usd = getFiniteNumber(usage.usd ?? usage.cost ?? usage.totalCost ?? usage.total_cost ?? usage.amount);

  if (totalTokens > 0 || usd !== undefined) return { promptTokens, completionTokens, totalTokens, ...(usd !== undefined ? { usd } : {}) };

  for (const key of ["data", "result", "task", "content", "payload"]) {
    const nestedUsage = getVideoUsageMeta(record[key]);
    if (nestedUsage) return nestedUsage;
  }

  return undefined;
}

/** MiniMax H3 官方价（OpenRouter `videos/models` 的 `pricing`）：按秒 + 按参考图张数。 */
const HAILUO3_USD_PER_SECOND = 0.13;
const HAILUO3_USD_PER_REFERENCE_IMAGE = 0.04;

function getDurationSeconds(duration: string | undefined) {
  const seconds = Number(String(duration ?? "").match(/\d+/)?.[0]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

export type VideoUsdFallbackInput = {
  model?: string | null;
  settings?: { resolution?: string; duration?: string } | null;
  hasVideoInput?: boolean;
  referenceImageCount?: number;
};

/**
 * 上游没给成本时的兜底定价（**只在 `usage.usd` 缺失时生效**，给了就一个字不动）。
 *
 * ⭐ 为什么必须有兜底：`chargeCredits` 是 `usd × 汇率 × 积分率`，
 *    `usd=0` 就是**扣 0 分 = 白送**，而且失败得毫无声响（不报错、不进红字）。
 * - BytePlus 视频：按输出 token × 每百万价（老逻辑，原样搬过来）。
 * - MiniMax H3：按 `时长 × $0.13 + 参考图张数 × $0.04`（实测 15 秒 = $1.95、5 秒 = $0.65，对得上）。
 * - 其它 OpenRouter 视频模型：仍返回原样（它们历史上都带 cost）。
 */
export function withVideoUsdFallback(usage: VideoUsageMeta | undefined, input: VideoUsdFallbackInput): VideoUsageMeta | undefined {
  const model = input.model ?? undefined;

  if (model?.startsWith("byteplus:video.")) {
    if (!usage || usage.usd !== undefined) return usage;
    const outputTokens = Math.max(0, usage.completionTokens ?? usage.totalTokens ?? 0);
    const pricePerMillion = getBytePlusVideoPricePerMillionUsd(model, input.settings?.resolution, input.hasVideoInput ?? false);
    return { ...usage, usd: (outputTokens / 1_000_000) * pricePerMillion };
  }

  if (model === HAILUO3_VIDEO_MODEL_ID && (usage?.usd ?? 0) <= 0) {
    const seconds = getDurationSeconds(input.settings?.duration);
    if (seconds <= 0) return usage;
    const referenceImages = Math.max(0, Math.floor(input.referenceImageCount ?? 0));
    const usd = seconds * HAILUO3_USD_PER_SECOND + referenceImages * HAILUO3_USD_PER_REFERENCE_IMAGE;
    return { ...(usage ?? {}), usd, usdFromFallbackPricing: true } as VideoUsageMeta;
  }

  return usage;
}

/** 落库/回前端时把「真实扣掉的钱」写回 usage（前端用量卡显示的是这个，不是上游报价）。 */
export function withChargedVideoUsage(usage: VideoUsageMeta | undefined, credit: { skipped: boolean; chargedUsd: number; chargedCny: number } | undefined) {
  if (!credit || credit.skipped) return usage;
  return { ...(usage ?? {}), usd: credit.chargedUsd, cny: credit.chargedCny };
}
