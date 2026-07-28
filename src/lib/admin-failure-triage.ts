import { prisma } from "@/lib/prisma";
import { bytePlusImageGenerationModels, bytePlusVideoGenerationModels, imageGenerationModels, videoGenerationModels } from "@/lib/models";

/**
 * 后台「失败排查」页数据聚合 —— 唯一权威实现。
 *
 * 为什么单独做一页：排查线上红字是长期主线（方法论见 handover/07-red-error-triage-and-archive.md），
 * 而概览页那个「失败原因」小卡只能看条数排行，缺了排查真正需要的几件事：
 *   ① ⭐ 这条原因**最近还在发生吗** —— 还在流血 = 没修好；已停止 = 大概率修好了、可以去归档。
 *   ② ⭐ 它是不是落在**兜底桶**里 —— 兜底桶（「服务器繁忙…」/「请求失败…」）不是一个原因，
 *      而是一堆没识别出来的根因的混合体，从文案本身查不出任何东西，必须回诊断日志捞原文。
 *      兜底桶的大小 = 我们对线上失败的"盲区"有多大，是最该盯的一个数。
 *   ③ 涉及哪些模型 / 哪些入口（对话流·工作流·资产库·Agent）—— 只在某一个入口出，几乎一定是"该统一却分叉了"。
 *   ④ 样本 requestId —— 拿着它才能去 .runtime/*-diagnostics-log.jsonl 捞真实原文。
 *
 * ⚠️ 这一页只读不写，不会改任何生成链路。归档动作仍然只由
 *    scripts/archive-resolved-generation-failures.mjs 执行（唯一入口）。
 */

/**
 * ⭐ 失败原因归一化 SQL 表达式（唯一权威，概览页与本页共用，禁止再抄一份）：
 * - 去掉每条独有的错误编号前缀 `(B_123) `，否则同一个原因会被拆成几百条
 * - `图片平台没有返回图片：<模型原话>` 这种带可变尾巴的收敛成一条
 */
export const FAILURE_REASON_SQL = `regexp_replace(regexp_replace("failureReason", '^\\(B_[0-9]+\\)\\s*', ''), '^(图片平台没有返回图片)：.*$', '\\1（模型未产出或拒绝生成）')`;

/**
 * 两个兜底桶（都是"没识别出根因"的意思）：
 * - 显式传 `GENERIC_MEDIA_ERROR_MESSAGE` → 「服务器繁忙，请稍候再试.....」
 * - `toUserErrorMessage` 的默认 fallback → 「请求失败，请稍后再试。」
 * ⚠️ 同一个根因会因为调用处传不传 fallback 而**同时污染两个**（余额不足就是 53 + 13）。
 */
export const GENERIC_FALLBACK_REASONS = ["服务器繁忙，请稍候再试.....", "请求失败，请稍后再试。"];

export type FailureTriageReason = {
  reason: string;
  total: number;
  /** 落在兜底桶里（从文案本身查不出根因，必须回日志捞原文） */
  isFallbackBucket: boolean;
  /** 是否被判定为审核类（平台/模型内容策略拒绝） */
  moderationCount: number;
  today: number;
  last7Days: number;
  /** 最近 7 天还在发生 = 还在流血（没修好或修了没生效） */
  stillBleeding: boolean;
  /** ⚠️ 日期一律在服务端格式化成字符串再传给客户端组件：
   *  在客户端 format 会因为服务器与浏览器时区/时钟不同触发 hydration mismatch（React #418，本次踩过）。 */
  firstAtLabel: string;
  lastAtLabel: string;
  lastAtAgoLabel: string;
  affectedUsers: number;
  /** 涉及的模型（按条数倒序，最多 4 个） */
  models: Array<{ label: string; count: number }>;
  /** 涉及的入口（对话流 / 工作流 / 资产库 / Agent…） */
  sources: Array<{ label: string; count: number }>;
  kinds: Array<{ label: string; count: number }>;
  /** 样本：拿 requestId 去 .runtime 诊断日志捞真实原文 */
  samples: Array<{ requestId: string | null; model: string; source: string; createdAtLabel: string }>;
};

export type FailureTriageResolvedReason = {
  reason: string;
  note: string;
  total: number;
  resolvedAtLabel: string;
  lastAtLabel: string;
};

