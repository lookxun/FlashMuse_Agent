import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isCreditPackIndex, sanitizeCreditPacks } from "@/lib/membership";
import { getCreditPackSettings } from "@/lib/system-settings";
import { alipayPrecreate, alipayQuery, getAlipayNotifyUrl, isAlipayConfigured } from "@/lib/alipay";
import { appendPaymentLog } from "@/lib/payment-log";
import { formatBeijingStamp } from "@/lib/beijing-time";
import { formatMembershipDateTime, type CreditChargePayStatus, type CreditChargeRecord } from "@/lib/membership-purchase-records";

export const PAYMENT_ORDER_EXPIRE_MS = 15 * 60 * 1000;

/**
 * 订单号格式（唯一权威）：`C` + 14 位时间戳 + 6 位随机数。
 * ⭐ 下单接口、查单接口、异步通知**都用这个正则做入参校验** ——
 *   ⛔ 别在别处再手抄一份（改了随机位数就会有一处对不上，通知直接被 400 挡掉）。
 */
export const PAYMENT_ORDER_NO_PATTERN = /^C\d{14,24}$/;

function getLiveCreditPacks() {
  return sanitizeCreditPacks(getCreditPackSettings());
}

export function createPaymentOrderNo() {
  const stamp = formatBeijingStamp();
  // ⭐ 用 crypto 的 6 位随机数（原来是 Math.random 的 4 位）：同一秒内撞号概率 1/10^6。
  //   撞了会被 `orderNo @unique` 挡住 → 用户看到"下单失败"，不会串到别人的单上。
  const rand = randomInt(0, 1_000_000).toString().padStart(6, "0");
  return `C${stamp}${rand}`;
}

/**
 * 实付金额校验。⭐ 只拒「少付」，不拒「多付」：
 *   订单码是我们 precreate 时把金额写死的，付款人改不了 → 多付在现实中不会发生；
 *   但万一上游给了个略大的数（对账/币种精度），拒掉就成了"钱收了不加分"，那比多收一分钱严重得多。
 */
export function isPaidAmountEnough(orderPayCny: number, paidAmount: string) {
  const paid = Number(paidAmount);
  if (!Number.isFinite(paid)) return false;
  return paid + 0.009 >= orderPayCny;
}

export async function createAlipayCreditOrder(userId: string, packIndex: number) {
  if (!isCreditPackIndex(packIndex)) throw new Error("无效的充值档位");
  const notifyUrl = getAlipayNotifyUrl();
  if (!notifyUrl) throw new Error("支付宝回调地址未配置");
  const pack = getLiveCreditPacks()[packIndex];
  if (!pack) throw new Error("无效的充值档位");
  // ⛔⛔ 金额和积分**只能来自服务端设置**（后台「积分设置」→ env `CREDIT_PACK_SETTINGS`）。
  //   接口只收档位下标，前端传什么金额都不看。加分认的是这里写进订单行的 `credits`，
  //   ⛔ 不回头用"当前设置"复算（否则管理员改一次价，已付的老单就对不上了）。
  const payCny = pack.payCny;
  const credits = pack.credits;
  if (credits <= 0 || payCny <= 0) throw new Error("积分档位无效");
  const packCny = Math.max(1, Math.round(payCny));
  const orderNo = createPaymentOrderNo();
  const subject = `闪念积分充值 ${credits}`;
  await prisma.paymentOrder.create({
    data: {
      orderNo,
      userId,
      channel: "alipay",
      kind: "credit_pack",
      status: "pending",
      packCny,
      payCny,
      credits,
      subject,
    },
  });
  try {
    const qrCode = await alipayPrecreate({ orderNo, payCny, subject, notifyUrl });
    const order = await prisma.paymentOrder.update({ where: { orderNo }, data: { qrCode } });
    void appendPaymentLog("order-created", { orderNo, userId, packIndex, payCny, credits });
    return order;
  } catch (error) {
    await prisma.paymentOrder.update({
      where: { orderNo },
      data: { status: "closed", closedAt: new Date() },
    }).catch(() => undefined);
    void appendPaymentLog("order-create-failed", {
      orderNo,
      userId,
      packIndex,
      payCny,
      credits,
      reason: error instanceof Error ? error.message.slice(0, 200) : "unknown",
    });
    throw error;
  }
}

type PaymentOrderRow = {
  id: string;
  orderNo: string;
  userId: string;
  status: string;
  packCny: number;
  payCny: number;
  credits: number;
};

type FulfillCreditOrderResult =
  | { ok: true; already: boolean; order: PaymentOrderRow; balance?: number }
  | { ok: false; reason: "missing" | "closed" }
  | { ok: false; reason: "amount"; order: PaymentOrderRow; paidAmount: string };

