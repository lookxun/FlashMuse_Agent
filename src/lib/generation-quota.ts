import { prisma } from "@/lib/prisma";
import { getCreditSettings } from "@/lib/credits";
import { appendGenerationDiagnosticsLog } from "@/lib/generation-diagnostics-log";
import { getEstimatedGenerationUsd, resolveImageSettingsForModel, resolveVideoSettingsForModel } from "@/lib/models";
import { settleMembershipCredits } from "@/lib/membership-credits";
import {
  MEMBERSHIP_CONCURRENCY_DENIED_MESSAGE,
  MEMBERSHIP_SYSTEM_ENABLED,
  getMembershipConcurrencyLimit,
  type MembershipSettings,
  type MembershipTier,
} from "@/lib/membership";

/* ============================================================================
 * 生成额度闸门（唯一权威）—— 2026-08-30 审计后新增
 *
 * 它同时解决两个真实漏洞：
 *
 * ⛔ A：并发上限原来是「先 count 再放行」（TOCTOU）。20 个请求同时进来都 count 到 0
 *      → 全部放行 → 基础会员「同时生成 1 条」形同虚设。
 * ⛔ B：积分原来只判 `> 0`。剩 1 积分也能开一个几百积分的视频；
 *      配合 A，剩 1 积分的号能同时开一堆贵任务，把余额刷成负几千（真金白银的损失）。
 *
 * 解法：**同一个事务里 `pg_advisory_xact_lock(用户)` → 数占位 → 插占位**。
 * 咨询锁按用户维度串行化，所以并发请求只能一个一个过，看到的数字永远是最新的；
 * 锁在事务结束时自动释放，跨实例（多个 Node 进程）同样有效。
 *
 * ⭐ 判据（下次改动前必须还成立）：
 *   ① 同一用户并发 N 个请求，只有前 limit 个拿到占位，其余收到并发上限提示；
 *   ② `credits < 在跑的预估 + 本次预估` 时必须拒，而不是等扣完变负数。
 *
 * ⚠️ 预估只用来"判够不够"，**真实扣费永远按上游 usage 走**（credits.ts）。
 *    预估一律取上限价（宁高不低）：估低了等于没拦。
 * ⚠️ 占位一定要释放：任务落地（成功/失败）时 `releaseGenerationReservation`，
 *    同步接口在 finally 里释放；再加 `expiresAt` 兜底，绝不允许把用户永久卡死。
 * ========================================================================== */

export const CREDITS_NOT_ENOUGH_MESSAGE = "积分不足，请充值后再使用模型。";

/** 占位存活时长：要盖住最慢的一次生成（视频轮询可能几分钟），又不能长到卡死用户。 */
const RESERVATION_TTL_MS = 30 * 60 * 1000;

export function isGenerationQuotaError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return message === CREDITS_NOT_ENOUGH_MESSAGE || message === MEMBERSHIP_CONCURRENCY_DENIED_MESSAGE;
}

