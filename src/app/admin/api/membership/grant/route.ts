import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { getCurrentAdminEmail } from "@/lib/admin-auth";
import { forgetSessionIdentityByUserId } from "@/lib/auth";
import { applyMembershipPurchase } from "@/lib/membership-credits";
import { MEMBERSHIP_PERIOD_DAYS, MEMBERSHIP_PERIOD_LABELS, MEMBERSHIP_SYSTEM_ENABLED, MEMBERSHIP_TIER_LABELS, getMembershipPlan, getMembershipTierConfig, isMembershipPeriod, type MembershipPeriod, type MembershipTier } from "@/lib/membership";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const GRANT_PERIODS = ["monthly", "quarter", "year"] as const;
const GRANT_TIERS = ["free", "standard", "pro"] as const;

export async function POST(request: Request) {
  const email = await getCurrentAdminEmail();
  if (!email || !isAdminEmail(email)) return NextResponse.json({ error: "无权限" }, { status: 403 });
  if (!MEMBERSHIP_SYSTEM_ENABLED) return NextResponse.json({ error: "会员系统未启用" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const tier = GRANT_TIERS.includes(body.tier) ? (body.tier as MembershipTier) : "";
  const period = GRANT_PERIODS.includes(body.period) ? (body.period as MembershipPeriod) : "";
  if (!userId) return NextResponse.json({ error: "缺少用户ID" }, { status: 400 });
  if (!tier || !period) return NextResponse.json({ error: "请选择会员档和周期" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

  const now = new Date();
  const expiresAt = tier === "free" ? null : new Date(now.getTime() + MEMBERSHIP_PERIOD_DAYS[period] * 86_400_000);
  const listPriceCny = tier === "free" ? 0 : getMembershipPlan(tier, period).priceCny;
  const creditsGranted = tier === "free" ? 0 : getMembershipTierConfig(tier).monthlyCredits;

  if (tier === "free") {
    await prisma.$executeRaw`
      UPDATE "User" SET
        "membershipTier" = 'free',
        "membershipPeriod" = ${period},
        "membershipExpiresAt" = NULL,
        "membershipPaidCny" = 0,
        "membershipCreditsCycleAt" = NULL,
        "membershipParkedTier" = '',
        "membershipParkedPeriod" = '',
        "membershipParkedRemainingDays" = 0,
        "membershipParkedPaidCny" = 0
      WHERE "id" = ${userId}
    `;
  } else {
    if (!isMembershipPeriod(period)) return NextResponse.json({ error: "周期无效" }, { status: 400 });
    await applyMembershipPurchase({
      userId,
      tier,
      period,
      paidCny: 0,
      expiresAt: expiresAt as Date,
      discountApplied: false,
      forceReplace: true,
    });
  }

  await prisma.creditLedger.create({
    data: {
      userId,
      direction: "increase",
      kind: "admin_membership_grant",
      label: `后台赠送${MEMBERSHIP_TIER_LABELS[tier]}${MEMBERSHIP_PERIOD_LABELS[period]}`,
      credits: 0,
      metadata: {
        source: "admin_membership_grant",
        adminEmail: email,
        tier,
        period,
        listPriceCny,
        paidCny: 0,
        creditsGranted,
        grantStartedAt: now.toISOString(),
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
      },
    },
  });
  forgetSessionIdentityByUserId(userId);
  return NextResponse.json({ ok: true });
}
