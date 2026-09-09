import { forgetSessionIdentityByUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  MEMBERSHIP_SYSTEM_ENABLED,
  getActiveMembershipTier,
  getMembershipTierConfig,
  getMembershipUpgradeQuote,
  isMembershipPeriod,
  sanitizeMembershipSettings,
  type MembershipParkedState,
} from "@/lib/membership";
import { getMembershipSettings } from "@/lib/system-settings";

/* ============================================================================
 * 会员每月积分（唯一权威）—— 2026-08-30 新增
 *
 * ⭐⭐ 口径（用户拍板）：**扣费顺序 = 会员赠送的积分先扣，自己买的永久积分后扣。**
 *
 * 实现方式故意**不再开第二个余额**，而是：
 *   - `User.credits`          = 能花的**总余额**（全站所有地方读的还是它，一行调用方都不用改）
 *   - `User.membershipCredits` = 这总余额里**属于会员赠送**的那部分（子标记）
 *
 * 于是：
 *   发放  → credits += N，membershipCredits += N
 *   扣费  → credits -= n，membershipCredits = max(0, membershipCredits - n)   ← 会员分天然先被消耗
 *   过期  → credits -= 剩下的 membershipCredits（未用完的赠送分作废），membershipCredits = 0
 *
 * ⛔ 别改成「两个独立余额」：那样 `assertUserCanUseCredits` / 额度闸门 / 后台统计 / 用户中心
 *    十几处读余额的地方都要改，漏一处就是"有分花不出去"或"能花出不存在的分"。
 *
 * ⚠️ 发放是**懒触发**（读余额/开任务时顺手结算），不占常驻 worker 的 tick
 *    （本项目铁律：往 tick 里加活儿会连带把全站生成停摆）。
 * ========================================================================== */

/** 一个发放周期 = 30 天（与 MEMBERSHIP_PERIOD_DAYS 的结算口径一致，别改成自然月）。 */
const CREDIT_CYCLE_DAYS = 30;

type MembershipCreditRow = {
  membershipTier: string | null;
  membershipPeriod: string | null;
  membershipExpiresAt: Date | null;
  membershipPaidCny: number;
  membershipCredits: number;
  membershipCreditsCycleAt: Date | null;
  membershipParkedTier: string | null;
  membershipParkedPeriod: string | null;
  membershipParkedRemainingDays: number;
  membershipParkedPaidCny: number;
  membershipDiscountUsed: string[];
  credits: number;
};

function readParked(row: Pick<MembershipCreditRow, "membershipParkedTier" | "membershipParkedPeriod" | "membershipParkedRemainingDays" | "membershipParkedPaidCny">): MembershipParkedState | null {
  const tier = row.membershipParkedTier;
  const period = row.membershipParkedPeriod;
  if ((tier !== "standard" && tier !== "pro") || !isMembershipPeriod(period) || row.membershipParkedRemainingDays <= 0) return null;
  return { tier, period, remainingDays: row.membershipParkedRemainingDays, paidCny: row.membershipParkedPaidCny };
}

/**
 * 结算这个用户的会员积分：该发的发、该作废的作废。幂等，可以随便多调。
 *
 * ⭐ 全程在一个事务 + per-user 咨询锁里做，所以并发请求不会重复发放。
 * 返回是否改动过余额（调用方可以据此决定要不要重新读余额）。
 */
