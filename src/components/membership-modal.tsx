"use client";

import { useEffect, useMemo, useState } from "react";
import { RiCheckLine, RiCloseLine, RiFileCopyLine, RiLeafLine, RiSeedlingLine, RiShining2Fill, RiTreeLine } from "react-icons/ri";
// ⭐ 假二维码搬到独立文件了（积分充值页也要用它；从这里 import 会把整个会员页打进生产包）。
import { FakePayQrCode } from "@/components/fake-pay-qr-code";
import {
  CREDIT_PACKS_CNY,
  MEMBERSHIP_PERIOD_LABELS,
  formatDiscountFold,
  getCreditPackCredits,
  getDiscountedPriceCny,
  getFirstMonthDiscount,
  getFirstMonthDiscountLabel,
  hasUsedMembershipDiscount,
  filterImageResolutionsForMembership,
  filterVideoResolutionsForMembership,
  getMembershipCompareRows,
  getMembershipLabel,
  getMembershipPlan,
  getMembershipTierConfig,
  getMembershipUpgradeQuote,
  formatMembershipPriceCny,
  isMembershipPeriod,
  type MembershipPeriod,
  type MembershipSettings,
  type MembershipTier,
  type MembershipUpgradeQuote,
} from "@/lib/membership";
import { getSupportedImageResolutions, getSupportedVideoResolutions } from "@/lib/models";
import { formatBeijingDateTime } from "@/lib/beijing-time";
import type { CreditChargeRecord, MembershipChargeRecord } from "@/lib/membership-purchase-records";

/** `/api/membership/quote` 的返回（服务端算好的钱和积分，前端只显示）。 */
/** ⚠️ 过 JSON 之后 `newExpiresAt` 是字符串不是 Date，别照 Date 用。 */
type SerializedQuote = Omit<MembershipUpgradeQuote, "newExpiresAt"> & { newExpiresAt: string };
type ServerQuoteResponse = {
  tier: MembershipTier;
  usedDiscountPeriods: string[];
  parked?: { tier: "standard" | "pro"; period: MembershipPeriod; remainingDays: number; paidCny: number } | null;
  credits: number;
  membershipCredits: number;
  quotes: Record<string, SerializedQuote>;
  creditPacks: Array<{ cny: number; credits: number }>;
};

const periods: MembershipPeriod[] = ["month", "monthly", "quarter", "year"];

const periodUnit: Record<MembershipPeriod, string> = {
  month: "每月",
  monthly: "每月",
  quarter: "每季",
  year: "每年",
};

const periodCardLabel: Record<MembershipPeriod, string> = {
  month: "月卡",
  monthly: "月卡",
  quarter: "季卡",
  year: "年卡",
};

const cardLane: Record<"free" | "standard" | "pro", string> = {
  free: "标准生成通道",
  standard: "快速生成通道",
  pro: "极速生成通道",
};

const cardPerks: Record<"free" | "standard" | "pro", Array<{ text: string; badge?: string; modelId?: string; kind?: "image" | "video" }>> = {
  free: [
    { text: "Seedream 5.0 Pro", modelId: "byteplus:conversation-image.seedream-5-0-pro", kind: "image" },
    { text: "Seedance 2.0", modelId: "byteplus:video.seedance-2-0", kind: "video" },
  ],
  standard: [
    { text: "Seedream 5.0 Pro", modelId: "byteplus:conversation-image.seedream-5-0-pro", kind: "image" },
    { text: "Seedance 2.0", modelId: "byteplus:video.seedance-2-0", kind: "video" },
    { text: "大香蕉图片3.0 pro", modelId: "google/gemini-3-pro-image-preview", kind: "image" },
  ],
  pro: [
    { text: "Seedream 5.0 Pro", modelId: "byteplus:conversation-image.seedream-5-0-pro", kind: "image" },
    { text: "Seedance 2.0", modelId: "byteplus:video.seedance-2-0", kind: "video" },
    { text: "大香蕉图片3.0 pro", modelId: "google/gemini-3-pro-image-preview", kind: "image" },
    { text: "GPT 图片5.4", modelId: "openai/gpt-5.4-image-2", kind: "image" },
    { text: "Seedance 2.5", modelId: "byteplus:video.seedance-2-5", kind: "video" },
  ],
};

function maxResolutionBadge(tier: MembershipTier, settings: MembershipSettings | undefined, perk: { modelId?: string; kind?: "image" | "video" }) {
  if (!perk.modelId || !perk.kind) return "";
  const list = perk.kind === "image"
    ? filterImageResolutionsForMembership(tier, getSupportedImageResolutions(perk.modelId), settings)
    : filterVideoResolutionsForMembership(tier, getSupportedVideoResolutions(perk.modelId), settings);
  return list[list.length - 1] ?? "";
}

