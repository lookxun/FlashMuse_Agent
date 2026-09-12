export const MEMBERSHIP_SYSTEM_ENABLED = false;

export const MEMBERSHIP_TIERS = ["free", "standard", "pro"] as const;
export type MembershipTier = (typeof MEMBERSHIP_TIERS)[number];

export const MEMBERSHIP_PERIODS = ["month", "monthly", "quarter", "year"] as const;
export type MembershipPeriod = (typeof MEMBERSHIP_PERIODS)[number];

export const MEMBERSHIP_TIER_LABELS: Record<MembershipTier, string> = {
  free: "基础会员",
  standard: "标准会员",
  pro: "高级会员",
};

export const MEMBERSHIP_PERIOD_LABELS: Record<MembershipPeriod, string> = {
  month: "单月",
  monthly: "连续包月",
  quarter: "连续包季",
  year: "连续包年",
};

export type MembershipPlan = {
  tier: Exclude<MembershipTier, "free">;
  period: MembershipPeriod;
  priceCny: number;
  monthlyCredits: number;
  totalCredits: number;
};

export const MEMBERSHIP_MONTHLY_CREDITS: Record<Exclude<MembershipTier, "free">, number> = {
  standard: 550,
  pro: 2150,
};

export const MEMBERSHIP_PLANS: MembershipPlan[] = [
  { tier: "standard", period: "month", priceCny: 79, monthlyCredits: 550, totalCredits: 550 },
  { tier: "standard", period: "monthly", priceCny: 69, monthlyCredits: 550, totalCredits: 550 },
  { tier: "standard", period: "quarter", priceCny: 199, monthlyCredits: 550, totalCredits: 1650 },
  { tier: "standard", period: "year", priceCny: 749, monthlyCredits: 550, totalCredits: 6600 },
  { tier: "pro", period: "month", priceCny: 239, monthlyCredits: 2150, totalCredits: 2150 },
  { tier: "pro", period: "monthly", priceCny: 229, monthlyCredits: 2150, totalCredits: 2150 },
  { tier: "pro", period: "quarter", priceCny: 669, monthlyCredits: 2150, totalCredits: 6450 },
  { tier: "pro", period: "year", priceCny: 2599, monthlyCredits: 2150, totalCredits: 25800 },
];

export const CREDIT_PACKS_CNY = [50, 100, 200, 500, 1000, 2000, 3000, 5000] as const;
export const CREDIT_PACK_COUNT = CREDIT_PACKS_CNY.length;

export type CreditPack = {
  payCny: number;
  credits: number;
  locked: boolean;
};

export const DEFAULT_CREDIT_PACKS: CreditPack[] = CREDIT_PACKS_CNY.map((cny) => ({ payCny: cny, credits: cny * 5, locked: true }));

function sanitizeCreditPackPayCny(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n * 100) / 100;
  if (rounded < 0.01 || rounded > 99999) return null;
  return rounded;
}

function sanitizeCreditPackCreditsValue(value: unknown) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1 || n > 999999) return null;
  return n;
}

export function sanitizeCreditPacks(value: unknown): CreditPack[] {
  const list = Array.isArray(value) ? value : [];
  return DEFAULT_CREDIT_PACKS.map((fallback, index) => {
    const raw = list[index];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...fallback };
    const record = raw as Record<string, unknown>;
    return {
      payCny: sanitizeCreditPackPayCny(record.payCny) ?? fallback.payCny,
      credits: sanitizeCreditPackCreditsValue(record.credits) ?? fallback.credits,
      locked: typeof record.locked === "boolean" ? record.locked : fallback.locked,
    };
  });
}

export function isCreditPackIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < CREDIT_PACK_COUNT;
}

export const CREDIT_PACK_CREDITS_PER_CNY: Record<MembershipTier, number> = {
  free: 5,
  standard: 7,
  pro: 9,
};

export const MEMBERSHIP_CONCURRENCY: Record<MembershipTier, number> = {
  free: 1,
  standard: 3,
  pro: Number.POSITIVE_INFINITY,
};

export const MEMBERSHIP_IMAGE_RESOLUTIONS = ["2K", "3K", "4K"] as const;
export const MEMBERSHIP_VIDEO_RESOLUTIONS = ["720p", "1080p", "2K", "4K"] as const;
export type MembershipImageResolution = (typeof MEMBERSHIP_IMAGE_RESOLUTIONS)[number];
export type MembershipVideoResolution = (typeof MEMBERSHIP_VIDEO_RESOLUTIONS)[number];

export const MEMBERSHIP_FIRST_MONTH_DISCOUNT_PERIODS = ["monthly", "quarter", "year"] as const;
export type MembershipFirstMonthDiscountPeriod = (typeof MEMBERSHIP_FIRST_MONTH_DISCOUNT_PERIODS)[number];

export type MembershipPriceConfig = {
  priceCny: number;
  locked: boolean;
};