/**
 * 把一笔**已确认收到钱**的订单落成积分。
 *
 * ⭐ 三道幂等保险（缺一不可）：
 *   ① `SELECT ... FOR UPDATE` 行锁 —— 异步通知和前端轮询同时到达时按订单串行化；
 *   ② 订单 `status === "paid"` 直接返回；
 *   ③ `CreditLedger` 的 `@@unique([requestId, kind])`（requestId = 订单号，kind = "recharge"）——
 *      就算上面两道都被绕过，数据库也会把第二次插入打回来、整个事务回滚。
 *
 * ⭐ 允许 `status === "closed"` 的单继续加分：本地 15 分钟窗口只是**界面上的**过期，
 *   支付宝那边的订单还可能被付掉。⛔ 如果这里拒掉 closed，就会出现"用户真付了钱、
 *   我们收了、但一分积分都不给、还静默返回 success 让支付宝别再重试" —— 那是最严重的事故。
 *
 * ⛔ 调用方必须先确认"钱真的到了"（唯一权威 = 我方发起的 `alipayQuery`，或验签通过的通知报文）。
 */
export async function fulfillPaidCreditOrder(params: {
  orderNo: string;
  tradeNo?: string;
  totalAmount?: string;
  notifyPayload?: Record<string, unknown>;
  source?: string;
}): Promise<FulfillCreditOrderResult> {
  const result = await prisma.$transaction(async (tx): Promise<FulfillCreditOrderResult> => {
    const rows = await tx.$queryRaw<Array<PaymentOrderRow>>`
      SELECT "id", "orderNo", "userId", "status", "packCny", "payCny", "credits"
      FROM "PaymentOrder"
      WHERE "orderNo" = ${params.orderNo} AND "kind" = 'credit_pack'
      FOR UPDATE
    `;
    const order = rows[0];
    if (!order) return { ok: false, reason: "missing" };
    if (order.status === "paid") return { ok: true, already: true, order };
    if (order.status !== "pending" && order.status !== "closed") return { ok: false, reason: "closed" };
    if (params.totalAmount && !isPaidAmountEnough(order.payCny, params.totalAmount)) {
      return { ok: false, reason: "amount", order, paidAmount: params.totalAmount };
    }

    const existingLedger = await tx.creditLedger.findUnique({
      where: { requestId_kind: { requestId: order.orderNo, kind: "recharge" } },
    }).catch(() => null);
    if (!existingLedger) {
      await tx.user.update({
        where: { id: order.userId },
        data: { credits: { increment: order.credits } },
      });
      await tx.creditLedger.create({
        data: {
          userId: order.userId,
          requestId: order.orderNo,
          direction: "increase",
          kind: "recharge",
          label: "充值积分",
          credits: order.credits,
          cny: order.payCny,
          metadata: {
            channel: "alipay",
            packCny: order.packCny,
            payCny: order.payCny,
            orderNo: order.orderNo,
            tradeNo: params.tradeNo ?? "",
          },
        },
      });
    }

    const updated = await tx.user.findUnique({ where: { id: order.userId }, select: { credits: true } });
    await tx.paymentOrder.update({
      where: { orderNo: order.orderNo },
      data: {
        status: "paid",
        alipayTradeNo: params.tradeNo || undefined,
        paidAt: new Date(),
        creditedAt: new Date(),
        notifyPayload: params.notifyPayload as object | undefined,
      },
    });
    return { ok: true, already: Boolean(existingLedger), order, balance: updated?.credits };
  });

  if (result.ok && !result.already) {
    void appendPaymentLog("order-credited", {
      orderNo: params.orderNo,
      userId: result.order.userId,
      credits: result.order.credits,
      payCny: result.order.payCny,
      tradeNo: params.tradeNo ?? "",
      balance: result.balance,
      source: params.source ?? "",
    });
  } else if (result.ok) {
    void appendPaymentLog("order-credit-duplicated", { orderNo: params.orderNo, source: params.source ?? "" });
  } else if (result.reason === "amount") {
    void appendPaymentLog("order-amount-mismatch", {
      orderNo: params.orderNo,
      expectPayCny: result.order.payCny,
      paidAmount: result.paidAmount,
      source: params.source ?? "",
    });
  }

  return result;
}

async function closeCreditOrder(orderNo: string, tradeNo?: string, reason?: string) {
  void appendPaymentLog("order-closed", { orderNo, reason: reason ?? "" });
  return prisma.paymentOrder.update({
    where: { orderNo },
    data: { status: "closed", closedAt: new Date(), alipayTradeNo: tradeNo || undefined },
  });
}

/**
 * 跟支付宝对齐一笔订单的状态（前端轮询 / 异步通知 / 打开充值页时的补单都走它）。
 *
 * ⭐ 顺序很重要：**先去支付宝查单，确认没付成功之后才敢把本地订单标成 closed**。
 *   ⛔ 原来是"本地超过 15 分钟就先关单再查"，那一步会把"14:59 付的、15:01 才轮询到"的单
 *   直接关掉（关掉之后 `fulfillPaidCreditOrder` 又拒 closed）→ 钱收了不加分。
 *   现在两头都堵：先查再关 + closed 仍可补加分。
 *
 * @param userId 传了就做归属校验（前端查单必须传，⛔ 否则任何登录用户都能查别人的订单）
 * @param options.allowRemote false = 被节流，只读库不打支付宝（防止有人高频轮询把我们的查单额度打满）
 */