function formatPrice(value: number) {
  return `¥${value.toLocaleString("en-US")}`;
}

function monthlyEquivalent(period: MembershipPeriod, price: number) {
  if (period === "month" || period === "monthly") return "";
  if (period === "quarter") return `每月¥${(price / 3).toFixed(2)} · 自动续订，可随时取消`;
  return `每月¥${(price / 12).toFixed(2)} · 自动续订，可随时取消`;
}

function formatMembershipDate(value?: string | Date | null) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatBeijingDateTime(date);
}

function membershipRemainingDays(expiresAt?: string | null) {
  if (!expiresAt) return 0;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.ceil(ms / 86_400_000);
}

function autoRenewHint(period: MembershipPeriod) {
  if (period === "month") return "一次性购买，到期后需重新开通";
  return "自动续订，可随时取消";
}

const grayBtn = "mt-5 flex h-12 w-full items-center justify-center rounded-full bg-[#f0f0f0] text-[14px] font-medium text-[#888888]";
const blackBtn = "mt-5 flex h-12 w-full flex-col items-center justify-center gap-0.5 rounded-full bg-[#111111] text-[14px] font-medium text-white";
const grayChip = "mt-4 inline-flex h-9 items-center rounded-full bg-[#f0f0f0] px-4 text-[13px] text-[#888888]";
const blackChip = "mt-4 inline-flex h-9 items-center rounded-full bg-[#111111] px-4 text-[13px] text-white";

// ⚠️ 必须覆盖全部周期（含单月）：单月虽然没有首期折、这两行文案显示不出来，
// 但类型上 `period` 是 MembershipPeriod，少一个 key 就编不过。
const firstPeriodLabel: Record<MembershipPeriod, string> = {
  month: "首月",
  monthly: "首月",
  quarter: "首季",
  year: "首年",
};

const nextPeriodLabel: Record<MembershipPeriod, string> = {
  month: "下月",
  monthly: "下月",
  quarter: "下季",
  year: "下年",
};

const membershipCardStyles: Record<MembershipTier, { shell: string; badge: string; hint: string; Icon: typeof RiLeafLine }> = {
  free: {
    shell: "border-[#e1cbb6] bg-[linear-gradient(100deg,#ffffff_0%,#fbfaf7_54%,#f2eee6_100%)] shadow-[0_8px_20px_rgba(114,90,62,0.07)]",
    badge: "bg-[#c6b19d]",
    hint: "text-[#c6b19d]",
    Icon: RiLeafLine,
  },
  standard: {
    shell: "border-[#cfd6de] bg-[linear-gradient(100deg,#ffffff_0%,#f7f9fb_54%,#e8eef4_100%)] shadow-[0_8px_20px_rgba(90,110,130,0.08)]",
    badge: "bg-[#9aa8b6]",
    hint: "text-[#9aa8b6]",
    Icon: RiSeedlingLine,
  },
  pro: {
    shell: "border-[#e4d0a4] bg-[linear-gradient(100deg,#fffdf8_0%,#fbf4e4_54%,#f3e4c0_100%)] shadow-[0_8px_20px_rgba(150,120,50,0.10)]",
    badge: "bg-[#c9a227]",
    hint: "text-[#c9a227]",
    Icon: RiTreeLine,
  },
};