export type MembershipTierConfig = {
  monthlyCredits: number;
  monthlyCreditsLocked: boolean;
  creditsPerCny: number;
  creditsPerCnyLocked: boolean;
  concurrency: number;
  concurrencyLocked: boolean;
  prices: Record<MembershipPeriod, MembershipPriceConfig>;
  imageResolutions: MembershipImageResolution[];
  videoResolutions: MembershipVideoResolution[];
  allowedImageModelIds: string[];
  allowedVideoModelIds: string[];
};

export type MembershipFirstMonthDiscount = {
  enabled: boolean;
  percent: number;
};

export type MembershipSettings = {
  tiers: Record<MembershipTier, MembershipTierConfig>;
  firstMonthDiscounts: Record<MembershipFirstMonthDiscountPeriod, MembershipFirstMonthDiscount>;
};

export const DEFAULT_MEMBERSHIP_IMAGE_MODEL_IDS = [
  "byteplus:conversation-image.seedream-4-5",
  "byteplus:conversation-image.seedream-5-0",
  "byteplus:conversation-image.seedream-5-0-pro",
  "bytedance-seed/seedream-4.5",
  "recraft/recraft-v4.1",
  "recraft/recraft-v4.1-pro",
  "google/gemini-3.1-flash-image-preview",
  "google/gemini-3-pro-image-preview",
  "openai/gpt-5.4-image-2-agent",
  "openai/gpt-5.4-image-2",
  "openai/gpt-image-2.5-flare",
  "openai/gpt-image-2.5-sunburst",
] as const;

export const DEFAULT_MEMBERSHIP_VIDEO_MODEL_IDS = [
  "byteplus:video.seedance-2-0-mini",
  "byteplus:video.seedance-2-0-fast",
  "byteplus:video.seedance-2-0",
  "byteplus:video.seedance-2-5",
  "minimax/hailuo-3",
  "kwaivgi/kling-v3.0-std",
  "kwaivgi/kling-v3.0-pro",
] as const;

const DEFAULT_FREE_IMAGE_MODEL_IDS = [
  "byteplus:conversation-image.seedream-4-5",
  "byteplus:conversation-image.seedream-5-0",
  "byteplus:conversation-image.seedream-5-0-pro",
  "bytedance-seed/seedream-4.5",
] as const;

const DEFAULT_STANDARD_IMAGE_MODEL_IDS = DEFAULT_MEMBERSHIP_IMAGE_MODEL_IDS.filter((id) => !id.startsWith("openai/gpt-5.4-image-2") && !id.startsWith("openai/gpt-image-2.5"));
// ⛔ 2026-08-30 用户拍板：MiniMax H3 **从基础会员拿掉，标准会员起才能用**。
// 原因：H3 只有 2K 一档，而基础会员画质上限是 720p —— 两条配置互相矛盾时，
// 服务端按「归一化后的真实档位」校验会直接拒掉，等于给基础会员一个点了就报错的模型。
const DEFAULT_FREE_VIDEO_MODEL_IDS = [
  "byteplus:video.seedance-2-0-mini",
  "byteplus:video.seedance-2-0-fast",
  "byteplus:video.seedance-2-0",
] as const;
const DEFAULT_STANDARD_VIDEO_MODEL_IDS = DEFAULT_MEMBERSHIP_VIDEO_MODEL_IDS.filter((id) => id !== "byteplus:video.seedance-2-5");

const EMPTY_PRICES: Record<MembershipPeriod, MembershipPriceConfig> = {
  month: { priceCny: 0, locked: true },
  monthly: { priceCny: 0, locked: true },
  quarter: { priceCny: 0, locked: true },
  year: { priceCny: 0, locked: true },
};

export const DEFAULT_MEMBERSHIP_SETTINGS: MembershipSettings = {
  tiers: {
    free: {
      monthlyCredits: 0,
      monthlyCreditsLocked: true,
      creditsPerCny: 5,
      creditsPerCnyLocked: true,
      concurrency: 1,
      concurrencyLocked: true,
      prices: { ...EMPTY_PRICES },
      imageResolutions: ["2K"],
      videoResolutions: ["720p"],
      allowedImageModelIds: [...DEFAULT_FREE_IMAGE_MODEL_IDS],
      allowedVideoModelIds: [...DEFAULT_FREE_VIDEO_MODEL_IDS],
    },
    standard: {
      monthlyCredits: 550,
      monthlyCreditsLocked: true,
      creditsPerCny: 7,
      creditsPerCnyLocked: true,
      concurrency: 3,
      concurrencyLocked: true,
      prices: {
        month: { priceCny: 79, locked: true },
        monthly: { priceCny: 69, locked: true },
        quarter: { priceCny: 199, locked: true },
        year: { priceCny: 749, locked: true },
      },
      imageResolutions: ["2K", "3K"],
      // ⭐ 这里的 2K 是**为了让标准会员能用 MiniMax H3**（H3 只有 2K 一档，不给就等于给个点了报错的模型）。
      // 目前只有 H3 支持 2K，所以加它的影响面就只有 H3；**1080p 仍然是高级会员专属**，别顺手补上。
      videoResolutions: ["720p", "2K"],
      allowedImageModelIds: [...DEFAULT_STANDARD_IMAGE_MODEL_IDS],
      allowedVideoModelIds: [...DEFAULT_STANDARD_VIDEO_MODEL_IDS],
    },
    pro: {
      monthlyCredits: 2150,
      monthlyCreditsLocked: true,
      creditsPerCny: 9,
      creditsPerCnyLocked: true,
      concurrency: 0,
      concurrencyLocked: true,
      prices: {
        month: { priceCny: 239, locked: true },
        monthly: { priceCny: 229, locked: true },
        quarter: { priceCny: 669, locked: true },
        year: { priceCny: 2599, locked: true },
      },
      imageResolutions: ["2K", "3K", "4K"],
      videoResolutions: ["720p", "1080p", "2K", "4K"],
      allowedImageModelIds: [...DEFAULT_MEMBERSHIP_IMAGE_MODEL_IDS],
      allowedVideoModelIds: [...DEFAULT_MEMBERSHIP_VIDEO_MODEL_IDS],
    },
  },
  firstMonthDiscounts: {
    monthly: { enabled: true, percent: 50 },
    quarter: { enabled: true, percent: 50 },
    year: { enabled: true, percent: 50 },
  },
};

