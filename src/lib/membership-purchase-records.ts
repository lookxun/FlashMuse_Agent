import { MEMBERSHIP_PERIOD_LABELS, getMembershipTierConfig, type MembershipTier } from "@/lib/membership";

export const DEMO_RECHARGE_EMAILS = ["12424740@qq.com", "lookxun@163.com", "176107103@qq.com"];

export type MembershipChargeRecord = {
  orderNo: string;
  at: string;
  tier: MembershipTier;
  period: string;
  listPriceCny: number;
  paidCny: number;
  discountLabel: string;
  creditsGranted: number;
  expiresAt: string;
  adminGrant?: boolean;
};

export type CreditChargeRecord = {
  orderNo: string;
  at: string;
  payCny: number;
  credits: number;
  rateLabel: string;
};

export function formatMembershipDateTime(value: Date | string) {
  return new Date(value).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).replace(/\//g, "-");
}

export function getDemoRechargeHistory(email: string): { membership: MembershipChargeRecord[]; credits: CreditChargeRecord[] } {
  if (!DEMO_RECHARGE_EMAILS.includes(email.toLowerCase())) return { membership: [], credits: [] };
  if (email.toLowerCase() === "lookxun@163.com") {
    return {
      membership: [
        { orderNo: "M2026081214220831", at: "2026-08-12 14:22", tier: "pro", period: "连续包年", listPriceCny: 2599, paidCny: 1299.5, discountLabel: "首年5折", creditsGranted: 25800, expiresAt: "2027-08-12" },
        { orderNo: "M2026050309184412", at: "2026-05-03 09:18", tier: "standard", period: "连续包季", listPriceCny: 199, paidCny: 99.5, discountLabel: "首季5折", creditsGranted: 1650, expiresAt: "2026-08-03" },
      ],
      credits: [
        { orderNo: "C2026082011062290", at: "2026-08-20 11:06", payCny: 200, credits: 1800, rateLabel: "¥10=90积分" },
        { orderNo: "C2026070816415503", at: "2026-07-08 16:41", payCny: 50, credits: 450, rateLabel: "¥10=90积分" },
      ],
    };
  }
  if (email.toLowerCase() === "176107103@qq.com") {
    return {
      membership: [
        { orderNo: "M2026081820057716", at: "2026-08-18 20:05", tier: "standard", period: "连续包月", listPriceCny: 69, paidCny: 34.5, discountLabel: "首月5折", creditsGranted: 550, expiresAt: "2026-09-18" },
      ],
      credits: [
        { orderNo: "C2026082208331048", at: "2026-08-22 08:33", payCny: 30, credits: 210, rateLabel: "¥10=70积分" },
      ],
    };
  }
  return {
    membership: [
      { orderNo: "M2026082510123907", at: "2026-08-25 10:12", tier: "standard", period: "连续包季", listPriceCny: 199, paidCny: 99.5, discountLabel: "首季5折", creditsGranted: 1650, expiresAt: "2026-11-25" },
      { orderNo: "M2026060119406621", at: "2026-06-01 19:40", tier: "standard", period: "单月", listPriceCny: 79, paidCny: 79, discountLabel: "无折扣", creditsGranted: 550, expiresAt: "2026-07-01" },
    ],
    credits: [
      { orderNo: "C2026082813178844", at: "2026-08-28 13:17", payCny: 100, credits: 700, rateLabel: "¥10=70积分" },
      { orderNo: "C2026081021041192", at: "2026-08-10 21:04", payCny: 10, credits: 70, rateLabel: "¥10=70积分" },
      { orderNo: "C2026071518223370", at: "2026-07-15 18:22", payCny: 50, credits: 250, rateLabel: "¥10=50积分" },
    ],
  };
}

export function ledgerToMembershipCharge(item: { id: string; createdAt: string | Date; credits: number; metadata?: Record<string, unknown> | null }): MembershipChargeRecord | null {
  const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
  const tier = metadata.tier === "pro" || metadata.tier === "standard" || metadata.tier === "free" ? metadata.tier : null;
  if (!tier) return null;
  const periodKey = typeof metadata.period === "string" ? metadata.period : "";
  const period = MEMBERSHIP_PERIOD_LABELS[periodKey as keyof typeof MEMBERSHIP_PERIOD_LABELS] ?? periodKey;
  const expiresAt = typeof metadata.expiresAt === "string" && metadata.expiresAt ? formatMembershipDateTime(metadata.expiresAt).slice(0, 10) : "—";
  return {
    orderNo: item.id,
    at: formatMembershipDateTime(item.createdAt),
    tier,
    period,
    listPriceCny: Number(metadata.listPriceCny) || 0,
    paidCny: 0,
    discountLabel: "—",
    creditsGranted: Number(metadata.creditsGranted) || (tier === "free" ? 0 : getMembershipTierConfig(tier).monthlyCredits),
    expiresAt,
    adminGrant: true,
  };
}