export function MembershipModal({
  open,
  currentTier,
  currentPeriod,
  currentExpiresAt,
  currentPaidCny,
  settings,
  nickname,
  account,
  avatarUrl,
  credits,
  initialCreditOpen = false,
  onClose,
}: {
  open: boolean;
  currentTier: MembershipTier;
  currentPeriod?: string | null;
  currentExpiresAt?: string | null;
  currentPaidCny?: number;
  settings?: MembershipSettings;
  nickname: string;
  account?: string;
  avatarUrl?: string;
  credits: number;
  initialCreditOpen?: boolean;
  onClose: () => void;
}) {
  const [period, setPeriod] = useState<MembershipPeriod>("quarter");
  const [tip, setTip] = useState("");
  const [creditOpen, setCreditOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageTab, setManageTab] = useState<"plan" | "orders">("plan");
  const [purchaseRecords, setPurchaseRecords] = useState<{ membership: MembershipChargeRecord[]; credits: CreditChargeRecord[] }>({ membership: [], credits: [] });
  const [copiedOrderNo, setCopiedOrderNo] = useState("");
  const [selectedPackCny, setSelectedPackCny] = useState<(typeof CREDIT_PACKS_CNY)[number]>(50);
  const [creditTip, setCreditTip] = useState("");
  // ⭐ 服务端报价（唯一权威）。打开充值页时拉一次，前端只负责显示。
  // ⛔ 本地那份 getMembershipUpgradeQuote 只用于"还没拉到"时的占位显示，
  //    真金白银一律以服务端为准（支付落库时服务端还会再复算一次）。
  const [serverQuote, setServerQuote] = useState<ServerQuoteResponse | null>(null);
  const usedDiscountPeriods = serverQuote?.usedDiscountPeriods ?? [];
  const compareRows = useMemo(() => getMembershipCompareRows(settings), [settings]);
  const standardPlan = getMembershipPlan("standard", period, settings);
  const proPlan = getMembershipPlan("pro", period, settings);
  const currentState = useMemo(
    () => ({
      tier: currentTier,
      period: isMembershipPeriod(currentPeriod) ? currentPeriod : null,
      expiresAt: currentExpiresAt ?? null,
      paidCny: currentPaidCny ?? 0,
      usedDiscountPeriods,
    }),
    [currentTier, currentPeriod, currentExpiresAt, currentPaidCny, usedDiscountPeriods],
  );
  const copyOrderNo = (orderNo: string) => {
    void navigator.clipboard?.writeText(orderNo).then(() => {
      setCopiedOrderNo(orderNo);
      window.setTimeout(() => setCopiedOrderNo((current) => (current === orderNo ? "" : current)), 1000);
    }).catch(() => undefined);
  };

  const selectedCredits = serverQuote?.creditPacks.find((pack) => pack.cny === selectedPackCny)?.credits
    ?? getCreditPackCredits(currentTier, selectedPackCny, settings);

  useEffect(() => {
    if (!open) return;
    setPeriod("quarter");
    setCreditOpen(initialCreditOpen);
    setManageOpen(false);
    setManageTab("plan");
    let cancelled = false;
    void fetch("/api/membership/purchases", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { membership?: MembershipChargeRecord[]; credits?: CreditChargeRecord[] } | null) => {
        if (!cancelled && data) setPurchaseRecords({ membership: data.membership ?? [], credits: data.credits ?? [] });
      })
      .catch(() => undefined);
    void fetch("/api/membership/quote", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: ServerQuoteResponse | null) => {
        if (!cancelled && data && data.quotes) setServerQuote(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open]);

  const quoteFor = (tier: MembershipTier, targetPeriod: MembershipPeriod): SerializedQuote | null => {
    if (tier === "free") return null;
    const fromServer = serverQuote?.quotes[`${tier}:${targetPeriod}`];
    if (fromServer) return fromServer;
    const local = getMembershipUpgradeQuote(currentState, { tier, period: targetPeriod }, settings);
    return { ...local, newExpiresAt: local.newExpiresAt.toISOString() };
  };

  if (!open) return null;

  return (
    <div className="yinzao-scrollbar-always fixed inset-0 z-[12000] overflow-y-auto bg-white text-[#111111]">
      <button type="button" onClick={onClose} className="fixed right-6 top-5 z-[12010] flex h-10 w-10 items-center justify-center rounded-[8px] text-[#888888] transition hover:bg-[#f3f3f3]" aria-label="关闭会员充值">
        <RiCloseLine className="h-6 w-6" />
      </button>
      <div className="mx-auto w-full max-w-[1120px] px-8 pb-16 pt-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[#f3f3f3]">
              {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[15px] font-medium text-[#888888]">{nickname.slice(0, 1)}</div>}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[16px] font-semibold">
                {nickname}
                {account ? <span className="ml-1.5 text-[12px] font-normal text-[#888888]">{account}</span> : null}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[13px] text-[#888888]">
                <span className="inline-flex items-center gap-1">
                  {(() => { const Icon = membershipCardStyles[currentTier].Icon; return <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />; })()}
                  {getMembershipLabel(currentTier)}
                  {currentTier !== "free" && currentExpiresAt ? <span className="text-[#111111]"> {formatBeijingDateTime(currentExpiresAt)}</span> : null}
                  {currentTier !== "free" && currentExpiresAt ? " 到期" : ""}
                </span>
                <span className="h-3 w-px shrink-0 bg-[#d8d8d8]" />
                <span className="inline-flex items-center gap-1">
                  <RiShining2Fill className="h-3.5 w-3.5 shrink-0 text-[#111111]" />
                  <span className="font-medium text-[#111111]">{credits.toLocaleString("en-US")}</span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => { setCreditOpen(true); setCreditTip(""); }} className="inline-flex h-9 items-center justify-center rounded-[8px] bg-[#f0f0f0] px-4 font-medium leading-none text-[#555555]"><span className="leading-none" style={{ fontSize: 13 }}>购买积分</span></button>
            <button type="button" onClick={() => { setManageOpen(true); setManageTab("plan"); }} className="inline-flex h-9 items-center justify-center rounded-[8px] bg-[#f0f0f0] px-4 font-medium leading-none text-[#555555]"><span className="leading-none" style={{ fontSize: 13 }}>订阅管理</span></button>
          </div>
        </div>
        <div className="mb-4 overflow-hidden rounded-[22px] px-8 py-6 text-white" style={{ background: "linear-gradient(150deg, #7c3aed 0%, #6b5ce7 50%, #e89ad4 88%, #f0a8c8 100%)" }}>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/18 px-2.5 py-0.5 text-[12px] font-medium">高级会员</span>
            <span className="rounded-full bg-[#c9a227] px-2.5 py-0.5 text-[12px] font-medium text-white">Seedance 2.5</span>
          </div>
          <div className="mt-3 text-[26px] font-semibold leading-tight tracking-[-0.03em]">高级会员解锁 Seedance 2.5</div>
          <div className="mt-1.5 text-[18px] font-medium text-white/90">包年更划算，加买积分低至 ¥10=90 分</div>
        </div>
        <h2 className="text-center text-[28px] font-semibold tracking-[-0.04em]">订阅闪念，解锁更多功能</h2>
        <p className="mt-3 text-center text-[13px] text-[#8a8a8a]">
          选择合适你的套餐，或直接
          <button type="button" onClick={() => { setCreditOpen(true); setCreditTip(""); }} className="mx-0.5 text-[#5b8def] underline underline-offset-2"><span className="font-semibold" style={{ fontWeight: 600 }}>购买积分</span></button>
        </p>

        <div className="mt-8 flex justify-center">
          <div className="inline-flex rounded-full bg-[#f3f3f3] p-1">
            {periods.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setPeriod(item)}
                className={`flex h-8 min-w-[168px] items-center justify-center gap-2.5 rounded-full px-6 font-medium transition ${period === item ? "bg-white text-[#111111] shadow-[0_1px_4px_rgba(0,0,0,0.08)]" : "text-[#777777]"}`}
              >
                <span className="text-[13px]">{MEMBERSHIP_PERIOD_LABELS[item]}</span>
                {getFirstMonthDiscountLabel(item, settings, usedDiscountPeriods) ? <span className={`text-[13px] ${period === item ? "text-[#c45c26]" : "text-[#b0b0b0]"}`}>{getFirstMonthDiscountLabel(item, settings, usedDiscountPeriods)}</span> : null}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-3 items-stretch gap-5">
          {([
            { tier: "free" as const, title: "基础会员", price: 0, monthlyCredits: getMembershipTierConfig("free", settings).monthlyCredits },
            { tier: "standard" as const, title: "标准会员", price: standardPlan?.priceCny ?? 0, monthlyCredits: getMembershipTierConfig("standard", settings).monthlyCredits },
            { tier: "pro" as const, title: "高级会员", price: proPlan?.priceCny ?? 0, monthlyCredits: getMembershipTierConfig("pro", settings).monthlyCredits },
          ]).map(({ tier, title, price, monthlyCredits }) => {
            const creditsPerTen = getMembershipTierConfig(tier, settings).creditsPerCny * 10;
            const concurrency = getMembershipTierConfig(tier, settings).concurrency;
            const concurrencyText = concurrency <= 0 ? "同时生成无上限" : `同时生成 ${concurrency} 条`;
            const creditFold = tier === "standard" ? "7折" : tier === "pro" ? "6折" : "";
            const perks = [
              { text: `积分按10=${creditsPerTen}积分购买`, badge: creditFold || undefined },
              { text: "Agent/图片/视频/语音" },
              ...cardPerks[tier].map((perk) => ({ ...perk, badge: maxResolutionBadge(tier, settings, perk) || undefined })),
              { text: cardLane[tier] },
              { text: concurrencyText },
            ];
            const paidTier = tier === "free" ? undefined : tier;
            const discount = !paidTier || hasUsedMembershipDiscount(usedDiscountPeriods, paidTier) ? null : getFirstMonthDiscount(period, settings);
            const salePrice = getDiscountedPriceCny(price, period, settings, usedDiscountPeriods, paidTier);
            const equivalent = tier === "free" ? "可购买积分使用" : monthlyEquivalent(period, price);
            const cardStyle = membershipCardStyles[tier];
            return (
              <div key={tier} className="relative flex h-full flex-col">
                <div className={`relative z-10 -mb-6 flex min-h-[196px] w-full flex-col rounded-[22px] border px-7 py-5 ${cardStyle.shell}`}>
                  <div className="flex items-center gap-2">
                    <div className={`flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[15px] font-normal text-white ${cardStyle.badge}`}>
                      {title}
                      <cardStyle.Icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    {tier === "free" ? null : <span className={`text-[15px] font-normal ${cardStyle.hint}`}>{periodCardLabel[period]}</span>}
                  </div>
                  <div className="mt-3 flex items-end gap-2">
                    <span className="text-[44px] font-semibold leading-none tracking-[-0.05em]">{formatPrice(salePrice)}</span>
                    <span className="pb-1 text-[14px] text-[#888888]">{tier === "free" ? "每月" : periodUnit[period]}</span>
                    {discount ? <span className="pb-1 text-[14px] text-[#bbbbbb] line-through">{formatPrice(price)}</span> : null}
                  </div>
                  <div className={`mt-auto pt-4 text-[12px] leading-5 ${cardStyle.hint}`}>
                    {discount ? <div>{firstPeriodLabel[period]}{formatDiscountFold(discount.percent)}{formatPrice(salePrice)}，{nextPeriodLabel[period]}续费金额{formatPrice(price)}(每帐号1次)</div> : null}
                    <div>{equivalent || autoRenewHint(period)}</div>
                  </div>
                </div>
                <div className="flex flex-1 flex-col rounded-b-[22px] border border-[#ececec] bg-white px-7 pb-7 pt-12 shadow-[0_8px_28px_rgba(0,0,0,0.04)]">
                <div className="rounded-[14px] bg-[#f6f6f6] px-5 py-4">
                  <div className="flex items-center gap-1.5 text-[15px] font-medium text-[#111111]">
                    <RiShining2Fill className="h-4 w-4 text-[#888888]" />
                    {tier === "free" ? "无订阅积分" : `${monthlyCredits.toLocaleString("en-US")}积分每月`}
                  </div>
                  <div className="mt-1 text-[12px] text-[#9a9a9a]">换算¥10={creditsPerTen}积分</div>
                </div>
                {(() => {
                  if (tier === "free") return <div className={grayBtn}>免费使用</div>;
                  const quote = quoteFor(tier, period);
                  if (!quote) return null;
                  return (
                    <button type="button" onClick={() => setTip("支付接口还没接，会员档位和权益已经按这套生效。")} className={blackBtn}>
                      <span className="flex items-center gap-2">
                        <span>{formatMembershipPriceCny(quote.payCny)}</span>
                        {quote.discountApplied && discount ? <span className="text-[#e4c36a]">{firstPeriodLabel[period]}{formatDiscountFold(discount.percent)}</span> : null}
                      </span>
                    </button>
                  );
                })()}
                <div className="mt-6 flex-1 space-y-3 border-t border-[#f0f0f0] pt-5 text-[13px] text-[#333333]">
                  {perks.map((perk) => (
                    <div key={perk.text} className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="text-[#bbbbbb]">✓</span>
                        <span>{perk.text}</span>
                      </span>
                      {perk.badge ? <span className="shrink-0 rounded-full bg-[#f3f3f3] px-2 py-0.5 text-[11px] text-[#111111]">{perk.badge}</span> : null}
                    </div>
                  ))}
                </div>
                </div>
              </div>
            );
          })}
        </div>
        {tip ? <div className="mt-4 text-center text-[13px] text-[#888888]">{tip}</div> : null}

        <div className="mt-16 text-center text-[22px] font-semibold tracking-[-0.03em]">哪个计划更适合你</div>
        <div className="mt-8 overflow-hidden rounded-[16px] border border-[#eeeeee]">
          <div className="grid grid-cols-[220px_repeat(3,minmax(0,1fr))] border-b border-[#eeeeee] bg-white px-6 py-6 text-[14px] font-medium">
            <div />
            <div>
              <div>基础会员</div>
              <div className="mt-2 text-[22px] font-semibold">¥0<span className="ml-1 text-[13px] font-medium text-[#888888]">每月</span></div>
              <div className={grayChip}>免费使用</div>
            </div>
            <div>
              <div>标准会员</div>
              <div className="mt-2 text-[22px] font-semibold">¥{getDiscountedPriceCny(standardPlan?.priceCny ?? 79, period, settings, usedDiscountPeriods, "standard")}<span className="ml-1 text-[13px] font-medium text-[#888888]">{periodUnit[period]}</span></div>
              {(() => {
                const quote = quoteFor("standard", period);
                if (!quote) return null;
                return <div className={blackChip}>{formatMembershipPriceCny(quote.payCny)}</div>;
              })()}
            </div>
            <div>
              <div>高级会员</div>
              <div className="mt-2 text-[22px] font-semibold">¥{getDiscountedPriceCny(proPlan?.priceCny ?? 239, period, settings, usedDiscountPeriods, "pro")}<span className="ml-1 text-[13px] font-medium text-[#888888]">{periodUnit[period]}</span></div>
              {(() => {
                const quote = quoteFor("pro", period);
                if (!quote) return null;
                return <div className={blackChip}>{formatMembershipPriceCny(quote.payCny)}</div>;
              })()}
            </div>
          </div>
          {compareRows.map((row, index) => {
            const prev = compareRows[index - 1];
            const showGroup = !prev || prev.group !== row.group;
            return (
              <div key={`${row.group}-${row.label}`}>
                {showGroup ? <div className="bg-[#f7f7f7] px-6 py-3 text-[13px] font-medium text-[#555555]">{row.group}</div> : null}
                <div className="grid grid-cols-[220px_repeat(3,minmax(0,1fr))] border-t border-[#f0f0f0] px-6 py-3.5 text-[13px] text-[#333333]">
                  <div className="text-[#666666]">{row.label}</div>
                  <div>{row.free}</div>
                  <div>{row.standard}</div>
                  <div>{row.pro}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {manageOpen ? (
        <div className="fixed inset-0 z-[12100] flex items-center justify-center bg-black/62 px-4" onClick={() => setManageOpen(false)}>
          <div className="flex h-[720px] w-full max-w-[720px] origin-center flex-col rounded-[22px] bg-white px-8 py-7 text-[#111111] shadow-[0_20px_60px_rgba(0,0,0,0.22)]" style={{ animation: "membershipCreditPop .22s ease-out" }} onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="text-[20px] font-semibold">订阅管理</div>
              <button type="button" onClick={() => setManageOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-[8px] text-[#888888] hover:bg-[#f3f3f3]" aria-label="关闭订阅管理">
                <RiCloseLine className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 flex items-end border-b border-[#eeeeee]">
              <div className="flex gap-7">
                <button type="button" onClick={() => setManageTab("plan")} className={`pb-3 ${manageTab === "plan" ? "border-b-2 border-[#111111] font-medium text-[#111111]" : "text-[#888888]"}`}><span style={{ fontSize: 13 }}>订阅计划管理</span></button>
                <button type="button" onClick={() => setManageTab("orders")} className={`pb-3 ${manageTab === "orders" ? "border-b-2 border-[#111111] font-medium text-[#111111]" : "text-[#888888]"}`}><span style={{ fontSize: 13 }}>购买记录</span></button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pt-6">
              {manageTab === "plan" ? (
                <>
                  <div className="text-[13px] text-[#888888]">当前会员</div>
                  <div className="mt-3 flex min-h-[88px] items-center justify-between rounded-[8px] bg-[#f5f5f5] px-5 py-5">
                    <div className="flex items-center gap-2 text-[16px] font-medium text-[#111111]">
                      {(() => { const Icon = membershipCardStyles[currentTier].Icon; return <Icon className="h-4 w-4" aria-hidden="true" />; })()}
                      {getMembershipLabel(currentTier)}
                      {currentTier !== "free" ? <span className="text-[13px] font-normal text-[#888888]">剩余 {membershipRemainingDays(currentExpiresAt)} 天</span> : null}
                    </div>
                    <div className="text-right text-[12px] leading-5 text-[#888888]">
                      <div>有效期至</div>
                      <div className="text-[16px] font-medium text-[#111111]">{currentTier !== "free" ? formatMembershipDate(currentExpiresAt) : "—"}</div>
                    </div>
                  </div>
                  <div className="mt-8 text-[13px] text-[#888888]">其它会员</div>
                  {serverQuote?.parked && serverQuote.parked.remainingDays > 0 ? (
                    <div className="mt-3 flex min-h-[88px] items-center justify-between rounded-[8px] bg-[#f5f5f5] px-5 py-5">
                      <div className="flex items-center gap-2 text-[16px] font-medium text-[#111111]">
                        {(() => { const Icon = membershipCardStyles[serverQuote.parked.tier].Icon; return <Icon className="h-4 w-4" aria-hidden="true" />; })()}
                        {getMembershipLabel(serverQuote.parked.tier)}
                        <span className="text-[13px] font-normal text-[#888888]">剩余 {serverQuote.parked.remainingDays} 天</span>
                      </div>
                      <div className="text-right text-[12px] leading-5 text-[#888888]">
                        <div>有效期至</div>
                        <div className="text-[16px] font-medium text-[#111111]">{formatMembershipDate(new Date((currentExpiresAt ? new Date(currentExpiresAt).getTime() : Date.now()) + serverQuote.parked.remainingDays * 86_400_000))}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-16 flex flex-col items-center">
                      <div className="max-w-[360px] text-center text-[14px] leading-6 text-[#bbbbbb]">其它会员会显示在这里，如果同时开通标准和高级会员会优先使用高级会员</div>
                      <button type="button" onClick={() => setManageOpen(false)} className="mt-5 rounded-[8px] bg-[#f0f0f0] px-4 py-2 text-[#555555]"><span style={{ fontSize: 14 }}>查看更多套餐</span></button>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-4 pb-4">
                  {purchaseRecords.membership.length === 0 && purchaseRecords.credits.length === 0 ? (
                    <div className="flex h-full min-h-[240px] items-center justify-center text-[14px] text-[#888888]">暂无购买记录</div>
                  ) : (
                    <>
                      {purchaseRecords.membership.map((item) => (
                        <div key={item.orderNo} className="rounded-[14px] bg-[#f5f5f5] px-5 py-5">
                          <div className="text-[16px] font-semibold text-[#111111]">闪念{item.tier === "free" ? "基础" : item.tier === "pro" ? "高级" : "标准"}会员{item.period}</div>
                          <div className="mt-4 space-y-3 text-[13px]">
                            <div className="flex items-center justify-between"><span className="text-[#888888]">订阅类型</span><span>{item.period || "—"}</span></div>
                            <div className="flex items-center justify-between"><span className="text-[#888888]">价格</span><span>¥{item.listPriceCny.toFixed(2)}</span></div>
                            <div className="flex items-center justify-between"><span className="text-[#888888]">购买时间</span><span>{item.at}</span></div>
                            <div className="flex items-center justify-between gap-4"><span className="shrink-0 text-[#888888]">订单编号</span><span className="inline-flex min-w-0 items-center gap-1.5"><button type="button" onClick={() => copyOrderNo(item.orderNo)} className="flex h-5 w-5 shrink-0 items-center justify-center text-[#888888]" aria-label={copiedOrderNo === item.orderNo ? "已复制" : "复制订单编号"}>{copiedOrderNo === item.orderNo ? <RiCheckLine className="h-3.5 w-3.5 text-[#111111]" /> : <RiFileCopyLine className="h-3.5 w-3.5" />}</button><span className="truncate text-right font-mono text-[12px]">{item.orderNo}</span></span></div>
                            <div className="flex items-center justify-between"><span className="text-[#888888]">支付方式</span><span className={item.adminGrant ? "text-[#22a06b]" : ""}>{item.adminGrant ? "赠送" : "支付宝支付"}</span></div>
                          </div>
                        </div>
                      ))}
                      {purchaseRecords.credits.map((item) => (
                        <div key={item.orderNo} className="rounded-[14px] bg-[#f5f5f5] px-5 py-5">
                          <div className="text-[16px] font-semibold text-[#111111]">{item.credits.toLocaleString("en-US")} 积分充值</div>
                          <div className="mt-4 space-y-3 text-[13px]">
                            <div className="flex items-center justify-between"><span className="text-[#888888]">价格</span><span>¥{item.payCny.toFixed(2)}</span></div>
                            <div className="flex items-center justify-between"><span className="text-[#888888]">购买时间</span><span>{item.at}</span></div>
                            <div className="flex items-center justify-between gap-4"><span className="shrink-0 text-[#888888]">订单编号</span><span className="inline-flex min-w-0 items-center gap-1.5"><button type="button" onClick={() => copyOrderNo(item.orderNo)} className="flex h-5 w-5 shrink-0 items-center justify-center text-[#888888]" aria-label={copiedOrderNo === item.orderNo ? "已复制" : "复制订单编号"}>{copiedOrderNo === item.orderNo ? <RiCheckLine className="h-3.5 w-3.5 text-[#111111]" /> : <RiFileCopyLine className="h-3.5 w-3.5" />}</button><span className="truncate text-right font-mono text-[12px]">{item.orderNo}</span></span></div>
                            <div className="flex items-center justify-between"><span className="text-[#888888]">支付方式</span><span>支付宝支付</span></div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {creditOpen ? (
        <div className="fixed inset-0 z-[12100] flex items-center justify-center bg-black/62 px-4" onClick={() => setCreditOpen(false)}>
          <div className="w-full max-w-[920px] origin-center rounded-[22px] bg-white px-6 py-8 text-[#111111] shadow-[0_20px_60px_rgba(0,0,0,0.22)]" style={{ animation: "membershipCreditPop .22s ease-out" }} onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-11 w-11 overflow-hidden rounded-full bg-[#f3f3f3]">
                  {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[15px] font-medium text-[#888888]">{nickname.slice(0, 1)}</div>}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[16px] font-semibold">
                    {nickname}
                    {account ? <span className="ml-1.5 text-[12px] font-normal text-[#888888]">{account}</span> : null}
                  </div>
                  <div className="mt-0.5 flex min-w-0 items-center gap-1 text-[13px] text-[#888888]">
                    {(() => { const Icon = membershipCardStyles[currentTier].Icon; return <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />; })()}
                    {getMembershipLabel(currentTier)}
                    {currentTier !== "free" && currentExpiresAt ? <span className="text-[#111111]"> {formatBeijingDateTime(currentExpiresAt)}</span> : null}
                    {currentTier !== "free" && currentExpiresAt ? " 到期" : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-[13px] text-[#777777]">
                  我的积分
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#f3f3f3] px-2 py-0.5 font-medium text-[#111111]">
                    <RiShining2Fill className="h-3.5 w-3.5" />
                    {credits.toLocaleString("en-US")}
                  </span>
                </div>
                <button type="button" onClick={() => setCreditOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-[8px] text-[#888888] hover:bg-[#f3f3f3]" aria-label="关闭积分购买">
                  <RiCloseLine className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="mt-6 flex items-stretch gap-4">
              <div className="min-w-0 flex-1 rounded-[18px] bg-[#efefef] p-6">
                <div className="mb-4 flex items-center justify-center gap-3 text-[14px] font-medium text-[#555555]">
                  <span className="h-px w-16 bg-[#ddd]" />
                  积分购买
                  <span className="h-px w-16 bg-[#ddd]" />
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {CREDIT_PACKS_CNY.map((cny) => {
                    const packCredits = getCreditPackCredits("free", cny, settings);
                    const selected = selectedPackCny === cny;
                    const creditFold = currentTier === "standard" ? "7折" : currentTier === "pro" ? "6折" : "";
                    const priceRows = [
                      { tier: "free" as const, label: "基础", price: cny },
                      { tier: "standard" as const, label: "标准", price: Math.round(cny * 7) / 10 },
                      { tier: "pro" as const, label: "高级", price: Math.round(cny * 6) / 10 },
                    ];
                    return (
                      <button
                        key={cny}
                        type="button"
                        onClick={() => setSelectedPackCny(cny)}
                        className={`relative overflow-hidden rounded-[12px] bg-white px-3 py-5 text-left transition ${selected ? "border-2 border-[#111111]" : "border-2 border-transparent"}`}
                      >
                        {creditFold ? <span className="absolute right-1.5 top-1.5 rounded-[3px] bg-[#2ec7c0] px-1.5 py-0.5 text-[11px] font-medium leading-none text-white">{creditFold}</span> : null}
                        <div className="flex items-center gap-1 text-[18px] font-semibold">
                          <RiShining2Fill className="h-4 w-4 text-[#555555]" />
                          {packCredits.toLocaleString("en-US")}
                        </div>
                        <div className="mt-2 space-y-1">
                          {priceRows.map((row) => {
                            const active = currentTier === row.tier;
                            return (
                              <div key={row.tier} className={`flex items-center gap-1.5 text-[11px] ${active ? "text-[#111111]" : "text-[#bbbbbb] line-through"}`}>
                                <span className={`inline-flex h-[16px] items-center rounded-[3px] px-1 font-medium leading-none ${active ? "bg-[#111111] text-white" : "bg-[#e8e8e8] text-[#888888]"}`}>{row.label}</span>
                                <span>¥{row.price.toFixed(2)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex w-[220px] shrink-0 items-center justify-center rounded-[18px] bg-[#efefef]">
                <div className="relative h-[196px] w-[196px] overflow-hidden rounded-[12px] bg-white">
                  <div className="pointer-events-none absolute inset-[10px]" aria-hidden="true">
                    <FakePayQrCode />
                  </div>
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-3 text-center">
                    <div className="text-[13px] leading-5 text-[#555555]">支付前请阅读<br />《闪念付费服务协议》</div>
                    <button
                      type="button"
                      disabled
                      className="mt-4 flex h-10 w-[148px] cursor-not-allowed items-center justify-center rounded-full bg-[#2ec7c0] text-[14px] font-medium text-white opacity-90"
                    >
                      同意并支付
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-start gap-4 text-[13px] leading-5 text-[#9a9a9a]">
              <div className="min-w-0 flex-1">温馨提示：积分不可兑换会员，不可转赠，也不可提现；积分充值后不过期，不可反向兑换为人民币。</div>
              <div className="w-[220px] shrink-0 text-center">请扫码完成支付<br />《闪念付费服务协议》</div>
            </div>
            {creditTip ? <div className="mt-3 text-center text-[13px] text-[#888888]">{creditTip}</div> : null}
          </div>
        </div>
      ) : null}
      <style>{`
        @keyframes membershipCreditPop { 0% { transform: scale(0.5); } 70% { transform: scale(1.05); } 100% { transform: scale(1); } }
      `}</style>
    </div>
  );
}