export const MEMBERSHIP_MODEL_DENIED_MESSAGE = "当前会员档不支持该模型，请升级会员后再试。";
export const MEMBERSHIP_RESOLUTION_DENIED_MESSAGE = "当前会员档不支持该画质，请升级会员后再试。";
export const MEMBERSHIP_CONCURRENCY_DENIED_MESSAGE = "当前会员同时生成已达上限，请等当前任务完成或升级会员。";

export function isMembershipTier(value: unknown): value is MembershipTier {
  return value === "free" || value === "standard" || value === "pro";
}

export function isMembershipPeriod(value: unknown): value is MembershipPeriod {
  return value === "month" || value === "monthly" || value === "quarter" || value === "year";
}

export function normalizeMembershipTier(value: unknown): MembershipTier {
  return isMembershipTier(value) ? value : "free";
}

export function getMembershipPlan(tier: Exclude<MembershipTier, "free">, period: MembershipPeriod, settings?: MembershipSettings) {
  const hardcoded = MEMBERSHIP_PLANS.find((plan) => plan.tier === tier && plan.period === period);
  const config = getMembershipTierConfig(tier, settings);
  const priceCny = config.prices?.[period]?.priceCny ?? hardcoded?.priceCny ?? 0;
  return {
    tier,
    period,
    priceCny,
    monthlyCredits: config.monthlyCredits,
    totalCredits: hardcoded?.totalCredits ?? config.monthlyCredits,
  };
}

export function getActiveMembershipTier(input?: { membershipTier?: string | null; membershipExpiresAt?: Date | string | null } | null | Record<string, unknown>): MembershipTier {
  if (!MEMBERSHIP_SYSTEM_ENABLED) return "free";
  const record = input && typeof input === "object" ? input as { membershipTier?: string | null; membershipExpiresAt?: Date | string | null } : null;
  const tier = normalizeMembershipTier(record?.membershipTier);
  if (tier === "free") return "free";
  const expiresAt = record?.membershipExpiresAt ? new Date(record.membershipExpiresAt) : null;
  if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) return "free";
  return tier;
}

export function getMembershipLabel(tier: MembershipTier) {
  if (tier === "standard") return "标准会员";
  if (tier === "pro") return "高级会员";
  return "基础会员";
}

export function isBytePlusGenerationModel(modelId?: string) {
  return Boolean(modelId?.startsWith("byteplus:") || modelId?.startsWith("bytedance-seed/") || modelId?.startsWith("bytedance/"));
}

export function isGptImageMembershipModel(modelId?: string) {
  return Boolean(modelId?.startsWith("openai/gpt-5.4-image-2") || modelId?.startsWith("openai/gpt-image-2.5"));
}

export function isSeedance25MembershipModel(modelId?: string) {
  return modelId === "byteplus:video.seedance-2-5";
}

export function isImageOrVideoGenerationModel(modelId?: string) {
  if (!modelId) return false;
  return modelId.includes("image")
    || modelId.includes("video")
    || modelId.includes("seedance")
    || modelId.includes("seedream")
    || modelId.includes("kling")
    || modelId.includes("veo")
    || modelId.includes("hailuo")
    || modelId.includes("recraft");
}

export function isMembershipImageResolution(value: unknown): value is MembershipImageResolution {
  return MEMBERSHIP_IMAGE_RESOLUTIONS.includes(value as MembershipImageResolution);
}

export function isMembershipVideoResolution(value: unknown): value is MembershipVideoResolution {
  return MEMBERSHIP_VIDEO_RESOLUTIONS.includes(value as MembershipVideoResolution);
}

export function isMembershipFirstMonthDiscountPeriod(value: unknown): value is MembershipFirstMonthDiscountPeriod {
  return value === "monthly" || value === "quarter" || value === "year";
}

