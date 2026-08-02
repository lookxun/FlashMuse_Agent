import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CreditKind = "text" | "image" | "video";
export type CreditGrantKind = "signup" | "admin_adjust" | "recharge" | "activity";

export type UsageLike = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  usd?: number;
};

export type CreditChargeResult = {
  chargedCredits: number;
  expectedCredits: number;
  chargedCny: number;
  chargedUsd: number;
  balance?: number;
  skipped: boolean;
};

export type CreditContext = {
  conversationId?: string;
  conversationTitle?: string;
  workspaceKind?: string;
  workspaceId?: string;
  requestId?: string;
  label?: string;
  model?: string;
  imageCount?: number;
  videoCount?: number;
  metadata?: Prisma.InputJsonValue;
};

const defaultSettings = {
  usdToCnyRate: 7.2,
  creditsPerCny: 10,
  signupCredits: 0,
  chargeText: true,
  chargeImage: true,
  chargeVideo: true,
  chargePromptTool: true,
};

const MIN_USD_TO_CNY_RATE = 1;
const MAX_USD_TO_CNY_RATE = 20;
const VALID_CREDITS_PER_CNY = [10, 100, 1000, 10000] as const;

export async function getCreditSettings() {
  return prisma.creditSetting.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", ...defaultSettings },
  });
}

export async function updateCreditSettings(input: Partial<typeof defaultSettings>) {
  const current = await prisma.creditSetting.findUnique({ where: { id: "default" } });
  const inputUsdToCnyRate = typeof input.usdToCnyRate === "number" && Number.isFinite(input.usdToCnyRate) ? input.usdToCnyRate : NaN;
  const inputCreditsPerCny = typeof input.creditsPerCny === "number" && Number.isFinite(input.creditsPerCny) ? Math.floor(input.creditsPerCny) : NaN;
  const nextCreditsPerCny = VALID_CREDITS_PER_CNY.includes(inputCreditsPerCny as (typeof VALID_CREDITS_PER_CNY)[number]) ? inputCreditsPerCny : current?.creditsPerCny ?? defaultSettings.creditsPerCny;
  const inputSignupCredits = typeof input.signupCredits === "number" && Number.isFinite(input.signupCredits) ? Math.floor(input.signupCredits) : NaN;
  const maxSignupCredits = nextCreditsPerCny * 200;
  const fallbackSignupCredits = current && current.signupCredits <= maxSignupCredits ? current.signupCredits : Math.min(defaultSettings.signupCredits, maxSignupCredits);
  const data = {
    usdToCnyRate: inputUsdToCnyRate >= MIN_USD_TO_CNY_RATE && inputUsdToCnyRate <= MAX_USD_TO_CNY_RATE ? inputUsdToCnyRate : current?.usdToCnyRate ?? defaultSettings.usdToCnyRate,
    creditsPerCny: nextCreditsPerCny,
    signupCredits: inputSignupCredits >= 0 && inputSignupCredits <= maxSignupCredits ? inputSignupCredits : fallbackSignupCredits,
    chargeText: typeof input.chargeText === "boolean" ? input.chargeText : current?.chargeText ?? defaultSettings.chargeText,
    chargeImage: typeof input.chargeImage === "boolean" ? input.chargeImage : current?.chargeImage ?? defaultSettings.chargeImage,
    chargeVideo: typeof input.chargeVideo === "boolean" ? input.chargeVideo : current?.chargeVideo ?? defaultSettings.chargeVideo,
    chargePromptTool: typeof input.chargePromptTool === "boolean" ? input.chargePromptTool : current?.chargePromptTool ?? defaultSettings.chargePromptTool,
  };

  return prisma.creditSetting.upsert({
    where: { id: "default" },
    update: data,
    create: { id: "default", ...data },
  });
}

function getMetadataRecord(metadata: Prisma.InputJsonValue | undefined) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata as Record<string, unknown> : undefined;
}

function isPromptToolCreditSource(value: unknown) {
  return value === "image_prompt_reverse" || value === "prompt_optimization";
}

function getWorkspaceKindFromContext(context: CreditContext) {
  if (context.workspaceKind) return context.workspaceKind;
  const source = getMetadataRecord(context.metadata)?.creditSource;
  if (typeof source === "string" && source.startsWith("workflow_")) return "workflow";
  return context.conversationId ? "conversation" : undefined;
}

function getWorkspaceIdFromContext(context: CreditContext) {
  return context.workspaceId || context.conversationId;
}

function mergeCreditMetadata(metadata: Prisma.InputJsonValue | undefined, extra: Prisma.InputJsonObject): Prisma.InputJsonValue {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? { ...metadata, ...extra } : extra;
}

export function getChargeEnabled(settings: Awaited<ReturnType<typeof getCreditSettings>>, kind: CreditKind, metadata?: Prisma.InputJsonValue) {
  if (isPromptToolCreditSource(getMetadataRecord(metadata)?.creditSource)) return settings.chargePromptTool;
  if (kind === "image") return settings.chargeImage;
  if (kind === "video") return settings.chargeVideo;
  return settings.chargeText;
}