export async function syncAlipayCreditOrder(orderNo: string, userId?: string, options?: { allowRemote?: boolean }) {
  const order = await prisma.paymentOrder.findUnique({ where: { orderNo } });
  if (!order) return null;
  if (userId && order.userId !== userId) return null;
  if (order.kind !== "credit_pack") return order;
  if (order.status === "paid") return order;
  // 只有 pending / closed 值得再去支付宝确认（closed 也要——本地窗口关掉后用户仍可能付款）
  if (order.status !== "pending" && order.status !== "closed") return order;

  const expired = order.status === "pending" && Date.now() - order.createdAt.getTime() > PAYMENT_ORDER_EXPIRE_MS;
  if (options?.allowRemote === false) {
    return expired ? closeCreditOrder(orderNo, undefined, "expired-throttled") : order;
  }

  let queried: Awaited<ReturnType<typeof alipayQuery>> | null = null;
  try {
    queried = await alipayQuery(orderNo);
  } catch {
    // 交易不存在（没扫码）和网络失败都会走这里 —— ⛔ 不能当成"确认没付钱"的证据
    queried = null;
  }

  if (queried && (queried.tradeStatus === "TRADE_SUCCESS" || queried.tradeStatus === "TRADE_FINISHED")) {
    await fulfillPaidCreditOrder({
      orderNo,
      tradeNo: queried.tradeNo,
      totalAmount: queried.totalAmount,
      notifyPayload: queried.raw,
      source: "query",
    });
    return prisma.paymentOrder.findUnique({ where: { orderNo } });
  }

  if (order.status === "pending" && (queried?.tradeStatus === "TRADE_CLOSED" || expired)) {
    return closeCreditOrder(orderNo, queried?.tradeNo, queried?.tradeStatus === "TRADE_CLOSED" ? "alipay-closed" : "expired");
  }
  return order;
}

/**
 * 补单：把这个用户最近 24 小时内「还没付成功、但支付宝那边确实建了订单」的单再对一次。
 *
 * ⭐ 为什么需要：异步通知可能丢（地址配错 / 网关不通 / 我们那几秒在重启），
 *   而前端轮询只在充值弹层开着且状态还是 pending 时才跑。没有这一步，
 *   「用户付了钱 → 关掉页面 → 通知又没来」就成了永久性的钱收了不加分。
 * ⭐ 挂在"打开充值页拉充值记录"那一下，天然是用户最可能来看账的时刻。
 * ⚠️ 只取 3 条、且跳过刚下不到 1 分钟的单（那条交给前端轮询），避免把接口拖慢。
 */
export async function reconcileRecentCreditOrders(userId: string) {
  if (!isAlipayConfigured()) return;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await prisma.paymentOrder.findMany({
    where: {
      userId,
      kind: "credit_pack",
      status: { in: ["pending", "closed"] },
      // 没出过码 = 支付宝那边压根没这笔交易，查也是白查
      qrCode: { not: null },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { orderNo: true, createdAt: true },
  }).catch(() => []);
  for (const row of rows) {
    if (Date.now() - row.createdAt.getTime() < 60_000) continue;
    await syncAlipayCreditOrder(row.orderNo, userId).catch(() => undefined);
  }
}

export function getCreditOrderPayStatus(order: { status: string; createdAt: Date }, now = Date.now()): CreditChargePayStatus {
  if (order.status === "paid") return "paid";
  if (order.status === "pending" && now - order.createdAt.getTime() <= PAYMENT_ORDER_EXPIRE_MS) return "pending";
  return "unpaid";
}

function toCreditChargeRecord(row: { orderNo: string; createdAt: Date; paidAt: Date | null; payCny: number; credits: number; status: string }): CreditChargeRecord {
  return {
    orderNo: row.orderNo,
    at: formatMembershipDateTime(row.paidAt ?? row.createdAt),
    payCny: row.payCny,
    credits: row.credits,
    rateLabel: `¥${row.payCny}=${row.credits}积分`,
    payStatus: getCreditOrderPayStatus(row),
  };
}

export async function listPaidCreditRecords(userId: string): Promise<CreditChargeRecord[]> {
  const rows = await prisma.paymentOrder.findMany({
    where: { userId, kind: "credit_pack", status: "paid" },
    orderBy: { paidAt: "desc" },
    take: 100,
  });
  return rows.map(toCreditChargeRecord);
}

export async function listAdminCreditRecords(userId: string): Promise<CreditChargeRecord[]> {
  const rows = await prisma.paymentOrder.findMany({
    where: { userId, kind: "credit_pack" },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map(toCreditChargeRecord);
}