function uniqueStrings(values: unknown, allowed?: readonly string[]) {
  const allow = allowed ? new Set(allowed) : null;
  const result: string[] = [];
  if (!Array.isArray(values)) return result;
  for (const item of values) {
    if (typeof item !== "string" || !item || (allow && !allow.has(item))) continue;
    if (!result.includes(item)) result.push(item);
  }
  return result;
}

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : fallback;
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(numberValue)));
}

function sanitizePriceConfig(raw: unknown, fallback: MembershipPriceConfig): MembershipPriceConfig {
  const record = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  return {
    priceCny: clampInt(record.priceCny, fallback.priceCny, 0, 99999),
    locked: typeof record.locked === "boolean" ? record.locked : fallback.locked,
  };
}

function sanitizeTierPrices(raw: unknown, fallback: Record<MembershipPeriod, MembershipPriceConfig>) {
  const record = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  return {
    month: sanitizePriceConfig(record.month, fallback.month),
    monthly: sanitizePriceConfig(record.monthly, fallback.monthly),
    quarter: sanitizePriceConfig(record.quarter, fallback.quarter),
    year: sanitizePriceConfig(record.year, fallback.year),
  };
}

function sanitizeTierConfig(raw: unknown, fallback: MembershipTierConfig): MembershipTierConfig {
  const record = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const imageResolutions = uniqueStrings(record.imageResolutions, MEMBERSHIP_IMAGE_RESOLUTIONS) as MembershipImageResolution[];
  const videoResolutions = uniqueStrings(record.videoResolutions, MEMBERSHIP_VIDEO_RESOLUTIONS) as MembershipVideoResolution[];
  return {
    monthlyCredits: clampInt(record.monthlyCredits, fallback.monthlyCredits, 0, 99999),
    monthlyCreditsLocked: typeof record.monthlyCreditsLocked === "boolean" ? record.monthlyCreditsLocked : fallback.monthlyCreditsLocked,
    creditsPerCny: clampInt(record.creditsPerCny, fallback.creditsPerCny, 1, 99),
    creditsPerCnyLocked: typeof record.creditsPerCnyLocked === "boolean" ? record.creditsPerCnyLocked : fallback.creditsPerCnyLocked,
    concurrency: clampInt(record.concurrency, fallback.concurrency, 0, 99),
    concurrencyLocked: typeof record.concurrencyLocked === "boolean" ? record.concurrencyLocked : fallback.concurrencyLocked,
    prices: sanitizeTierPrices(record.prices, fallback.prices),
    imageResolutions: imageResolutions.length > 0 ? imageResolutions : [...fallback.imageResolutions],
    videoResolutions: videoResolutions.length > 0 ? videoResolutions : [...fallback.videoResolutions],
    allowedImageModelIds: Array.isArray(record.allowedImageModelIds) ? uniqueStrings(record.allowedImageModelIds) : [...fallback.allowedImageModelIds],
    allowedVideoModelIds: Array.isArray(record.allowedVideoModelIds) ? uniqueStrings(record.allowedVideoModelIds) : [...fallback.allowedVideoModelIds],
  };
}

function sanitizeFirstMonthDiscount(raw: unknown, fallback: MembershipFirstMonthDiscount): MembershipFirstMonthDiscount {
  const record = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  return {
    enabled: typeof record.enabled === "boolean" ? record.enabled : fallback.enabled,
    percent: clampInt(record.percent, fallback.percent, 1, 99),
  };
}

const RETIRED_MEMBERSHIP_VIDEO_MODEL_IDS = new Set([
  "bytedance/seedance-2.0",
  "bytedance/seedance-2.0-fast",
  "kwaivgi/kling-video-o1",
  "google/veo-3.1",
]);

function filterAllowedVideoModelIds(ids: string[], tier: MembershipTier) {
  return ids.filter((id) => {
    if (RETIRED_MEMBERSHIP_VIDEO_MODEL_IDS.has(id)) return false;
    if (tier === "free" && id === "minimax/hailuo-3") return false;
    return true;
  });
}

export function sanitizeMembershipSettings(value: unknown): MembershipSettings {
  const record = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const tiersRaw = record.tiers && typeof record.tiers === "object" && !Array.isArray(record.tiers) ? record.tiers as Record<string, unknown> : {};
  const discountsRaw = record.firstMonthDiscounts && typeof record.firstMonthDiscounts === "object" && !Array.isArray(record.firstMonthDiscounts) ? record.firstMonthDiscounts as Record<string, unknown> : {};
  const free = sanitizeTierConfig(tiersRaw.free, DEFAULT_MEMBERSHIP_SETTINGS.tiers.free);
  const standard = sanitizeTierConfig(tiersRaw.standard, DEFAULT_MEMBERSHIP_SETTINGS.tiers.standard);
  const pro = sanitizeTierConfig(tiersRaw.pro, DEFAULT_MEMBERSHIP_SETTINGS.tiers.pro);
  return {
    tiers: {
      free: { ...free, allowedVideoModelIds: filterAllowedVideoModelIds(free.allowedVideoModelIds, "free") },
      standard: { ...standard, allowedVideoModelIds: filterAllowedVideoModelIds(standard.allowedVideoModelIds, "standard") },
      pro: { ...pro, allowedVideoModelIds: filterAllowedVideoModelIds(pro.allowedVideoModelIds, "pro") },
    },
    firstMonthDiscounts: {
      monthly: sanitizeFirstMonthDiscount(discountsRaw.monthly, DEFAULT_MEMBERSHIP_SETTINGS.firstMonthDiscounts.monthly),
      quarter: sanitizeFirstMonthDiscount(discountsRaw.quarter, DEFAULT_MEMBERSHIP_SETTINGS.firstMonthDiscounts.quarter),
      year: sanitizeFirstMonthDiscount(discountsRaw.year, DEFAULT_MEMBERSHIP_SETTINGS.firstMonthDiscounts.year),
    },
  };
}