/** 从「5秒」「10 秒」这类文案里取秒数。 */
function parseSeconds(value?: string) {
  const seconds = Number(String(value ?? "").match(/\d+/)?.[0]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

export type GenerationQuotaTarget = {
  kind: "image" | "video" | "audio";
  model?: string;
  /** 图片张数 */
  count?: number;
  /** 视频时长（"5秒" 这种原样传进来即可） */
  duration?: string;
  /** 语音字数 */
  chars?: number;
  /**
   * ⭐⭐ 用户请求的比例 / 分辨率（原样传进来就行，本文件会自己归一化）。
   * ⛔ 别在调用方先算好：模型规则表会把不支持的档位**抬到该模型的默认档**，
   *    而每秒/每张单价随分辨率差好几倍（实测 Seedance 2.0 的 1080p 是 720p 的 2.5 倍）。
   *    这和「会员画质校验必须看归一化后的真实档位」是同一个坑。
   */
  ratio?: string;
  resolution?: string;
};

/** 事前预估这次生成要花多少积分（≥0 的整数；0 = 该模型没有价目表，不做限制）。 */
export async function estimateGenerationCredits(target: GenerationQuotaTarget) {
  const settings = await getCreditSettings();
  const usd = getEstimatedGenerationUsd({
    kind: target.kind,
    modelId: target.model,
    count: target.count,
    seconds: parseSeconds(target.duration),
    chars: target.chars,
    resolution: resolveEffectiveResolution(target),
  });
  if (usd <= 0) return 0;
  return Math.max(1, Math.round(usd * settings.usdToCnyRate * settings.creditsPerCny));
}

/** 归一化成「这次实际会用的那一档分辨率」。语音没有分辨率概念。 */
function resolveEffectiveResolution(target: GenerationQuotaTarget) {
  if (!target.model) return undefined;
  const settings = { ratio: target.ratio, resolution: target.resolution };
  if (target.kind === "image") return resolveImageSettingsForModel(target.model, settings).resolution;
  if (target.kind === "video") return resolveVideoSettingsForModel(target.model, settings).resolution;
  return undefined;
}

/**
 * 占一个生成额度。通过返回 true（已插入占位），不通过直接抛错（错误文案给用户看）。
 *
 * ⭐ 必须在**真正花钱之前**调用（视频尤其重要：`/api/video` 是先打上游建任务、
 *    再 `createVideoJob`，所以不能等建 job 的时候才判）。
 */
export async function reserveGenerationQuota(input: {
  userId?: string;
  requestId?: string;
  tier: MembershipTier;
  membershipSettings?: MembershipSettings;
  target: GenerationQuotaTarget;
}) {
  const { userId, requestId } = input;
  if (!userId || !requestId) return false;

  const limit = getMembershipConcurrencyLimit(input.tier, input.membershipSettings);
  const estCredits = await estimateGenerationCredits(input.target);
  const expiresAt = new Date(Date.now() + RESERVATION_TTL_MS);

  // ⭐ 懒结算会员每月积分（该发的发、过期的作废）。放在判余额**之前**，
  // 否则刚到发放日的会员会被误判成"积分不足"。⛔ 故意不挂在常驻 worker 的 tick 上
  // （本项目铁律：往 tick 里加活儿会连带把全站生成停摆）。
  if (MEMBERSHIP_SYSTEM_ENABLED) await settleMembershipCredits(userId).catch(() => undefined);

  try {
    await runReservationTransaction({ userId, requestId, limit, estCredits, expiresAt, kind: input.target.kind });
  } catch (error) {
    // ⭐⭐ 只有「并发上限 / 积分不足」这两个**业务判定**才允许把请求拒掉。
    // 其余任何异常（迁移没跑、表不存在、连接抖动、咨询锁报错…）一律**放行** ——
    // 这个闸门横在**全站图片/视频/语音生成**的最前面，一旦它自己出问题就会把整站生成打死。
    // 判据（别改回去）：宁可少拦一次（后面还有 assertUserCanUseCredits 和真实扣费兜着），
    // 也绝不允许因为闸门自己的故障让所有人都不能生成。
    if (isGenerationQuotaError(error)) throw error;
    void appendGenerationDiagnosticsLog({
      event: "generation-quota-gate-failed",
      requestId,
      userId,
      mode: input.target.kind,
      model: input.target.model,
      error,
    });
    return false;
  }

  return true;
}

async function runReservationTransaction(input: {
  userId: string;
  requestId: string;
  limit: number;
  estCredits: number;
  expiresAt: Date;
  kind: GenerationQuotaTarget["kind"];
}) {
  const { userId, requestId, limit, estCredits, expiresAt } = input;
  await prisma.$transaction(async (tx) => {
    // ⭐ 咨询锁：同一用户的并发请求在这里排队，后面的数字才是最新的。
    // hashtext 把 cuid 映射成 int4，pg_advisory_xact_lock 事务结束自动释放。
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    // 顺手清掉过期占位（防泄漏兜底，不清也不会卡死，只是数字偏大）。
    await tx.$executeRaw`DELETE FROM "GenerationReservation" WHERE "expiresAt" <= NOW()`;

    const rows = await tx.$queryRaw<Array<{ requestId: string; estCredits: number }>>`
      SELECT "requestId", "estCredits" FROM "GenerationReservation"
      WHERE "userId" = ${userId} AND "expiresAt" > NOW()
    `;
    const jobRows = await tx.$queryRaw<Array<{ requestId: string }>>`
      SELECT "requestId" FROM "GenerationJob"
      WHERE "userId" = ${userId} AND "status" IN ('queued', 'running')
    `;

    // 同一次生成既可能有占位、也可能已经建了 job → 按 requestId 去重，别算两次。
    const inflightIds = new Set<string>();
    for (const row of rows) inflightIds.add(row.requestId);
    for (const row of jobRows) inflightIds.add(row.requestId);
    // 幂等：同一个 requestId 重试进来，不算新的一条。
    const isRetry = inflightIds.has(requestId);
    const inflightCount = isRetry ? inflightIds.size - 1 : inflightIds.size;
    if (Number.isFinite(limit) && inflightCount >= limit) throw new Error(MEMBERSHIP_CONCURRENCY_DENIED_MESSAGE);

    const inflightCredits = rows
      .filter((row) => row.requestId !== requestId)
      .reduce((sum, row) => sum + Math.max(0, row.estCredits), 0);

    const user = await tx.user.findUnique({ where: { id: userId }, select: { credits: true } });
    const credits = user?.credits ?? 0;
    // ⭐ 判据：余额要盖住「已经在跑的预估 + 这一次的预估」，不是只判 > 0。
    if (credits <= 0 || credits < inflightCredits + estCredits) throw new Error(CREDITS_NOT_ENOUGH_MESSAGE);

    await tx.$executeRaw`
      INSERT INTO "GenerationReservation" ("id", "userId", "requestId", "kind", "estCredits", "createdAt", "expiresAt")
      VALUES (gen_random_uuid()::text, ${userId}, ${requestId}, ${input.kind}, ${estCredits}, NOW(), ${expiresAt})
      ON CONFLICT ("requestId") DO UPDATE SET "estCredits" = ${estCredits}, "expiresAt" = ${expiresAt}
    `;
  });
}

/** 释放占位。任务落地（成功/失败）或同步接口结束时调用；失败静默（有 expiresAt 兜底）。 */
export async function releaseGenerationQuota(requestId?: string | null) {
  if (!requestId) return;
  await prisma.$executeRaw`DELETE FROM "GenerationReservation" WHERE "requestId" = ${requestId}`.catch(() => undefined);
}