export type FailureTriageData = {
  /** 分析表是否可用（迁移未跑时为 false，页面显示占位而不是崩） */
  hasData: boolean;
  summary: {
    pending: number;
    resolved: number;
    pendingReasonCount: number;
    todayPending: number;
    yesterdayPending: number;
    last7DaysPending: number;
    prev7DaysPending: number;
    affectedUsers: number;
    /** 兜底桶（盲区）条数与占比 */
    fallbackTotal: number;
    fallbackRate: number;
    moderationTotal: number;
    /** 全量成功率（用来判断失败是不是普遍性问题） */
    imageTotal: number;
    imageFailed: number;
    videoTotal: number;
    videoFailed: number;
  };
  /** 两个兜底桶各自的条数（同一根因会同时污染两个，排查时两个都要查） */
  fallbackBuckets: Array<{ label: string; total: number; today: number; last7Days: number }>;
  reasons: FailureTriageReason[];
  resolved: FailureTriageResolvedReason[];
  /** 近 30 天失败趋势（图片 / 视频分开） */
  trend: Array<{ label: string; image: number; video: number }>;
  /** 按模型的失败分布（待排查） */
  byModel: Array<{ label: string; total: number; fallback: number; calls: number; failRate: number }>;
  /** 按入口的失败分布（待排查）—— 只在某一个入口出 = 大概率是分叉 */
  bySource: Array<{ label: string; total: number; fallback: number }>;
  /** 失败最多的用户（同一个用户连续踩同一个坑，往往是一个可复现场景） */
  topUsers: Array<{ label: string; userId: string; total: number; topReason: string }>;
};

const SOURCE_LABELS: Record<string, string> = {
  conversation: "对话流",
  workflow: "工作流",
  asset: "资产库",
  assets: "资产库",
  agent: "Agent 模式",
  general: "通用模式",
  chat: "对话",
};

function sourceLabel(value: string | null | undefined) {
  const key = (value ?? "").trim();
  if (!key) return "未记录";
  return SOURCE_LABELS[key] ?? key;
}

const KIND_LABELS: Record<string, string> = { image: "图片", video: "视频", chat: "对话", plan: "Agent 规划" };

function kindLabel(value: string | null | undefined) {
  const key = (value ?? "").trim();
  if (!key) return "未记录";
  return KIND_LABELS[key] ?? key;
}

function modelLabel(modelId: string | null | undefined) {
  const id = (modelId ?? "").trim();
  if (!id) return "未记录";
  const isVideo = /video|seedance|kling|hailuo|wan|veo|sora/i.test(id);
  const models = isVideo ? [...videoGenerationModels, ...bytePlusVideoGenerationModels] : [...imageGenerationModels, ...bytePlusImageGenerationModels];
  return models.find((model) => model.id === id)?.label ?? id;
}

