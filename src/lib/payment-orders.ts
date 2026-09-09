import { prisma } from "@/lib/prisma";
import { CREDIT_PACKS_CNY, getCreditPackCredits } from "@/lib/membership";
import { alipayPrecreate, alipayQuery, getAlipayNotifyUrl } from "@/lib/alipay";
import { formatMembershipDateTime, type CreditChargeRecord } from "@/lib/membership-purchase-records";

export const PAYMENT_ORDER_EXPIRE_MS = 15 * 60 * 1000;
const CREDIT_PACK_CNY_SET = new Set<number>(CREDIT_PACKS_CNY);

export function isCreditPackCny(value: unknown): value is (typeof CREDIT_PACKS_CNY)[number] {
  return typeof value === "number" && Number.isFinite(value) && CREDIT_PACK_CNY_SET.has(value);
}

export function createPaymentOrderNo() {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `C${stamp}${rand}`;
}

function paidAmountMatches(orderPayCny: number, paidAmount: string) {
  const paid = Number(paidAmount);
  if (!Number.isFinite(paid)) return false;
  return Math.abs(paid - orderPayCny) < 0.009;
}

export async function createAlipayCreditOrder(userId: string, packCny: number) {
  if (!isCreditPackCny(packCny)) throw new Error("无效的充值档位");
  const notifyUrl = getAlipayNotifyUrl();
  if (!notifyUrl) throw new Error("支付宝回调地址未配置");
  const credits = getCreditPackCredits("free", packCny);
  if (credits <= 0) throw new Error("积分档位无效");
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
      payCny: packCny,
      credits,
      subject,
    },
  });
  try {
    const qrCode = await alipayPrecreate({ orderNo, payCny: packCny, subject, notifyUrl });
    return prisma.paymentOrder.update({ where: { orderNo }, data: { qrCode } });
  } catch (error) {
    await prisma.paymentOrder.update({
      where: { orderNo },
      data: { status: "closed", closedAt: new Date() },
    }).catch(() => undefined);
    throw error;
  }
}

export async function fulfillPaidCreditOrder(params: {
  orderNo: string;
  tradeNo?: string;
  totalAmount?: string;
  notifyPayload?: Record<string, unknown>;
}) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{
      id: string;
      orderNo: string;
      userId: string;
      status: string;
      packCny: number;
      payCny: number;
      credits: number;
    }>>`
      SELECT "id", "orderNo", "userId", "status", "packCny", "payCny", "credits"
      FROM "PaymentOrder"
      WHERE "orderNo" = ${params.orderNo}
      FOR UPDATE
    `;
    const order = rows[0];
    if (!order) return { ok: false as const, reason: "missing" };
    if (order.status === "paid") return { ok: true as const, already: true, order };
    if (order.status !== "pending") return { ok: false as const, reason: "closed" };
    if (params.totalAmount && !paidAmountMatches(order.payCny, params.totalAmount)) {
      return { ok: false as const, reason: "amount" };
    }
    const expectedCredits = getCreditPackCredits("free", order.packCny);
    if (expectedCredits !== order.credits) return { ok: false as const, reason: "credits" };

    const existingLedger = await tx.creditLedger.findUnique({
      where: { requestId_kind: { requestId: order.orderNo, kind: "recharge" } },
    }).catch(() => null);
    if (!existingLedger) {
      await tx.user.update({
        where: { id: order.userId },
        data: { credits: { increment: expectedCredits } },
      });
      await tx.creditLedger.create({
        data: {
          userId: order.userId,
          requestId: order.orderNo,
          direction: "increase",
          kind: "recharge",
          label: "充值积分",
          credits: expectedCredits,
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
    return { ok: true as const, already: Boolean(existingLedger), order, balance: updated?.credits };
  });
}

export async function syncAlipayCreditOrder(orderNo: string, userId?: string) {
  const order = await prisma.paymentOrder.findUnique({ where: { orderNo } });
  if (!order) return null;
  if (userId && order.userId !== userId) return null;
  if (order.status === "paid") return order;
  if (order.status !== "pending") return order;
  if (Date.now() - order.createdAt.getTime() > PAYMENT_ORDER_EXPIRE_MS) {
    return prisma.paymentOrder.update({
      where: { orderNo },
      data: { status: "closed", closedAt: new Date() },
    });
  }
  let queried;
  try {
    queried = await alipayQuery(orderNo);
  } catch {
    return order;
  }
  if (queried.tradeStatus === "TRADE_SUCCESS" || queried.tradeStatus === "TRADE_FINISHED") {
    const fulfilled = await fulfillPaidCreditOrder({
      orderNo,
      tradeNo: queried.tradeNo,
      totalAmount: queried.totalAmount,
      notifyPayload: queried.raw,
    });
    if (fulfilled.ok) {
      return prisma.paymentOrder.findUnique({ where: { orderNo } });
    }
  }
  if (queried.tradeStatus === "TRADE_CLOSED") {
    return prisma.paymentOrder.update({
      where: { orderNo },
      data: { status: "closed", closedAt: new Date(), alipayTradeNo: queried.tradeNo || undefined },
    });
  }
  return order;
}

export async function listPaidCreditRecords(userId: string): Promise<CreditChargeRecord[]> {
  const rows = await prisma.paymentOrder.findMany({
    where: { userId, kind: "credit_pack", status: "paid" },
    orderBy: { paidAt: "desc" },
    take: 100,
  });
  return rows.map((row) => ({
    orderNo: row.orderNo,
    at: formatMembershipDateTime(row.paidAt ?? row.createdAt),
    payCny: row.payCny,
    credits: row.credits,
    rateLabel: `¥10=${getCreditPackCredits("free", 10)}积分`,
  }));
}
