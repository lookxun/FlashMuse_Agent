import { prisma } from "@/lib/prisma";
import { bytePlusImageGenerationModels, bytePlusVideoGenerationModels, audioGenerationModels, imageGenerationModels, videoGenerationModels } from "@/lib/models";
import { FAILURE_REASON_SQL } from "@/lib/admin-failure-triage";
import { ONLINE_WINDOW_MS } from "@/lib/online-users";

/**
 * 运营概览（概览页）真实数据聚合。
 * 现有表用 Prisma 客户端；新分析表 GenerationEvent / UploadEvent 用原始 SQL（未重新生成 Prisma 客户端类型）。
 */

const TONES = ["#367cee", "#18a058", "#f0a020", "#8b5cf6", "#e0669a", "#999999"];

export type Split = { label: string; value: string };
export type TrendPoint = Record<string, number | string>;
export type RankItem = { label: string; value: string; note?: string };
export type ShareItem = { label: string; value: number; tone: string };

export type AdminOverviewData = {
  users: { total: number; today: number; dau: number; wau: number; mau: number; online: number; active30: number };
  images: { total: number; conversation: number; workflow: number; today: number; todayConversation: number; todayWorkflow: number };
  videos: { total: number; conversation: number; workflow: number; today: number; todayConversation: number; todayWorkflow: number };
  audios: { total: number; conversation: number; workflow: number; today: number; todayConversation: number; todayWorkflow: number };
  credits: { balance: number; consumedTotal: number; todayConsumed: number; usd: number; cny: number };
  conversations: { total: number; today: number };
  workflows: { total: number; today: number };
  success: { imageRate: number; videoRate: number; audioRate: number; imageFailed: number; videoFailed: number; audioFailed: number; hasData: boolean };
  activeTrend: TrendPoint[];
  imageTrend: TrendPoint[];
  videoTrend: TrendPoint[];
  audioTrend: TrendPoint[];
  costTrend: TrendPoint[];
  featureUsage: ShareItem[];
  modelShare: ShareItem[];
  retention: Array<{ label: string; value: number; note: string }>;
  funnel: Array<{ label: string; value: number }>;
  modelCalls: Array<{ label: string; calls: number; failed: number; note: string }>;
  failureTop: Array<{ label: string; value: number }>;
  /** 已归档（根因已修复/已堵漏）的失败原因，后台划掉展示、不计入待处理数量 */
  failureResolvedTop: Array<{ label: string; value: number; note?: string }>;
  moderationBreakdown: Array<{ label: string; value: number }>;
  perUser: Split[];
  newVsOld: ShareItem[];
  creditHealth: { granted: number; consumed: number; balance: number; signup: number; adminAdjust: number };
  workflowAdoption: { used: number; activeUsers: number; rate: number };
  chatModeShare: ShareItem[];
  referenceUsage: ShareItem[];
  uploadHealth: { rate: number; total: number; failed: number; timeout: number; reencode: number; hasData: boolean };
  retryStats: RankItem[];
  latency: RankItem[];
  costTop: RankItem[];
  billingAnomaly: RankItem[];
  activeUserTop: RankItem[];
  creditUserTop: RankItem[];
};

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
function recentDays(count: number) {
  const today = startOfLocalDay();
  return Array.from({ length: count }, (_, index) => addDays(today, index - count + 1));
}
function num(value: unknown) {
  const n = typeof value === "number" ? value : typeof value === "bigint" ? Number(value) : typeof value === "string" ? Number(value) : 0;
  return Number.isFinite(n) ? n : 0;
}
function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}
function getModelLabel(type: "image" | "video" | "audio", modelId: string) {
  const models = type === "audio" ? audioGenerationModels : type === "image" ? [...imageGenerationModels, ...bytePlusImageGenerationModels] : [...videoGenerationModels, ...bytePlusVideoGenerationModels];
  return models.find((model) => model.id === modelId)?.label ?? modelId;
}
function guessModelLabel(modelId: string) {
  if (!modelId) return "未知模型";
  if (/audio|speech|tts|fish-audio|minimax\/speech|qwen-audio/i.test(modelId)) return getModelLabel("audio", modelId);
  const isVideo = /video|seedance|kling|hailuo|wan|veo/i.test(modelId);
  return getModelLabel(isVideo ? "video" : "image", modelId);
}

/** 新分析表可能在迁移前尚不存在，查询失败时返回空数组以保证概览页可用。 */
async function safeRows<T>(runner: () => Promise<T[]>): Promise<T[]> {
  try {
    return await runner();
  } catch (error) {
    console.warn("[admin-overview] analytics query failed (table may be missing)", error instanceof Error ? error.message : String(error));
    return [];
  }
}