/**
 * ⭐「登录状态已失效」唯一权威（2026-07-28 加）
 *
 * 为什么要单独立一类：本项目是**单会话策略**（`createSession` 每次登录会删掉该用户所有旧会话），
 * 所以用户在另一台设备登录后，旧页面手里的 cookie 就作废了，但页面自己不知道（头像/积分都还在）。
 * 这时点生成，服务端查不到会话 → 抛这个错。
 *
 * ⛔ 历史 bug（正式服 17 条红字）：这个错以前是普通 Error，掉进各 route 的**通用 catch** →
 * 被当成"生成失败"记进 GenerationEvent 且**返回 500**。而前端所有"未登录自动跳首页"的保护
 * （chat-workbench 里 5 处）都只认 **401** → 全部不触发 → 用户看到红字、连点 3~5 次。
 *
 * 所以：**必须返回 401，且不记 GenerationEvent**（这不是生成失败）。前端收到 401 会直接
 * `window.location.replace("/")` 跳首页，不弹任何提示 —— 这是既有设计，无需额外文案。
 */
export const UNAUTHENTICATED_ERROR_MESSAGE = "登录状态已失效，请重新登录后再试。";
const UNAUTHENTICATED_ERROR_CODE = "UNAUTHENTICATED";

export function createUnauthenticatedError() {
  const error = new Error(UNAUTHENTICATED_ERROR_MESSAGE);
  (error as Error & { code?: string }).code = UNAUTHENTICATED_ERROR_CODE;
  return error;
}

/** 各 route 的 catch 里第一句就判它：命中 → 回 401 + 不记失败事件。 */
export function isUnauthenticatedError(value: unknown): boolean {
  return value instanceof Error && (value as Error & { code?: string }).code === UNAUTHENTICATED_ERROR_CODE;
}

export async function assertUserCanUseCredits(user: { credits?: number | null } | null, kind: CreditKind, metadata?: Prisma.InputJsonValue) {
  if (!user) throw createUnauthenticatedError();

  const settings = await getCreditSettings();
  if (getChargeEnabled(settings, kind, metadata) && (user.credits ?? 0) <= 0) throw new Error("积分不足，请充值后再使用模型。");
}

