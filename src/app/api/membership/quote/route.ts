import { NextResponse } from "next/server";
import { getCurrentUser, jsonError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembershipSettings } from "@/lib/system-settings";
import { settleMembershipCredits } from "@/lib/membership-credits";
import {
  CREDIT_PACKS_CNY,
  MEMBERSHIP_PERIODS,
  MEMBERSHIP_SYSTEM_ENABLED,
  getActiveMembershipTier,
  getCreditPackCredits,
  getMembershipUpgradeQuote,
  isMembershipPeriod,
  sanitizeMembershipSettings,
} from "@/lib/membership";

export const runtime = "nodejs";

/* ============================================================================
 * 会员报价（服务端唯一权威）—— 2026-08-30 新增
 *
 * ⛔ 为什么必须有这个接口：升级要付多少钱、积分包能拿多少积分，原来**只在前端算**。
 *    接支付时如果直接信前端传来的金额，用户改一个数就能 1 块钱买年卡。
 *
 * ⭐ 规则：**钱和积分只认这里算出来的**。
 *    支付回调落库时也必须重新调 `getMembershipUpgradeQuote` 复算一遍，
 *    ⛔ 绝不允许把客户端传来的 payCny / credits 直接写进账。
 * ========================================================================== */

export async function GET() {
  // ⛔ 会员总开关关着时这个接口整体不可用（它只服务会员充值页，而那个页面已经下架）。
  // 别让它继续对外可调：它会顺手结算会员积分 = 在会员停用期间动真余额。
  if (!MEMBERSHIP_SYSTEM_ENABLED) return jsonError("会员系统未启用", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);

  // 顺手结算会员每月积分（到点发放 / 过期作废），保证返回的余额是最新的。
  await settleMembershipCredits(user.id).catch(() => undefined);

  const rows = await prisma.$queryRaw<Array<{
    membershipTier: string | null;
    membershipPeriod: string | null;
    membershipExpiresAt: Date | null;
    membershipPaidCny: number;
    membershipDiscountUsed: string[];
    membershipCredits: number;
    membershipParkedTier: string | null;
    membershipParkedPeriod: string | null;
    membershipParkedRemainingDays: number;
    membershipParkedPaidCny: number;
    credits: number;
  }>>`
    SELECT "membershipTier", "membershipPeriod", "membershipExpiresAt", "membershipPaidCny",
           "membershipDiscountUsed", "membershipCredits", "credits",
           "membershipParkedTier", "membershipParkedPeriod", "membershipParkedRemainingDays", "membershipParkedPaidCny"
    FROM "User" WHERE "id" = ${user.id}
  `;
  const row = rows[0];
  if (!row) return jsonError("用户不存在", 404);

  const settings = sanitizeMembershipSettings(getMembershipSettings());
  const tier = getActiveMembershipTier(row);
  const parked = (row.membershipParkedTier === "standard" || row.membershipParkedTier === "pro") && isMembershipPeriod(row.membershipParkedPeriod) && row.membershipParkedRemainingDays > 0
    ? { tier: row.membershipParkedTier as "standard" | "pro", period: row.membershipParkedPeriod, remainingDays: row.membershipParkedRemainingDays, paidCny: row.membershipParkedPaidCny }
    : null;
  const current = {
    tier,
    period: isMembershipPeriod(row.membershipPeriod) ? row.membershipPeriod : null,
    expiresAt: row.membershipExpiresAt,
    paidCny: row.membershipPaidCny,
    usedDiscountPeriods: row.membershipDiscountUsed ?? [],
    parked,
  };

  const quotes: Record<string, ReturnType<typeof getMembershipUpgradeQuote>> = {};
  for (const targetTier of ["standard", "pro"] as const) {
    for (const period of MEMBERSHIP_PERIODS) {
      quotes[`${targetTier}:${period}`] = getMembershipUpgradeQuote(current, { tier: targetTier, period }, settings);
    }
  }

  return NextResponse.json({
    tier,
    period: current.period ?? "",
    expiresAt: row.membershipExpiresAt ? row.membershipExpiresAt.toISOString() : null,
    usedDiscountPeriods: current.usedDiscountPeriods,
    discountUsed: {
      standard: (current.usedDiscountPeriods ?? []).includes("standard"),
      pro: (current.usedDiscountPeriods ?? []).includes("pro"),
    },
    parked,
    credits: row.credits,
    membershipCredits: row.membershipCredits,
    quotes,
    // 积分包也在服务端算：档位折扣（标准 7 折 / 高级 6 折）不许由前端决定。
    creditPacks: CREDIT_PACKS_CNY.map((cny) => ({ cny, credits: getCreditPackCredits(tier, cny, settings) })),
  });
}