function num(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "bigint" ? Number(value) : typeof value === "string" ? Number(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function startOfLocalDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function dayKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function dayLabel(value: Date) {
  return `${String(value.getMonth() + 1).padStart(2, "0")}/${String(value.getDate()).padStart(2, "0")}`;
}

/** ⚠️ 只在服务端调用（见 FailureTriageReason 上的注释：客户端 format 会触发 hydration mismatch）。 */
function dateTimeLabel(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(value);
}

function agoLabel(value: Date | null) {
  if (!value) return "-";
  const diff = Math.floor((Date.now() - value.getTime()) / 86_400_000);
  return diff <= 0 ? "今天" : `${diff} 天前`;
}

function topEntries(map: Map<string, number>, limit: number) {
  return Array.from(map.entries()).sort((left, right) => right[1] - left[1]).slice(0, limit).map(([label, count]) => ({ label, count }));
}

/** 分析表可能尚未迁移，查询失败时不让整页崩掉。 */
async function safeRows<T>(runner: () => Promise<T[]>): Promise<T[]> {
  try {
    return await runner();
  } catch (error) {
    console.warn("[admin-failure-triage] query failed", error instanceof Error ? error.message : String(error));
    return [];
  }
}

type FailureRow = {
  id: string;
  userId: string | null;
  requestId: string | null;
  kind: string;
  source: string | null;
  model: string | null;
  provider: string | null;
  reason: string;
  moderation: boolean;
  createdAt: Date;
};

export async function getAdminFailureTriageData(): Promise<FailureTriageData> {
  const todayStart = startOfLocalDay();
  const yesterdayStart = addDays(todayStart, -1);
  const sevenDaysAgo = addDays(todayStart, -6);
  const prev7Start = addDays(todayStart, -13);
  const thirtyDaysAgo = addDays(todayStart, -29);
  const days30 = Array.from({ length: 30 }, (_, index) => addDays(todayStart, index - 29));

  // ⭐ 待排查的失败事件全量拉下来在内存里切片：本项目量级只有几百条（正式服 308），
  // 一次查询 + 内存聚合比十几条 group by 更好维护，也不用担心各口径对不上。
  const pendingRows = await safeRows(() => prisma.$queryRawUnsafe<FailureRow[]>(
    `SELECT "id", "userId", "requestId", "kind", "source", "model", "provider", "moderation", "createdAt",
       ${FAILURE_REASON_SQL} AS reason
     FROM "GenerationEvent"
     WHERE "status" = 'failed' AND "failureReason" IS NOT NULL AND "resolvedAt" IS NULL
     ORDER BY "createdAt" DESC`,
  ));

  const [resolvedRows, kindStatusRows, trendRows, modelCallRows, userNameRows] = await Promise.all([
    safeRows(() => prisma.$queryRawUnsafe<Array<{ reason: string; note: string | null; count: bigint; resolvedat: Date | null; lastat: Date | null }>>(
      `SELECT ${FAILURE_REASON_SQL} AS reason, "resolvedNote" AS note, COUNT(*)::bigint AS count,
         MAX("resolvedAt") AS resolvedat, MAX("createdAt") AS lastat
       FROM "GenerationEvent"
       WHERE "status" = 'failed' AND "failureReason" IS NOT NULL AND "resolvedAt" IS NOT NULL
       GROUP BY 1,2 ORDER BY count DESC`,
    )),
    safeRows(() => prisma.$queryRawUnsafe<Array<{ kind: string; status: string; count: bigint }>>(
      `SELECT "kind", "status", COUNT(*)::bigint AS count FROM "GenerationEvent" GROUP BY 1,2`,
    )),
    safeRows(() => prisma.$queryRawUnsafe<Array<{ day: Date; kind: string; count: bigint }>>(
      `SELECT date_trunc('day', "createdAt") AS day, "kind", COUNT(*)::bigint AS count
       FROM "GenerationEvent"
       WHERE "status" = 'failed' AND "createdAt" >= $1
       GROUP BY 1,2`,
      thirtyDaysAgo,
    )),
    safeRows(() => prisma.$queryRawUnsafe<Array<{ model: string | null; calls: bigint }>>(
      `SELECT "model", COUNT(*)::bigint AS calls FROM "GenerationEvent" WHERE "model" IS NOT NULL GROUP BY 1`,
    )),
    prisma.user.findMany({ select: { id: true, email: true, nickname: true } }).catch(() => [] as Array<{ id: string; email: string; nickname: string | null }>),
  ]);

  const hasData = pendingRows.length > 0 || resolvedRows.length > 0 || kindStatusRows.length > 0;

  // ---- 按原因聚合 ----
  type Bucket = {
    total: number;
    moderationCount: number;
    today: number;
    last7Days: number;
    firstAt: Date | null;
    lastAt: Date | null;
    users: Set<string>;
    models: Map<string, number>;
    sources: Map<string, number>;
    kinds: Map<string, number>;
    samples: FailureTriageReason["samples"];
  };
  const byReason = new Map<string, Bucket>();
  const fallbackByReason = new Map<string, { total: number; today: number; last7Days: number }>();
  const modelFailMap = new Map<string, { total: number; fallback: number }>();
  const sourceFailMap = new Map<string, { total: number; fallback: number }>();
  const userFailMap = new Map<string, { total: number; reasons: Map<string, number> }>();
  const allUsers = new Set<string>();
  let fallbackTotal = 0;
  let moderationTotal = 0;
  let todayPending = 0;
  let yesterdayPending = 0;
  let last7DaysPending = 0;
  let prev7DaysPending = 0;

  const isFallback = (reason: string) => GENERIC_FALLBACK_REASONS.some((item) => reason.startsWith(item.slice(0, 8)));

  for (const row of pendingRows) {
    const reason = (row.reason ?? "").trim() || "（空原因）";
    const fallback = isFallback(reason);
    const bucket = byReason.get(reason) ?? {
      total: 0, moderationCount: 0, today: 0, last7Days: 0, firstAt: null, lastAt: null,
      users: new Set<string>(), models: new Map<string, number>(), sources: new Map<string, number>(), kinds: new Map<string, number>(), samples: [] as FailureTriageReason["samples"],
    };
    bucket.total += 1;
    if (row.moderation) bucket.moderationCount += 1;
    if (row.createdAt >= todayStart) bucket.today += 1;
    if (row.createdAt >= sevenDaysAgo) bucket.last7Days += 1;
    if (!bucket.firstAt || row.createdAt < bucket.firstAt) bucket.firstAt = row.createdAt;
    if (!bucket.lastAt || row.createdAt > bucket.lastAt) bucket.lastAt = row.createdAt;
    if (row.userId) bucket.users.add(row.userId);
    const model = modelLabel(row.model);
    bucket.models.set(model, (bucket.models.get(model) ?? 0) + 1);
    const source = sourceLabel(row.source);
    bucket.sources.set(source, (bucket.sources.get(source) ?? 0) + 1);
    const kind = kindLabel(row.kind);
    bucket.kinds.set(kind, (bucket.kinds.get(kind) ?? 0) + 1);
    if (bucket.samples.length < 6) bucket.samples.push({ requestId: row.requestId, model, source, createdAtLabel: dateTimeLabel(row.createdAt) });
    byReason.set(reason, bucket);

    if (fallback) {
      fallbackTotal += 1;
      const item = fallbackByReason.get(reason) ?? { total: 0, today: 0, last7Days: 0 };
      item.total += 1;
      if (row.createdAt >= todayStart) item.today += 1;
      if (row.createdAt >= sevenDaysAgo) item.last7Days += 1;
      fallbackByReason.set(reason, item);
    }
    if (row.moderation) moderationTotal += 1;
    if (row.createdAt >= todayStart) todayPending += 1;
    else if (row.createdAt >= yesterdayStart) yesterdayPending += 1;
    if (row.createdAt >= sevenDaysAgo) last7DaysPending += 1;
    else if (row.createdAt >= prev7Start) prev7DaysPending += 1;
    if (row.userId) allUsers.add(row.userId);

    const modelEntry = modelFailMap.get(model) ?? { total: 0, fallback: 0 };
    modelEntry.total += 1;
    if (fallback) modelEntry.fallback += 1;
    modelFailMap.set(model, modelEntry);

    const sourceEntry = sourceFailMap.get(source) ?? { total: 0, fallback: 0 };
    sourceEntry.total += 1;
    if (fallback) sourceEntry.fallback += 1;
    sourceFailMap.set(source, sourceEntry);

    if (row.userId) {
      const userEntry = userFailMap.get(row.userId) ?? { total: 0, reasons: new Map<string, number>() };
      userEntry.total += 1;
      userEntry.reasons.set(reason, (userEntry.reasons.get(reason) ?? 0) + 1);
      userFailMap.set(row.userId, userEntry);
    }
  }

  const reasons: FailureTriageReason[] = Array.from(byReason.entries()).map(([reason, bucket]) => ({
    reason,
    total: bucket.total,
    isFallbackBucket: isFallback(reason),
    moderationCount: bucket.moderationCount,
    today: bucket.today,
    last7Days: bucket.last7Days,
    stillBleeding: bucket.last7Days > 0,
    firstAtLabel: dateTimeLabel(bucket.firstAt),
    lastAtLabel: dateTimeLabel(bucket.lastAt),
    lastAtAgoLabel: agoLabel(bucket.lastAt),
    affectedUsers: bucket.users.size,
    models: topEntries(bucket.models, 4),
    sources: topEntries(bucket.sources, 4),
    kinds: topEntries(bucket.kinds, 3),
    samples: bucket.samples,
  })).sort((left, right) => {
    // ⭐ 排序刻意不是纯按条数：先把"还在流血"的排上去（那才是现在还在坑用户的），再按条数。
    if (left.stillBleeding !== right.stillBleeding) return left.stillBleeding ? -1 : 1;
    return right.total - left.total;
  });

  // ---- 全量成功/失败（判断是不是普遍性问题） ----
  let imageTotal = 0, imageFailed = 0, videoTotal = 0, videoFailed = 0;
  for (const row of kindStatusRows) {
    const count = num(row.count);
    if (row.kind === "image") { imageTotal += count; if (row.status === "failed") imageFailed += count; }
    else if (row.kind === "video") { videoTotal += count; if (row.status === "failed") videoFailed += count; }
  }

  // ---- 趋势 ----
  const trendMap = new Map<string, { image: number; video: number }>();
  for (const row of trendRows) {
    const key = dayKey(new Date(row.day));
    const entry = trendMap.get(key) ?? { image: 0, video: 0 };
    if (row.kind === "video") entry.video += num(row.count); else if (row.kind === "image") entry.image += num(row.count);
    trendMap.set(key, entry);
  }
  const trend = days30.map((day) => ({ label: dayLabel(day), image: trendMap.get(dayKey(day))?.image ?? 0, video: trendMap.get(dayKey(day))?.video ?? 0 }));

  // ---- 按模型（附总调用数，算失败率；只有失败数没有分母会误判） ----
  const callsByModel = new Map<string, number>();
  for (const row of modelCallRows) {
    const label = modelLabel(row.model);
    callsByModel.set(label, (callsByModel.get(label) ?? 0) + num(row.calls));
  }
  const byModel = Array.from(modelFailMap.entries()).map(([label, item]) => {
    const calls = callsByModel.get(label) ?? 0;
    return { label, total: item.total, fallback: item.fallback, calls, failRate: calls > 0 ? Number(((item.total / calls) * 100).toFixed(1)) : 0 };
  }).sort((left, right) => right.total - left.total);

  const bySource = Array.from(sourceFailMap.entries()).map(([label, item]) => ({ label, total: item.total, fallback: item.fallback })).sort((left, right) => right.total - left.total);

  const userNameById = new Map(userNameRows.map((user) => [user.id, user.nickname || user.email]));
  const topUsers = Array.from(userFailMap.entries()).sort((left, right) => right[1].total - left[1].total).slice(0, 10).map(([userId, item]) => ({
    label: userNameById.get(userId) ?? userId,
    userId,
    total: item.total,
    topReason: (topEntries(item.reasons, 1)[0]?.label ?? "").slice(0, 40),
  }));

  const resolved: FailureTriageResolvedReason[] = resolvedRows.map((row) => ({
    reason: (row.reason ?? "").trim(),
    note: row.note ?? "（无归档说明）",
    total: num(row.count),
    resolvedAtLabel: dateTimeLabel(row.resolvedat ? new Date(row.resolvedat) : null),
    lastAtLabel: dateTimeLabel(row.lastat ? new Date(row.lastat) : null),
  }));
  const resolvedTotal = resolved.reduce((sum, item) => sum + item.total, 0);

  const fallbackBuckets = GENERIC_FALLBACK_REASONS.map((label) => {
    const matched = Array.from(fallbackByReason.entries()).filter(([reason]) => reason.startsWith(label.slice(0, 8)));
    return {
      label,
      total: matched.reduce((sum, [, item]) => sum + item.total, 0),
      today: matched.reduce((sum, [, item]) => sum + item.today, 0),
      last7Days: matched.reduce((sum, [, item]) => sum + item.last7Days, 0),
    };
  });

  return {
    hasData,
    summary: {
      pending: pendingRows.length,
      resolved: resolvedTotal,
      pendingReasonCount: reasons.length,
      todayPending,
      yesterdayPending,
      last7DaysPending,
      prev7DaysPending,
      affectedUsers: allUsers.size,
      fallbackTotal,
      fallbackRate: pendingRows.length > 0 ? Number(((fallbackTotal / pendingRows.length) * 100).toFixed(1)) : 0,
      moderationTotal,
      imageTotal,
      imageFailed,
      videoTotal,
      videoFailed,
    },
    fallbackBuckets,
    reasons,
    resolved,
    trend,
    byModel,
    bySource,
    topUsers,
  };
}