function resolveMembershipSettings(settings?: MembershipSettings) {
  return settings ?? DEFAULT_MEMBERSHIP_SETTINGS;
}

export function getMembershipTierConfig(tier: MembershipTier, settings?: MembershipSettings) {
  return resolveMembershipSettings(settings).tiers[tier] ?? DEFAULT_MEMBERSHIP_SETTINGS.tiers.free;
}

export function canMembershipUseGenerationModel(tier: MembershipTier, modelId?: string, settings?: MembershipSettings) {
  if (!modelId || !isImageOrVideoGenerationModel(modelId)) return true;
  if (isGptImageMembershipModel(modelId)) return canMembershipUseImageModel(tier, modelId, settings);
  if (modelId.includes("video") || modelId.includes("seedance") || modelId.includes("kling") || modelId.includes("veo") || modelId.includes("hailuo")) return canMembershipUseVideoModel(tier, modelId, settings);
  return canMembershipUseImageModel(tier, modelId, settings);
}

export function canMembershipUseImageModel(tier: MembershipTier, modelId?: string, settings?: MembershipSettings) {
  if (!MEMBERSHIP_SYSTEM_ENABLED) return true;
  if (!modelId) return true;
  return getMembershipTierConfig(tier, settings).allowedImageModelIds.includes(modelId);
}

export function canMembershipUseVideoModel(tier: MembershipTier, modelId?: string, settings?: MembershipSettings) {
  if (!MEMBERSHIP_SYSTEM_ENABLED) return true;
  if (!modelId) return true;
  return getMembershipTierConfig(tier, settings).allowedVideoModelIds.includes(modelId);
}

export function isPremiumImageResolution(resolution?: string) {
  return resolution === "3K" || resolution === "4K";
}

export function isPremiumVideoResolution(resolution?: string) {
  return resolution === "1080p" || resolution === "2K" || resolution === "4K";
}

export function canMembershipUseImageResolution(tier: MembershipTier, resolution?: string, settings?: MembershipSettings) {
  if (!MEMBERSHIP_SYSTEM_ENABLED) return true;
  if (!resolution || resolution === "智能比例") return true;
  if (!isMembershipImageResolution(resolution) && !isPremiumImageResolution(resolution)) return true;
  return getMembershipTierConfig(tier, settings).imageResolutions.includes(resolution as MembershipImageResolution);
}

export function canMembershipUseVideoResolution(tier: MembershipTier, resolution?: string, settings?: MembershipSettings) {
  if (!MEMBERSHIP_SYSTEM_ENABLED) return true;
  if (!resolution || resolution === "智能比例") return true;
  if (!isMembershipVideoResolution(resolution) && !isPremiumVideoResolution(resolution)) return true;
  return getMembershipTierConfig(tier, settings).videoResolutions.includes(resolution as MembershipVideoResolution);
}

export function filterImageResolutionsForMembership<T extends string>(tier: MembershipTier, resolutions: readonly T[], settings?: MembershipSettings) {
  if (!MEMBERSHIP_SYSTEM_ENABLED) return [...resolutions];
  const allowed = new Set(getMembershipTierConfig(tier, settings).imageResolutions);
  return resolutions.filter((item) => !isMembershipImageResolution(item) && !isPremiumImageResolution(item) ? true : allowed.has(item as MembershipImageResolution));
}

export function filterVideoResolutionsForMembership<T extends string>(tier: MembershipTier, resolutions: readonly T[], settings?: MembershipSettings) {
  if (!MEMBERSHIP_SYSTEM_ENABLED) return [...resolutions];
  const allowed = new Set(getMembershipTierConfig(tier, settings).videoResolutions);
  return resolutions.filter((item) => !isMembershipVideoResolution(item) && !isPremiumVideoResolution(item) ? true : allowed.has(item as MembershipVideoResolution));
}

export function getMembershipConcurrencyLimit(tier: MembershipTier, settings?: MembershipSettings) {
  if (!MEMBERSHIP_SYSTEM_ENABLED) return Number.POSITIVE_INFINITY;
  const concurrency = getMembershipTierConfig(tier, settings).concurrency;
  return concurrency <= 0 ? Number.POSITIVE_INFINITY : concurrency;
}

export function getCreditPackCredits(tier: MembershipTier, cny: number, settings?: MembershipSettings) {
  return Math.max(0, Math.floor(cny) * getMembershipTierConfig(tier, settings).creditsPerCny);
}