export async function getAdminOverviewData(): Promise<AdminOverviewData> {
  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const days30 = recentDays(30);
  const sevenDaysAgo = addDays(todayStart, -6);
  const thirtyDaysAgo = addDays(todayStart, -29);
  // ⭐ 「在线」判定口径与 src/lib/online-users.ts 完全一致（activeWorkspaceSeenAt + 未过期 + 未禁用），
  //   只是这里用 SQL 在库里算 COUNT(DISTINCT)，不再把 Session 行拉回 Node（2026-08-02 审计 1.3）。
  const onlineSince = new Date(now.getTime() - ONLINE_WINDOW_MS);
  const active30Since = new Date(now.getTime() - 30 * 60_000);


  const [
    totalUsers,
    todayUsers,
    userCredits,
    conversationTotal,
    conversationToday,
    workflowTotal,
    workflowToday,
    sessionStatRows,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.user.aggregate({ _sum: { credits: true } }),
    prisma.workspaceSession.count({ where: { deletedAt: null } }),
    prisma.workspaceSession.count({ where: { deletedAt: null, createdAt: { gte: todayStart } } }),
    prisma.workspaceWorkflow.count({ where: { deletedAt: null } }),
    prisma.workspaceWorkflow.count({ where: { deletedAt: null, createdAt: { gte: todayStart } } }),
    // 一条 SQL 出 dau/wau/mau/online/active30 + 今日活跃新老（旧实现是 5 次 Session 全表 findMany 拉回 JS 数）
    prisma.$queryRaw<Array<{ dau: bigint; wau: bigint; mau: bigint; online: bigint; active30: bigint; todaynew: bigint; todayold: bigint }>>`
      SELECT
        COUNT(DISTINCT s."userId") FILTER (WHERE s."lastSeenAt" >= ${todayStart})::bigint AS dau,
        COUNT(DISTINCT s."userId") FILTER (WHERE s."lastSeenAt" >= ${sevenDaysAgo})::bigint AS wau,
        COUNT(DISTINCT s."userId") FILTER (WHERE s."lastSeenAt" >= ${thirtyDaysAgo})::bigint AS mau,
        COUNT(DISTINCT s."userId") FILTER (WHERE s."activeWorkspaceSeenAt" >= ${onlineSince} AND s."expiresAt" > ${now} AND NOT u."disabled")::bigint AS online,
        COUNT(DISTINCT s."userId") FILTER (WHERE s."lastSeenAt" >= ${active30Since} AND s."expiresAt" > ${now} AND NOT u."disabled")::bigint AS active30,
        COUNT(DISTINCT s."userId") FILTER (WHERE s."lastSeenAt" >= ${todayStart} AND u."createdAt" >= ${todayStart})::bigint AS todaynew,
        COUNT(DISTINCT s."userId") FILTER (WHERE s."lastSeenAt" >= ${todayStart} AND u."createdAt" < ${todayStart})::bigint AS todayold
      FROM "Session" s JOIN "User" u ON u.id = s."userId"`,
  ]);
  const sessionStats = sessionStatRows[0];

  // ---- 生成媒体计数（MediaAsset） ----
  const mediaCountsRows = await prisma.$queryRaw<Array<{ mediatype: string; bucket: string; today: boolean; count: bigint }>>`
    SELECT "mediaType" AS mediatype,
      CASE WHEN "workspaceKind" = 'workflow' THEN 'workflow' ELSE 'conversation' END AS bucket,
      ("firstSeenAt" >= ${todayStart}) AS today,
      COUNT(*)::bigint AS count
    FROM "MediaAsset"
    WHERE "archivedAt" IS NULL
      AND "mediaType" IN ('image','video','audio')
      AND COALESCE("sourceKind",'') NOT LIKE '%upload%'
    GROUP BY 1,2,3`;

  const images = { total: 0, conversation: 0, workflow: 0, today: 0, todayConversation: 0, todayWorkflow: 0 };
  const videos = { total: 0, conversation: 0, workflow: 0, today: 0, todayConversation: 0, todayWorkflow: 0 };
  const audios = { total: 0, conversation: 0, workflow: 0, today: 0, todayConversation: 0, todayWorkflow: 0 };
  for (const row of mediaCountsRows) {
    const target = row.mediatype === "audio" ? audios : row.mediatype === "video" ? videos : images;
    const count = num(row.count);
    target.total += count;
    if (row.bucket === "workflow") target.workflow += count; else target.conversation += count;
    if (row.today) {
      target.today += count;
      if (row.bucket === "workflow") target.todayWorkflow += count; else target.todayConversation += count;
    }
  }

  // ---- 生成趋势（MediaAsset 按天） ----
  const mediaTrendRows = await prisma.$queryRaw<Array<{ day: Date; mediatype: string; bucket: string; count: bigint }>>`
    SELECT date_trunc('day', "firstSeenAt") AS day,
      "mediaType" AS mediatype,
      CASE WHEN "workspaceKind" = 'workflow' THEN 'workflow' ELSE 'conversation' END AS bucket,
      COUNT(*)::bigint AS count
    FROM "MediaAsset"
    WHERE "archivedAt" IS NULL
      AND "mediaType" IN ('image','video','audio')
      AND COALESCE("sourceKind",'') NOT LIKE '%upload%'
      AND "firstSeenAt" >= ${thirtyDaysAgo}
    GROUP BY 1,2,3`;
  const imageTrendMap = new Map<string, { conversation: number; workflow: number }>();
  const videoTrendMap = new Map<string, { conversation: number; workflow: number }>();
  const audioTrendMap = new Map<string, { conversation: number; workflow: number }>();
  for (const row of mediaTrendRows) {
    const key = dayKey(new Date(row.day));
    const map = row.mediatype === "audio" ? audioTrendMap : row.mediatype === "video" ? videoTrendMap : imageTrendMap;
    const entry = map.get(key) ?? { conversation: 0, workflow: 0 };
    if (row.bucket === "workflow") entry.workflow += num(row.count); else entry.conversation += num(row.count);
    map.set(key, entry);
  }
  const imageTrend: TrendPoint[] = days30.map((day) => ({ label: dayLabel(day), conversation: imageTrendMap.get(dayKey(day))?.conversation ?? 0, workflow: imageTrendMap.get(dayKey(day))?.workflow ?? 0 }));
  const videoTrend: TrendPoint[] = days30.map((day) => ({ label: dayLabel(day), conversation: videoTrendMap.get(dayKey(day))?.conversation ?? 0, workflow: videoTrendMap.get(dayKey(day))?.workflow ?? 0 }));
  const audioTrend: TrendPoint[] = days30.map((day) => ({ label: dayLabel(day), conversation: audioTrendMap.get(dayKey(day))?.conversation ?? 0, workflow: audioTrendMap.get(dayKey(day))?.workflow ?? 0 }));

  // ---- 积分账本聚合（2026-08-02 审计 1.3：全部改在 SQL 里 GROUP BY，不再把整张 CreditLedger 拉进内存） ----
  const [creditTotalRows, creditModelRows, creditUserRows, creditFeatureRows, creditChatModeRows, creditAnomalyRows] = await Promise.all([
    prisma.$queryRaw<Array<{ consumedcredits: bigint; consumedusd: number | null; consumedcny: number | null; todayconsumed: bigint; granted: bigint; signup: bigint; adminadjust: bigint }>>`
      SELECT
        COALESCE(SUM("credits") FILTER (WHERE "direction" = 'consume'), 0)::bigint AS consumedcredits,
        COALESCE(SUM("usd") FILTER (WHERE "direction" = 'consume'), 0) AS consumedusd,
        COALESCE(SUM("cny") FILTER (WHERE "direction" = 'consume'), 0) AS consumedcny,
        COALESCE(SUM("credits") FILTER (WHERE "direction" = 'consume' AND "createdAt" >= ${todayStart}), 0)::bigint AS todayconsumed,
        COALESCE(SUM("credits") FILTER (WHERE "direction" = 'increase'), 0)::bigint AS granted,
        COALESCE(SUM("credits") FILTER (WHERE "direction" = 'increase' AND "kind" = 'signup'), 0)::bigint AS signup,
        COALESCE(SUM("credits") FILTER (WHERE "direction" = 'increase' AND "kind" = 'admin_adjust'), 0)::bigint AS adminadjust
      FROM "CreditLedger"`,
    prisma.$queryRaw<Array<{ kind: string; model: string; calls: bigint; cost: number | null }>>`
      SELECT "kind", "model", COUNT(*)::bigint AS calls, COALESCE(SUM("usd") FILTER (WHERE "usd" > 0), 0) AS cost
      FROM "CreditLedger" WHERE "direction" = 'consume' AND "model" IS NOT NULL AND "model" <> ''
      GROUP BY 1, 2`,
    prisma.$queryRaw<Array<{ userid: string; credits: bigint }>>`
      SELECT "userId" AS userid, SUM("credits")::bigint AS credits
      FROM "CreditLedger" WHERE "direction" = 'consume' GROUP BY 1`,
    // 功能使用（按次）：分类口径与旧 JS 循环逐条一致（creditSource 来自 metadata->>'creditSource'）
    prisma.$queryRaw<Array<{ feature: string; count: bigint }>>`
      SELECT CASE
          WHEN COALESCE("metadata"->>'creditSource', '') LIKE 'workflow\_%' ESCAPE '\' THEN '工作流'
          WHEN COALESCE("metadata"->>'creditSource', '') IN ('image_prompt_reverse', 'prompt_optimization') THEN '反推 / 优化'
          WHEN "kind" = 'image' THEN '图片生成'
          WHEN "kind" = 'video' THEN '视频生成'
          ELSE '对话 / 规划'
        END AS feature, COUNT(*)::bigint AS count
      FROM "CreditLedger" WHERE "direction" = 'consume' GROUP BY 1`,
    // 对话生成模式（仅对话流，非工作流、非资产、非工具）：WHERE 口径与旧 JS 的 if 条件逐条一致
    prisma.$queryRaw<Array<{ mode: string; count: bigint }>>`
      SELECT CASE
          WHEN "kind" = 'image' THEN '图片生成'
          WHEN "kind" = 'video' THEN '视频生成'
          WHEN "label" = 'Agent 规划' OR "requestId" LIKE '%:plan' THEN 'Agent 规划'
          ELSE '普通对话'
        END AS mode, COUNT(*)::bigint AS count
      FROM "CreditLedger"
      WHERE "direction" = 'consume'
        AND COALESCE("metadata"->>'creditSource', '') NOT LIKE 'workflow\_%' ESCAPE '\'
        AND COALESCE("metadata"->>'creditSource', '') NOT IN ('image_prompt_reverse', 'prompt_optimization', 'character_image_generation', 'scene_image_generation', 'prop_image_generation', 'shot_image_generation')
      GROUP BY 1`,
    // 计费异常：① chargeDisabled ② （未 disabled 的）image/video 零扣费 —— 与旧 JS 的 if/else-if 口径一致
    prisma.$queryRaw<Array<{ disabled: bigint; zerocost: bigint }>>`
      SELECT
        COUNT(*) FILTER (WHERE "metadata"->>'creditChargeDisabled' = 'true')::bigint AS disabled,
        COUNT(*) FILTER (WHERE "kind" IN ('image', 'video') AND "credits" = 0 AND "usd" = 0 AND "cny" = 0 AND COALESCE("metadata"->>'creditChargeDisabled', '') <> 'true')::bigint AS zerocost
      FROM "CreditLedger" WHERE "direction" = 'consume'`,
  ]);

  const creditTotals = creditTotalRows[0];
  const consumedCredits = num(creditTotals?.consumedcredits);
  const consumedUsd = num(creditTotals?.consumedusd);
  const consumedCny = num(creditTotals?.consumedcny);
  const todayConsumed = num(creditTotals?.todayconsumed);
  const grantedCredits = num(creditTotals?.granted);
  const signupCredits = num(creditTotals?.signup);
  const adminAdjustCredits = num(creditTotals?.adminadjust);

  const modelCallMap = new Map<string, number>();
  const modelCostMap = new Map<string, number>();
  const costModelTypeMap = new Map<string, "image" | "video">();
  for (const row of creditModelRows) {
    const label = row.kind === "audio" ? getModelLabel("audio", row.model) : row.kind === "video" ? getModelLabel("video", row.model) : row.kind === "image" ? getModelLabel("image", row.model) : row.model;
    modelCallMap.set(label, (modelCallMap.get(label) ?? 0) + num(row.calls));
    const cost = num(row.cost);
    if (cost > 0) modelCostMap.set(label, (modelCostMap.get(label) ?? 0) + cost);
    if (row.kind === "video" || row.kind === "image") costModelTypeMap.set(label, row.kind);
  }
  const featureMap = new Map<string, number>(creditFeatureRows.map((row) => [row.feature, num(row.count)]));
  const chatModeMap = new Map<string, number>(creditChatModeRows.map((row) => [row.mode, num(row.count)]));
  const userConsumeMap = new Map<string, number>(creditUserRows.map((row) => [row.userid, num(row.credits)]));
  const anomalyChargeDisabled = num(creditAnomalyRows[0]?.disabled);
  const anomalyZeroCost = num(creditAnomalyRows[0]?.zerocost);

  // ---- 生成事件聚合（新表） ----
  const genByKindStatus = await safeRows(() => prisma.$queryRaw<Array<{ kind: string; status: string; count: bigint }>>`
    SELECT "kind", "status", COUNT(*)::bigint AS count FROM "GenerationEvent" GROUP BY 1,2`);
  let imageSuccess = 0, imageFailed = 0, videoSuccess = 0, videoFailed = 0, audioSuccess = 0, audioFailed = 0;
  for (const row of genByKindStatus) {
    const c = num(row.count);
    if (row.kind === "image") { if (row.status === "success") imageSuccess += c; else imageFailed += c; }
    else if (row.kind === "video") { if (row.status === "success") videoSuccess += c; else videoFailed += c; }
    else if (row.kind === "audio") { if (row.status === "success") audioSuccess += c; else audioFailed += c; }
  }
  const genHasData = imageSuccess + imageFailed + videoSuccess + videoFailed + audioSuccess + audioFailed > 0;

  const genModelRows = await safeRows(() => prisma.$queryRaw<Array<{ model: string | null; calls: bigint; failed: bigint }>>`
    SELECT "model", COUNT(*)::bigint AS calls, COUNT(*) FILTER (WHERE "status" = 'failed')::bigint AS failed
    FROM "GenerationEvent" GROUP BY 1 ORDER BY calls DESC`);
  const modelCalls = genModelRows.filter((row) => row.model).map((row) => ({ label: guessModelLabel(row.model as string), calls: num(row.calls), failed: num(row.failed),     note: /audio|speech|tts|fish-audio|minimax\/speech|qwen-audio/i.test(row.model as string) ? "语音" : /video|seedance|kling|hailuo|wan|veo/i.test(row.model as string) ? "视频" : "图片" }));

  // 「失败原因」只统计**未归档**的（resolvedAt IS NULL）。根因查清并修掉后由归档脚本打上
  // resolvedAt，那部分改到下面 failureResolvedTop 里划掉展示（文字保留，便于追溯）。
  // ⭐ 原因归一化表达式来自唯一权威 FAILURE_REASON_SQL（与「失败排查」页共用，禁止再抄一份）。
  // 更全的排查视图见后台「失败排查」页（src/lib/admin-failure-triage.ts）。
  const genFailureRows = await safeRows(() => prisma.$queryRawUnsafe<Array<{ reason: string | null; count: bigint }>>(
    `SELECT ${FAILURE_REASON_SQL} AS reason, COUNT(*)::bigint AS count FROM "GenerationEvent" WHERE "status" = 'failed' AND "failureReason" IS NOT NULL AND "resolvedAt" IS NULL GROUP BY 1 ORDER BY count DESC`));
  const failureTop = genFailureRows.map((row) => ({ label: (row.reason as string).slice(0, 80), value: num(row.count) }));

  // 已归档（根因已修）的失败原因：按「原因 + 归档说明」分组，后台划掉展示。
  const genResolvedFailureRows = await safeRows(() => prisma.$queryRawUnsafe<Array<{ reason: string | null; note: string | null; count: bigint }>>(
    `SELECT ${FAILURE_REASON_SQL} AS reason, "resolvedNote" AS note, COUNT(*)::bigint AS count FROM "GenerationEvent" WHERE "status" = 'failed' AND "failureReason" IS NOT NULL AND "resolvedAt" IS NOT NULL GROUP BY 1,2 ORDER BY count DESC`));
  const failureResolvedTop = genResolvedFailureRows.map((row) => ({ label: (row.reason as string).slice(0, 80), value: num(row.count), note: row.note ?? undefined }));

  const genModerationRows = await safeRows(() => prisma.$queryRawUnsafe<Array<{ reason: string | null; count: bigint }>>(
    `SELECT ${FAILURE_REASON_SQL} AS reason, COUNT(*)::bigint AS count FROM "GenerationEvent" WHERE "status" = 'failed' AND "moderation" = true AND "failureReason" IS NOT NULL AND "resolvedAt" IS NULL GROUP BY 1 ORDER BY count DESC LIMIT 8`));
  const moderationBreakdown = genModerationRows.map((row) => ({ label: (row.reason as string).slice(0, 80), value: num(row.count) }));

  const genLatencyRows = await safeRows(() => prisma.$queryRaw<Array<{ model: string | null; avg: number | null }>>`
    SELECT "model", AVG("durationMs") AS avg FROM "GenerationEvent" WHERE "status" = 'success' AND "durationMs" IS NOT NULL AND "model" IS NOT NULL GROUP BY 1 ORDER BY avg DESC LIMIT 8`);
  const latency: RankItem[] = genLatencyRows.map((row) => {
    const ms = num(row.avg);
    const isAudio = /audio|speech|tts|fish-audio|minimax\/speech|qwen-audio/i.test(row.model as string);
    const isVideo = /video|seedance|kling|hailuo|wan|veo/i.test(row.model as string);
    return { label: guessModelLabel(row.model as string), value: ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`, note: isAudio ? "语音" : isVideo ? "视频" : "图片" };
  });

  const genRefRows = await safeRows(() => prisma.$queryRaw<Array<{ total: bigint; withimage: bigint; withvideo: bigint }>>`
    SELECT COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE "referenceImageCount" > 0)::bigint AS withimage,
      COUNT(*) FILTER (WHERE "referenceVideoCount" > 0)::bigint AS withvideo
    FROM "GenerationEvent"`);
  const refTotal = num(genRefRows[0]?.total);
  const refWithImage = num(genRefRows[0]?.withimage);
  const refWithVideo = num(genRefRows[0]?.withvideo);
  const refPlain = Math.max(0, refTotal - refWithImage - refWithVideo);

  // ---- 上传事件（新表） ----
  const uploadRows = await safeRows(() => prisma.$queryRaw<Array<{ status: string; reason: string | null; count: bigint }>>`
    SELECT "status", "reason", COUNT(*)::bigint AS count FROM "UploadEvent" GROUP BY 1,2`);
  let uploadTotal = 0, uploadFailed = 0, uploadTimeout = 0, uploadReencode = 0;
  for (const row of uploadRows) {
    const c = num(row.count);
    uploadTotal += c;
    if (row.status === "failed") {
      uploadFailed += c;
      if (row.reason === "timeout") uploadTimeout += c;
      if (row.reason === "reencode") uploadReencode += c;
    }
  }

  // ---- GPT 安全改写案例（重试统计） ----
  const gptCaseRows = await prisma.$queryRaw<Array<{ count: bigint; avgattempts: number | null }>>`
    SELECT COUNT(*)::bigint AS count, AVG("attemptsUsed") AS avgattempts FROM "GptImagePromptOptimizationCase"`;
  const gptCaseCount = num(gptCaseRows[0]?.count);
  const gptAvgAttempts = num(gptCaseRows[0]?.avgattempts);

  // ---- 留存 ----
  const retentionRows = await prisma.$queryRaw<Array<{ days: number; cohort: bigint; retained: bigint }>>`
    WITH d(days) AS (VALUES (1),(3),(7),(30)),
    last_seen AS (SELECT "userId", MAX("lastSeenAt") AS seen FROM "Session" GROUP BY "userId")
    SELECT d.days,
      COUNT(u.id)::bigint AS cohort,
      COUNT(u.id) FILTER (WHERE ls.seen >= (date_trunc('day', u."createdAt") + (d.days || ' days')::interval))::bigint AS retained
    FROM d
    JOIN "User" u ON u."createdAt" >= (${todayStart}::timestamp - (d.days || ' days')::interval)
      AND u."createdAt" < (${todayStart}::timestamp - (d.days || ' days')::interval + '1 day'::interval)
    LEFT JOIN last_seen ls ON ls."userId" = u.id
    GROUP BY d.days ORDER BY d.days`;
  const retentionLabelMap: Record<number, string> = { 1: "次日留存", 3: "3日留存", 7: "7日留存", 30: "30日留存" };
  const retentionByDay = new Map(retentionRows.map((row) => [num(row.days), row]));
  const retention = [1, 3, 7, 30].map((d) => {
    const row = retentionByDay.get(d);
    const cohort = num(row?.cohort);
    const retained = num(row?.retained);
    return { label: retentionLabelMap[d], value: pct(retained, cohort), note: `${retained}/${cohort}` };
  });

  // ---- 漏斗（2026-08-02：COUNT(DISTINCT) 在库里算，不再拉 Session/WorkspaceWorkflow 的 userId 列表回 Node） ----
  const [funnelWorkbenchRows, funnelGeneratedAggRows, funnelWorkflowRows] = await Promise.all([
    prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(DISTINCT "userId")::bigint AS count FROM "Session"`,
    prisma.$queryRaw<Array<{ generated: bigint; multi: bigint }>>`
      SELECT COUNT(*)::bigint AS generated, COUNT(*) FILTER (WHERE cnt >= 3)::bigint AS multi
      FROM (
        SELECT "userId", COUNT(*) AS cnt FROM "MediaAsset"
        WHERE "archivedAt" IS NULL AND "mediaType" IN ('image','video') AND COALESCE("sourceKind",'') NOT LIKE '%upload%'
        GROUP BY 1
      ) t`,
    prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(DISTINCT "userId")::bigint AS count FROM "WorkspaceWorkflow" WHERE "deletedAt" IS NULL`,
  ]);
  const enteredWorkbench = num(funnelWorkbenchRows[0]?.count);
  const generatedUsers = num(funnelGeneratedAggRows[0]?.generated);
  const multiGeneratedUsers = num(funnelGeneratedAggRows[0]?.multi);
  const workflowUsers = num(funnelWorkflowRows[0]?.count);
  const funnel = [
    { label: "注册用户", value: totalUsers },
    { label: "进入工作台", value: enteredWorkbench },
    { label: "首次生成", value: generatedUsers },
    { label: "多次生成(≥3)", value: multiGeneratedUsers },
    { label: "使用工作流", value: workflowUsers },
  ];

  // ---- Top 用户 ----
  const userIds = new Set<string>([...userConsumeMap.keys()]);
  const topActiveSessions = await prisma.session.findMany({ orderBy: { lastSeenAt: "desc" }, take: 40, select: { userId: true, lastSeenAt: true } });
  const activeSeen = new Map<string, Date>();
  for (const s of topActiveSessions) { if (!activeSeen.has(s.userId)) activeSeen.set(s.userId, s.lastSeenAt); }
  const topActiveIds = Array.from(activeSeen.keys()).slice(0, 10);
  const topConsumeIds = Array.from(userConsumeMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id]) => id);
  topActiveIds.forEach((id) => userIds.add(id));
  topConsumeIds.forEach((id) => userIds.add(id));
  const userInfoRows = await prisma.user.findMany({ where: { id: { in: Array.from(userIds) } }, select: { id: true, email: true, nickname: true } });
  const userInfo = new Map(userInfoRows.map((u) => [u.id, u.nickname || u.email]));
  const fmtTime = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const activeUserTop: RankItem[] = topActiveIds.map((id) => ({ label: userInfo.get(id) || id, value: fmtTime(activeSeen.get(id) as Date), note: id }));
  const creditUserTop: RankItem[] = topConsumeIds.map((id) => ({ label: userInfo.get(id) || id, value: (userConsumeMap.get(id) ?? 0).toLocaleString("en-US"), note: id }));

  // ---- 活跃/新增趋势 ----
  const [sessionDailyRows, userDailyRows] = await Promise.all([
    prisma.$queryRaw<Array<{ day: Date; users: bigint }>>`
      SELECT date_trunc('day', "lastSeenAt") AS day, COUNT(DISTINCT "userId")::bigint AS users
      FROM "Session" WHERE "lastSeenAt" >= ${thirtyDaysAgo} GROUP BY 1`,
    prisma.$queryRaw<Array<{ day: Date; users: bigint }>>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS users
      FROM "User" WHERE "createdAt" >= ${thirtyDaysAgo} GROUP BY 1`,
  ]);
  const activeByDay = new Map(sessionDailyRows.map((row) => [dayKey(new Date(row.day)), num(row.users)]));
  const newByDay = new Map(userDailyRows.map((row) => [dayKey(new Date(row.day)), num(row.users)]));
  const activeTrend: TrendPoint[] = days30.map((day) => ({ label: dayLabel(day), value: activeByDay.get(dayKey(day)) ?? 0, secondaryValue: newByDay.get(dayKey(day)) ?? 0 }));

  // ---- 成本消耗趋势 ----
  const costDailyRows = await prisma.$queryRaw<Array<{ day: Date; credits: bigint; usd: number }>>`
    SELECT date_trunc('day', "createdAt") AS day, SUM("credits")::bigint AS credits, SUM("usd") AS usd
    FROM "CreditLedger" WHERE "direction" = 'consume' AND "createdAt" >= ${thirtyDaysAgo} GROUP BY 1`;
  const creditsByDay = new Map(costDailyRows.map((row) => [dayKey(new Date(row.day)), num(row.credits)]));
  const usdByDay = new Map(costDailyRows.map((row) => [dayKey(new Date(row.day)), Number(num(row.usd).toFixed(2))]));
  const costTrend: TrendPoint[] = days30.map((day) => ({ label: dayLabel(day), credits: creditsByDay.get(dayKey(day)) ?? 0, usd: usdByDay.get(dayKey(day)) ?? 0 }));

  // ---- 占比/分布 ----
  const toShareItems = (map: Map<string, number>, limit = 6): ShareItem[] => {
    const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((sum, [, v]) => sum + v, 0) || 1;
    const top = entries.slice(0, limit);
    const items = top.map(([label, value], index) => ({ label, value: pct(value, total), tone: TONES[index % TONES.length] }));
    return items;
  };
  const featureUsage = toShareItems(featureMap, 5);
  const modelShare = toShareItems(modelCallMap, 5);
  const chatModeShare = toShareItems(chatModeMap, 4);
  const referenceUsage: ShareItem[] = refTotal > 0 ? [
    { label: "带参考图生成", value: pct(refWithImage, refTotal), tone: TONES[0] },
    { label: "带参考视频生成", value: pct(refWithVideo, refTotal), tone: TONES[2] },
    { label: "纯文本生成", value: pct(refPlain, refTotal), tone: TONES[5] },
  ] : [];

  const dau = num(sessionStats?.dau);
  const wau = num(sessionStats?.wau);
  const mau = num(sessionStats?.mau);
  const online = num(sessionStats?.online);
  const active30 = num(sessionStats?.active30);

  // 今日活跃新老用户（同一条 sessionStats SQL 已算出，不再单独拉一次 Session）
  const todayNew = num(sessionStats?.todaynew);
  const todayOld = num(sessionStats?.todayold);
  const todayActiveTotal = todayNew + todayOld;
  const newVsOld: ShareItem[] = todayActiveTotal > 0 ? [
    { label: "新用户", value: pct(todayNew, todayActiveTotal), tone: TONES[1] },
    { label: "老用户", value: pct(todayOld, todayActiveTotal), tone: TONES[0] },
  ] : [];

  const activeUsersForRate = Math.max(mau, 1);
  const perUser: Split[] = [
    { label: "人均生成图片", value: (images.total / activeUsersForRate).toFixed(1) },
    { label: "人均生成视频", value: (videos.total / activeUsersForRate).toFixed(1) },
    { label: "人均消耗积分", value: Math.round(consumedCredits / activeUsersForRate).toLocaleString("en-US") },
    { label: "人均对话数", value: (conversationTotal / Math.max(totalUsers, 1)).toFixed(1) },
  ];

  const balance = num(userCredits._sum.credits);
  const costTop: RankItem[] = Array.from(modelCostMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, usd]) => ({ label, value: `$${usd.toFixed(2)}`, note: costModelTypeMap.get(label) === "video" ? "视频" : "图片" }));

  const billingAnomaly: RankItem[] = [
    { label: "零扣费成功记录", value: `${anomalyZeroCost.toLocaleString("en-US")} 条`, note: "成功但未记成本" },
    { label: "扣费已禁用记录", value: `${anomalyChargeDisabled.toLocaleString("en-US")} 条`, note: "chargeDisabled" },
  ];

  const retryStats: RankItem[] = [
    { label: "GPT 安全改写成功案例", value: `${gptCaseCount.toLocaleString("en-US")} 次`, note: gptCaseCount > 0 ? `平均 ${gptAvgAttempts.toFixed(1)} 次尝试后成功` : "暂无案例" },
  ];

  return {
    users: { total: totalUsers, today: todayUsers, dau, wau, mau, online, active30 },
    images,
    videos,
    audios,
    credits: { balance, consumedTotal: consumedCredits, todayConsumed, usd: Number(consumedUsd.toFixed(2)), cny: Number(consumedCny.toFixed(2)) },
    conversations: { total: conversationTotal, today: conversationToday },
    workflows: { total: workflowTotal, today: workflowToday },
    success: { imageRate: imageSuccess + imageFailed > 0 ? Number(((imageSuccess / (imageSuccess + imageFailed)) * 100).toFixed(1)) : 0, videoRate: videoSuccess + videoFailed > 0 ? Number(((videoSuccess / (videoSuccess + videoFailed)) * 100).toFixed(1)) : 0, audioRate: audioSuccess + audioFailed > 0 ? Number(((audioSuccess / (audioSuccess + audioFailed)) * 100).toFixed(1)) : 0, imageFailed, videoFailed, audioFailed, hasData: genHasData },
    activeTrend,
    imageTrend,
    videoTrend,
    audioTrend,
    costTrend,
    featureUsage,
    modelShare,
    retention,
    funnel,
    modelCalls,
    failureTop,
    failureResolvedTop,
    moderationBreakdown,
    perUser,
    newVsOld,
    creditHealth: { granted: grantedCredits, consumed: consumedCredits, balance, signup: signupCredits, adminAdjust: adminAdjustCredits },
    workflowAdoption: { used: workflowUsers, activeUsers: activeUsersForRate, rate: pct(workflowUsers, activeUsersForRate) },
    chatModeShare,
    referenceUsage,
    uploadHealth: { rate: uploadTotal > 0 ? Number((((uploadTotal - uploadFailed) / uploadTotal) * 100).toFixed(1)) : 0, total: uploadTotal, failed: uploadFailed, timeout: uploadTimeout, reencode: uploadReencode, hasData: uploadTotal > 0 },
    retryStats,
    latency,
    costTop,
    billingAnomaly,
    activeUserTop,
    creditUserTop,
  };
}