function cleanNumber(value: unknown) {
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function getExpectedCredits(kind: CreditKind, shouldCharge: boolean, rawCredits: number) {
  if (!shouldCharge || rawCredits <= 0) return 0;
  return kind === "text" ? Math.floor(rawCredits) : Math.max(1, Math.round(rawCredits));
}

export async function chargeCredits(userId: string, kind: CreditKind, usage?: UsageLike, context: CreditContext = {}) {
  const settings = await getCreditSettings();
  const usd = Math.max(0, cleanNumber(usage?.usd));
  const cny = usd * settings.usdToCnyRate;
  const shouldCharge = getChargeEnabled(settings, kind, context.metadata);
  const rawCredits = cny * settings.creditsPerCny;
  const immediateExpectedCredits = getExpectedCredits(kind, shouldCharge, rawCredits);
  const promptTokens = Math.max(0, Math.floor(cleanNumber(usage?.promptTokens)));
  const completionTokens = Math.max(0, Math.floor(cleanNumber(usage?.completionTokens)));
  const totalTokens = Math.max(0, Math.floor(cleanNumber(usage?.totalTokens) || promptTokens + completionTokens));
  const workspaceKind = getWorkspaceKindFromContext(context);
  const workspaceId = getWorkspaceIdFromContext(context);

  if (context.requestId) {
    const existing = await prisma.creditLedger.findUnique({ where: { requestId_kind: { requestId: context.requestId, kind } } }).catch(() => null);
    if (existing) return { chargedCredits: 0, expectedCredits: 0, chargedCny: 0, chargedUsd: 0, balance: undefined, skipped: true } satisfies CreditChargeResult;
  }

  return prisma.$transaction(async (tx) => {
    // ⭐ 并发安全（2026-08-02 审计 1.1）：SELECT ... FOR UPDATE 把"读余额 → 算 → 写"在行锁里串行化，
    //   且扣费用相对 decrement。旧写法是 tx 内 findUnique + 写绝对值 —— Postgres READ COMMITTED 下
    //   两个并发扣费都读到 credits=100、都写 90 → 少扣一次，静默漏收（textCreditRemainder 同病）。
    const lockedRows = await tx.$queryRaw<Array<{ credits: number; textCreditRemainder: number }>>`
      SELECT credits, "textCreditRemainder" FROM "User" WHERE id = ${userId} FOR UPDATE
    `;
    const user = lockedRows[0];
    if (!user) return { chargedCredits: 0, expectedCredits: 0, chargedCny: 0, chargedUsd: 0, balance: undefined, skipped: true } satisfies CreditChargeResult;

    const previousTextCreditRemainder = Math.max(0, cleanNumber(user.textCreditRemainder));
    const nextTextCreditRemainderRaw = kind === "text" && shouldCharge && rawCredits > 0 ? previousTextCreditRemainder + rawCredits : previousTextCreditRemainder;
    const textExpectedCredits = kind === "text" && shouldCharge ? Math.floor(nextTextCreditRemainderRaw + 1e-9) : 0;
    const nextTextCreditRemainder = kind === "text" && shouldCharge && rawCredits > 0 ? Math.max(0, nextTextCreditRemainderRaw - textExpectedCredits) : previousTextCreditRemainder;
    const expectedCredits = kind === "text" ? textExpectedCredits : immediateExpectedCredits;
    const chargedCredits = Math.min(user.credits, expectedCredits);
    const chargedCny = settings.creditsPerCny > 0 ? chargedCredits / settings.creditsPerCny : 0;
    const chargedUsd = settings.usdToCnyRate > 0 ? chargedCny / settings.usdToCnyRate : 0;

    let nextCredits = user.credits;
    if (chargedCredits > 0 || (kind === "text" && shouldCharge && rawCredits > 0)) {
      const updatedRows = await tx.$queryRaw<Array<{ credits: number }>>`
        UPDATE "User"
        SET credits = credits - ${chargedCredits},
            "textCreditRemainder" = ${kind === "text" && shouldCharge && rawCredits > 0 ? nextTextCreditRemainder : previousTextCreditRemainder}
        WHERE id = ${userId}
        RETURNING credits
      `;
      nextCredits = updatedRows[0]?.credits ?? Math.max(0, user.credits - chargedCredits);
    }

    await tx.creditLedger.create({
      data: {
        userId,
        conversationId: context.conversationId,
        conversationTitle: context.conversationTitle,
        workspaceKind,
        workspaceId,
        requestId: context.requestId,
        direction: "consume",
        kind,
        label: context.label,
        model: context.model,
        credits: chargedCredits,
        promptTokens,
        completionTokens,
        totalTokens,
        usd,
        cny,
        imageCount: Math.max(0, Math.floor(context.imageCount ?? 0)),
        videoCount: Math.max(0, Math.floor(context.videoCount ?? 0)),
        metadata: mergeCreditMetadata(shouldCharge ? context.metadata : mergeCreditMetadata(context.metadata, { creditChargeDisabled: true }) as Prisma.InputJsonValue, {
          expectedCredits,
          chargedCredits,
          chargedCny,
          chargedUsd,
          rawCredits,
          ...(kind === "text" ? {
            textCreditRemainderBefore: previousTextCreditRemainder,
            textCreditRemainderAfter: nextTextCreditRemainder,
          } : {}),
          usdToCnyRate: settings.usdToCnyRate,
          creditsPerCny: settings.creditsPerCny,
        }),
      },
    });

    return { chargedCredits, expectedCredits, chargedCny, chargedUsd, balance: nextCredits, skipped: false } satisfies CreditChargeResult;
  });
}

export async function recordCreditFailure(userId: string, kind: CreditKind, context: CreditContext = {}) {
  if (context.requestId) {
    const existing = await prisma.creditLedger.findUnique({ where: { requestId_kind: { requestId: context.requestId, kind } } }).catch(() => null);
    if (existing) return { skipped: true };
  }

  await prisma.creditLedger.create({
    data: {
      userId,
      conversationId: context.conversationId,
      conversationTitle: context.conversationTitle,
      workspaceKind: getWorkspaceKindFromContext(context),
      workspaceId: getWorkspaceIdFromContext(context),
      requestId: context.requestId,
      direction: "consume",
      kind,
      label: context.label,
      model: context.model,
      credits: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      usd: 0,
      cny: 0,
      imageCount: Math.max(0, Math.floor(context.imageCount ?? 0)),
      videoCount: Math.max(0, Math.floor(context.videoCount ?? 0)),
      metadata: context.metadata,
    },
  });

  return { skipped: false };
}

export async function grantCredits(userId: string, credits: number, kind: CreditGrantKind, context: CreditContext = {}) {
  const grantedCredits = Math.max(0, Math.floor(cleanNumber(credits)));
  if (grantedCredits <= 0) return { grantedCredits: 0, balance: undefined, skipped: true };

  if (context.requestId) {
    const existing = await prisma.creditLedger.findUnique({ where: { requestId_kind: { requestId: context.requestId, kind } } }).catch(() => null);
    if (existing) return { grantedCredits: 0, balance: undefined, skipped: true };
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id: userId }, data: { credits: { increment: grantedCredits } }, select: { credits: true } }).catch(() => null);
    if (!user) return { grantedCredits: 0, balance: undefined, skipped: true };

    await tx.creditLedger.create({
      data: {
        userId,
        conversationId: context.conversationId,
        conversationTitle: context.conversationTitle,
        workspaceKind: getWorkspaceKindFromContext(context),
        workspaceId: getWorkspaceIdFromContext(context),
        requestId: context.requestId,
        direction: "increase",
        kind,
        label: context.label,
        model: context.model,
        credits: grantedCredits,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        usd: 0,
        cny: 0,
        imageCount: 0,
        videoCount: 0,
        metadata: context.metadata,
      },
    });

    return { grantedCredits, balance: user.credits, skipped: false };
  });
}