export function getFirstMonthDiscount(period: MembershipPeriod, settings?: MembershipSettings) {
  if (!isMembershipFirstMonthDiscountPeriod(period)) return null;
  const discount = resolveMembershipSettings(settings).firstMonthDiscounts[period];
  return discount.enabled ? discount : null;
}

export function formatDiscountFold(percent: number) {
  return `${(percent / 10).toFixed(1).replace(/\.0$/, "")}折`;
}

export function hasUsedMembershipDiscount(usedDiscountPeriods?: readonly string[] | null, tier?: Exclude<MembershipTier, "free">) {
  const used = usedDiscountPeriods ?? [];
  if (tier) return used.includes(tier);
  return used.includes("standard") && used.includes("pro");
}

export function getFirstMonthDiscountLabel(period: MembershipPeriod, settings?: MembershipSettings, usedDiscountPeriods?: readonly string[] | null, tier?: Exclude<MembershipTier, "free">) {
  if (hasUsedMembershipDiscount(usedDiscountPeriods, tier)) return "";
  const discount = getFirstMonthDiscount(period, settings);
  return discount ? `限时${formatDiscountFold(discount.percent)}` : "";
}

export function getDiscountedPriceCny(priceCny: number, period: MembershipPeriod, settings?: MembershipSettings, usedDiscountPeriods?: readonly string[] | null, tier?: Exclude<MembershipTier, "free">) {
  if (hasUsedMembershipDiscount(usedDiscountPeriods, tier)) return priceCny;
  const discount = getFirstMonthDiscount(period, settings);
  if (!discount) return priceCny;
  return Math.round((priceCny * discount.percent) / 10) / 10;
}

export function formatConcurrencyLabel(concurrency: number) {
  return concurrency <= 0 ? "不限" : `${concurrency}条`;
}

/* ============================================================================
 * 会员购买（唯一权威）—— 2026-09-03 用户拍板，⛔ 改前先看这段注释
 *
 * ① **标准和高级一直能买**，付页面上的价，不折天数、不补差价。
 * ② **续费**：同档再买 = 到期日往后加（从当前到期日加，过期了从今天加）。
 * ③ **低升高**：买高级马上切高级；标准剩几天先搁着，高级用完再切回标准。
 *    高级用着再买标准 = 标准天数加到搁着那份上，当前还是高级。
 * ④ **永远先用高级**，高级没了才用标准。
 * ⑤ **首期折按档各 1 次**：标准和高级互不影响。某一档用过一次（月/季/年任选），这一档不再打折；另一档照样有折。
 * ⑥ 积分已到账的不收回。
 * ========================================================================== */

/** 各周期的天数（结算口径，单月/包月都按 30 天，⛔ 别改成自然月，那样每月金额会漂）。 */
export const MEMBERSHIP_PERIOD_DAYS: Record<MembershipPeriod, number> = {
  month: 30,
  monthly: 30,
  quarter: 90,
  year: 365,
};

/** 档位高低。数字越大越高。 */
export const MEMBERSHIP_TIER_RANK: Record<MembershipTier, number> = {
  free: 0,
  standard: 1,
  pro: 2,
};

/** 周期长短。⚠️ 单月与包月**同级**（都是 1 个月），互相之间不算升级也不算降级。 */
export const MEMBERSHIP_PERIOD_RANK: Record<MembershipPeriod, number> = {
  month: 1,
  monthly: 1,
  quarter: 3,
  year: 12,
};

export type MembershipParkedState = {
  tier: Exclude<MembershipTier, "free">;
  period: MembershipPeriod;
  remainingDays: number;
  paidCny: number;
};

export type MembershipCurrentState = {
  tier: MembershipTier;
  period?: MembershipPeriod | null;
  expiresAt?: Date | string | null;
  paidCny?: number | null;
  /**
   * ⭐ 已经用过首期折的档：`standard` / `pro`。按档各一次，互不影响。
   */
  usedDiscountPeriods?: readonly string[] | null;
  parked?: MembershipParkedState | null;
};

export type MembershipPurchaseKind = "new" | "renew" | "activate_higher" | "park_lower";

export type MembershipUpgradeQuote = {
  allowed: boolean;
  kind: MembershipPurchaseKind | "blocked";
  blockedReason: "" | "current" | "included" | "downgrade";
  listPriceCny: number;
  payableBeforeCreditCny: number;
  remainingValueCny: number;
  payCny: number;
  remainingDays: number;
  bonusCredits: number;
  newExpiresAt: Date;
  discountApplied: boolean;
  /** 买完后当前在用的档。 */
  activeTier: Exclude<MembershipTier, "free">;
  activePeriod: MembershipPeriod;
  /** 买完后搁着的低档；没有就是 null。 */
  parked: MembershipParkedState | null;
};