export async function settleMembershipCredits(userId?: string) {
  if (!userId) return false;
  // ⛔⛔ 总开关关着时**一个字都不许写库**。
  // 原因：会员关闭后 `getActiveMembershipTier()` 恒定返回 "free"，本函数会把所有人
  // 当成"会员已过期" → ① 有 membershipParked* 记录的会被"恢复"成会员并发积分；
  // ② membershipCredits > 0 的会被**从总余额里真扣掉**并记一条"作废"流水。
  // 这两件事在会员停用期间发生就是纯事故（真金白银），所以在这里一刀切拦住。
  if (!MEMBERSHIP_SYSTEM_ENABLED) return false;
  const membershipSettings = sanitizeMembershipSettings(getMembershipSettings());
  let changed = false;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`membership-credits:${userId}`}))`;
    const rows = await tx.$queryRaw<MembershipCreditRow[]>`
      SELECT "membershipTier", "membershipPeriod", "membershipExpiresAt", "membershipPaidCny", "membershipCredits", "membershipCreditsCycleAt",
             "membershipParkedTier", "membershipParkedPeriod", "membershipParkedRemainingDays", "membershipParkedPaidCny", "membershipDiscountUsed", "credits"
      FROM "User" WHERE "id" = ${userId}
    `;
    const row = rows[0];
    if (!row) return;

    const tier = getActiveMembershipTier(row);

    // ① 当前档到期：有搁着的低档就切回去，高级用完才用标准。
    if (tier === "free") {
      const parked = readParked(row);
      if (parked) {
        const restoredExpiresAt = new Date(Date.now() + parked.remainingDays * 86_400_000);
        await tx.$executeRaw`
          UPDATE "User" SET
            "membershipTier" = ${parked.tier},
            "membershipPeriod" = ${parked.period},
            "membershipExpiresAt" = ${restoredExpiresAt},
            "membershipPaidCny" = ${parked.paidCny},
            "membershipCreditsCycleAt" = NULL,
            "membershipParkedTier" = '',
            "membershipParkedPeriod" = '',
            "membershipParkedRemainingDays" = 0,
            "membershipParkedPaidCny" = 0
          WHERE "id" = ${userId}
        `;
        const restoredMonthly = getMembershipTierConfig(parked.tier, membershipSettings).monthlyCredits;
        if (restoredMonthly > 0) await grant(tx, userId, restoredMonthly, nextCycle(new Date()), "会员赠送积分");
        changed = true;
        forgetSessionIdentityByUserId(userId);
        return;
      }
    }

    // ② 会员已过期（或压根不是会员）：未用完的赠送分作废。
    if (tier === "free") {
      if (row.membershipCredits > 0) {
        const voided = Math.min(row.membershipCredits, row.credits);
        await tx.$executeRaw`
          UPDATE "User" SET "credits" = "credits" - ${voided}, "membershipCredits" = 0, "membershipCreditsCycleAt" = NULL
          WHERE "id" = ${userId}
        `;
        await tx.creditLedger.create({
          data: {
            userId,
            direction: "consume",
            kind: "membership_expired",
            label: "会员到期·未用完赠送积分作废",
            credits: voided,
            metadata: { source: "membership_expired" },
          },
        });
        changed = true;
      } else if (row.membershipCreditsCycleAt) {
        await tx.$executeRaw`UPDATE "User" SET "membershipCreditsCycleAt" = NULL WHERE "id" = ${userId}`;
      }
      return;
    }

    const monthly = getMembershipTierConfig(tier, membershipSettings).monthlyCredits;
    if (monthly <= 0) return;

    // ② 还没有发放周期 → 立刻发第一期（刚开通/刚升级）。
    if (!row.membershipCreditsCycleAt) {
      await grant(tx, userId, monthly, nextCycle(new Date()), "会员赠送积分");
      changed = true;
      return;
    }

    // ③ 到点了 → 补发。⚠️ 用 while 补齐（用户可能很久没来），但最多补到期为止。
    const expiresAt = row.membershipExpiresAt;
    let cycleAt = row.membershipCreditsCycleAt;
    let grants = 0;
    while (cycleAt.getTime() <= Date.now() && grants < 24) {
      if (expiresAt && cycleAt.getTime() > expiresAt.getTime()) break;
      cycleAt = nextCycle(cycleAt);
      grants += 1;
    }
    if (grants > 0) {
      await grant(tx, userId, monthly * grants, cycleAt, grants > 1 ? `会员赠送积分（补发${grants}期）` : "会员赠送积分");
      changed = true;
    }
  });

  return changed;
}

function nextCycle(from: Date) {
  return new Date(from.getTime() + CREDIT_CYCLE_DAYS * 86_400_000);
}

async function grant(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: string,
  credits: number,
  cycleAt: Date,
  label: string,
) {
  await tx.$executeRaw`
    UPDATE "User" SET
      "credits" = "credits" + ${credits},
      "membershipCredits" = "membershipCredits" + ${credits},
      "membershipCreditsCycleAt" = ${cycleAt}
    WHERE "id" = ${userId}
  `;
  await tx.creditLedger.create({
    data: {
      userId,
      direction: "increase",
      kind: "membership_grant",
      label,
      credits,
      metadata: { source: "membership_grant", cycleAt: cycleAt.toISOString() },
    },
  });
}

/**
 * 开通/续费/低升高时调用：写当前档、到期、搁着的低档、记下首期折已用，并立刻发第一期赠送积分。
 * ⛔ 这是**唯一**允许改 membershipTier / membershipExpiresAt 的地方（后台手工改除外），
 *    支付回调接进来时也走它，别再另写一份。钱和到期日以报价函数为准。
 */
export async function applyMembershipPurchase(input: {
  userId: string;
  tier: "standard" | "pro";
  period: string;
  paidCny: number;
  expiresAt?: Date;
  discountApplied: boolean;
  bonusCredits?: number;
  /** 后台「调会员」直接覆盖当前档，不排队、不续时间。 */
  forceReplace?: boolean;
}) {
  // ⛔ 总开关关着时不许改任何人的会员状态（后台入口本来也已经 403，这里是第二道防线）。
  if (!MEMBERSHIP_SYSTEM_ENABLED) return;
  const period = isMembershipPeriod(input.period) ? input.period : "month";
  const membershipSettings = sanitizeMembershipSettings(getMembershipSettings());
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`membership-credits:${input.userId}`}))`;
    const rows = await tx.$queryRaw<MembershipCreditRow[]>`
      SELECT "membershipTier", "membershipPeriod", "membershipExpiresAt", "membershipPaidCny", "membershipCredits", "membershipCreditsCycleAt",
             "membershipParkedTier", "membershipParkedPeriod", "membershipParkedRemainingDays", "membershipParkedPaidCny", "credits",
             "membershipDiscountUsed"
      FROM "User" WHERE "id" = ${input.userId}
    `;
    const previous = rows[0];
    if (!previous) return;
    if (input.forceReplace) {
      if (previous.membershipCredits > 0) {
        const voided = Math.min(previous.membershipCredits, previous.credits);
        await tx.$executeRaw`UPDATE "User" SET "credits" = "credits" - ${voided}, "membershipCredits" = 0 WHERE "id" = ${input.userId}`;
        await tx.creditLedger.create({
          data: { userId: input.userId, direction: "consume", kind: "membership_expired", label: "换档·上一档未用完赠送积分作废", credits: voided, metadata: { source: "membership_switch" } },
        });
      }
      const expiresAt = input.expiresAt ?? new Date();
      await tx.$executeRaw`
        UPDATE "User" SET
          "membershipTier" = ${input.tier},
          "membershipPeriod" = ${period},
          "membershipExpiresAt" = ${expiresAt},
          "membershipPaidCny" = ${Math.max(0, Math.round(input.paidCny))},
          "membershipCreditsCycleAt" = NULL,
          "membershipParkedTier" = '',
          "membershipParkedPeriod" = '',
          "membershipParkedRemainingDays" = 0,
          "membershipParkedPaidCny" = 0
        WHERE "id" = ${input.userId}
      `;
      return;
    }
    const quote = getMembershipUpgradeQuote(
      {
        tier: getActiveMembershipTier(previous),
        period: isMembershipPeriod(previous.membershipPeriod) ? previous.membershipPeriod : null,
        expiresAt: previous.membershipExpiresAt,
        paidCny: previous.membershipPaidCny,
        usedDiscountPeriods: previous.membershipDiscountUsed ?? [],
        parked: readParked(previous),
      },
      { tier: input.tier, period },
      membershipSettings,
    );
    const nextParked = quote.parked;
    const previousTier = getActiveMembershipTier(previous);
    const switchingActiveTier = previousTier !== quote.activeTier;
    const parkedTier = nextParked?.tier ?? "";
    const parkedPeriod = nextParked?.period ?? "";
    const parkedDays = nextParked?.remainingDays ?? 0;
    const parkedPaid = quote.kind === "park_lower" ? Math.max(0, Math.round(input.paidCny)) : (nextParked?.paidCny ?? 0);
    const resetCycle = switchingActiveTier;
    const nextPaidCny = quote.kind === "park_lower" ? previous.membershipPaidCny : Math.max(0, Math.round(input.paidCny));
    await tx.$executeRaw`
      UPDATE "User" SET
        "membershipTier" = ${quote.activeTier},
        "membershipPeriod" = ${quote.activePeriod},
        "membershipExpiresAt" = ${quote.newExpiresAt},
        "membershipPaidCny" = ${nextPaidCny},
        "membershipCreditsCycleAt" = ${resetCycle ? null : previous.membershipCreditsCycleAt},
        "membershipParkedTier" = ${parkedTier},
        "membershipParkedPeriod" = ${parkedPeriod},
        "membershipParkedRemainingDays" = ${parkedDays},
        "membershipParkedPaidCny" = ${parkedPaid},
        "membershipDiscountUsed" = CASE
          WHEN ${quote.discountApplied} AND NOT (${input.tier} = ANY("membershipDiscountUsed")) THEN array_append("membershipDiscountUsed", ${input.tier})
          ELSE "membershipDiscountUsed"
        END
      WHERE "id" = ${input.userId}
    `;
  });

  await settleMembershipCredits(input.userId);
  forgetSessionIdentityByUserId(input.userId);
}