function toValidDate(value?: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function roundCny(value: number) {
  return Math.round(value * 100) / 100;
}

/** 旧套餐还剩几天（不足一天算一天；已过期算 0）。 */
export function getMembershipRemainingDays(current: MembershipCurrentState, now = new Date()) {
  const expiresAt = toValidDate(current.expiresAt);
  if (!expiresAt) return 0;
  const ms = expiresAt.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.min(Math.ceil(ms / 86_400_000), MEMBERSHIP_PERIOD_DAYS.year);
}

/**
 * 旧套餐剩余价值。新方案不再用来抵扣，留给后台展示。
 */
export function getMembershipRemainingValueCny(current: MembershipCurrentState, settings?: MembershipSettings, now = new Date()) {
  if (current.tier === "free") return 0;
  const period = isMembershipPeriod(current.period) ? current.period : null;
  if (!period) return 0;
  const remainingDays = getMembershipRemainingDays(current, now);
  if (remainingDays <= 0) return 0;
  const listPrice = getMembershipPlan(current.tier, period, settings).priceCny;
  const minPlausiblePaid = Math.min(listPrice, getDiscountedPriceCny(listPrice, period, settings, undefined, current.tier === "standard" || current.tier === "pro" ? current.tier : undefined));
  const paid = typeof current.paidCny === "number" && current.paidCny > 0 ? Math.min(current.paidCny, listPrice) : minPlausiblePaid;
  const totalDays = MEMBERSHIP_PERIOD_DAYS[period];
  return roundCny(Math.min(paid, (paid * remainingDays) / totalDays));
}

export function canUpgradeMembership(
  current: { tier: MembershipTier; period?: MembershipPeriod | null },
  target: { tier: Exclude<MembershipTier, "free">; period: MembershipPeriod },
) {
  return MEMBERSHIP_TIER_RANK[target.tier] >= MEMBERSHIP_TIER_RANK[current.tier];
}

/** 这一档还没用过首期折。月/季/年共用这一次，标准和高级分开算。 */
export function canUseFirstPeriodDiscount(period: MembershipPeriod, current: Pick<MembershipCurrentState, "usedDiscountPeriods"> | undefined, settings: MembershipSettings | undefined, tier: Exclude<MembershipTier, "free">) {
  if (!getFirstMonthDiscount(period, settings)) return false;
  return !hasUsedMembershipDiscount(current?.usedDiscountPeriods, tier);
}

function addPeriodDays(from: Date, period: MembershipPeriod) {
  return new Date(from.getTime() + MEMBERSHIP_PERIOD_DAYS[period] * 86_400_000);
}

function laterDate(a: Date, b: Date) {
  return a.getTime() > b.getTime() ? a : b;
}

function sanitizeParked(parked?: MembershipParkedState | null): MembershipParkedState | null {
  if (!parked) return null;
  if (parked.tier !== "standard" && parked.tier !== "pro") return null;
  if (!isMembershipPeriod(parked.period)) return null;
  if (parked.remainingDays <= 0) return null;
  return {
    tier: parked.tier,
    period: parked.period,
    remainingDays: Math.max(0, Math.floor(parked.remainingDays)),
    paidCny: Math.max(0, parked.paidCny),
  };
}

/**
 * 算一次购买要付多少钱、新到期时间、买完后哪档在用 / 哪档搁着。
 * ⭐ 前端按钮文案和后端真扣款都必须走这一个函数，别各算一份。
 */
export function getMembershipUpgradeQuote(
  current: MembershipCurrentState,
  target: { tier: Exclude<MembershipTier, "free">; period: MembershipPeriod },
  settings?: MembershipSettings,
  now = new Date(),
): MembershipUpgradeQuote {
  const listPriceCny = getMembershipPlan(target.tier, target.period, settings).priceCny;
  const remainingDays = getMembershipRemainingDays(current, now);
  const liveTier = remainingDays > 0 ? current.tier : "free";
  const livePeriod = isMembershipPeriod(current.period) ? current.period : null;
  const parked = sanitizeParked(current.parked);
  const discountUsable = canUseFirstPeriodDiscount(target.period, current, settings, target.tier);
  const payableBeforeCreditCny = discountUsable ? getDiscountedPriceCny(listPriceCny, target.period, settings, current.usedDiscountPeriods, target.tier) : listPriceCny;
  const payCny = roundCny(payableBeforeCreditCny);
  const targetDays = MEMBERSHIP_PERIOD_DAYS[target.period];

  const ok = (
    kind: MembershipPurchaseKind,
    activeTier: Exclude<MembershipTier, "free">,
    activePeriod: MembershipPeriod,
    newExpiresAt: Date,
    nextParked: MembershipParkedState | null,
  ): MembershipUpgradeQuote => ({
    allowed: true,
    kind,
    blockedReason: "",
    listPriceCny,
    payableBeforeCreditCny,
    remainingValueCny: 0,
    payCny,
    remainingDays,
    bonusCredits: 0,
    newExpiresAt,
    discountApplied: discountUsable,
    activeTier,
    activePeriod,
    parked: nextParked,
  });

  if (liveTier === "free") {
    if (parked && MEMBERSHIP_TIER_RANK[target.tier] > MEMBERSHIP_TIER_RANK[parked.tier]) {
      return ok("activate_higher", target.tier, target.period, addPeriodDays(now, target.period), parked);
    }
    if (parked && parked.tier === target.tier) {
      const from = new Date(now.getTime() + parked.remainingDays * 86_400_000);
      return ok("renew", target.tier, target.period, addPeriodDays(from, target.period), null);
    }
    return ok("new", target.tier, target.period, addPeriodDays(now, target.period), parked);
  }

  if (liveTier === target.tier) {
    const expiresAt = toValidDate(current.expiresAt) ?? now;
    return ok("renew", target.tier, target.period, addPeriodDays(laterDate(expiresAt, now), target.period), parked);
  }

  if (MEMBERSHIP_TIER_RANK[target.tier] > MEMBERSHIP_TIER_RANK[liveTier]) {
    const parkedDays = parked && parked.tier === "standard" ? parked.remainingDays : 0;
    return ok("activate_higher", target.tier, target.period, addPeriodDays(now, target.period), {
      tier: "standard",
      period: livePeriod ?? parked?.period ?? "month",
      remainingDays: parkedDays + remainingDays,
      paidCny: parked && parked.tier === "standard"
        ? parked.paidCny
        : (typeof current.paidCny === "number" ? Math.max(0, current.paidCny) : 0),
    });
  }

  const liveExpiresAt = toValidDate(current.expiresAt) ?? addPeriodDays(now, livePeriod ?? target.period);
  return ok("park_lower", "pro", livePeriod ?? "month", liveExpiresAt, {
    tier: "standard",
    period: target.period,
    remainingDays: (parked && parked.tier === "standard" ? parked.remainingDays : 0) + targetDays,
    paidCny: parked && parked.tier === "standard" ? parked.paidCny : 0,
  });
}

export function formatMembershipPriceCny(value: number) {
  const fixed = Math.round(value * 100) / 100;
  return Number.isInteger(fixed) ? `¥${fixed.toLocaleString("en-US")}` : `¥${fixed.toFixed(2)}`;
}

export function formatResolutionList(values: string[]) {
  return values.length > 0 ? values.join(" / ") : "—";
}

export function getMembershipCompareRows(settings?: MembershipSettings) {
  const resolved = resolveMembershipSettings(settings);
  const free = resolved.tiers.free;
  const standard = resolved.tiers.standard;
  const pro = resolved.tiers.pro;
  const mark = (ok: boolean) => (ok ? "✓" : "—");
  const bananaId = "google/gemini-3-pro-image-preview";
  const gptImageId = "openai/gpt-5.4-image-2";
  const seedance20Id = "byteplus:video.seedance-2-0";
  const seedance25Id = "byteplus:video.seedance-2-5";
  const seedreamProId = "byteplus:conversation-image.seedream-5-0-pro";
  const concurrencyText = (value: number) => (value <= 0 ? "无上限" : `${value} 条`);
  return [
    { group: "积分", label: "积分按10元购买", free: `${free.creditsPerCny * 10}积分`, standard: `${standard.creditsPerCny * 10}积分 · 7折`, pro: `${pro.creditsPerCny * 10}积分 · 6折` },
    { group: "积分", label: "订阅会员积分", free: free.monthlyCredits > 0 ? `每月${free.monthlyCredits}积分` : "—", standard: `每月${standard.monthlyCredits}积分`, pro: `每月${pro.monthlyCredits}积分` },
    { group: "功能", label: "Agent/图片/视频/语音", free: "✓", standard: "✓", pro: "✓" },
    { group: "模型", label: "Seedream 5.0 Pro", free: mark(free.allowedImageModelIds.includes(seedreamProId)), standard: mark(standard.allowedImageModelIds.includes(seedreamProId)), pro: mark(pro.allowedImageModelIds.includes(seedreamProId)) },
    { group: "模型", label: "Seedance 2.0", free: mark(free.allowedVideoModelIds.includes(seedance20Id)), standard: mark(standard.allowedVideoModelIds.includes(seedance20Id)), pro: mark(pro.allowedVideoModelIds.includes(seedance20Id)) },
    { group: "模型", label: "大香蕉图片3.0 pro", free: mark(free.allowedImageModelIds.includes(bananaId)), standard: mark(standard.allowedImageModelIds.includes(bananaId)), pro: mark(pro.allowedImageModelIds.includes(bananaId)) },
    { group: "模型", label: "GPT 图片5.4", free: mark(free.allowedImageModelIds.includes(gptImageId)), standard: mark(standard.allowedImageModelIds.includes(gptImageId)), pro: mark(pro.allowedImageModelIds.includes(gptImageId)) },
    { group: "模型", label: "Seedance 2.5", free: mark(free.allowedVideoModelIds.includes(seedance25Id)), standard: mark(standard.allowedVideoModelIds.includes(seedance25Id)), pro: mark(pro.allowedVideoModelIds.includes(seedance25Id)) },
    { group: "通道", label: "生成通道", free: "标准", standard: "快速", pro: "极速" },
    { group: "通道", label: "同时生成", free: concurrencyText(free.concurrency), standard: concurrencyText(standard.concurrency), pro: concurrencyText(pro.concurrency) },
  ];
}
