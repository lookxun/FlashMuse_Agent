import { getCurrentUser, jsonError } from "@/lib/auth";
import { isAlipayConfigured } from "@/lib/alipay";
import { createAlipayCreditOrder, isCreditPackCny, PAYMENT_ORDER_EXPIRE_MS } from "@/lib/payment-orders";
import { getClientIp, rateLimitAllow } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);
  if (!isAlipayConfigured()) return jsonError("支付宝未配置", 503);

  if (!rateLimitAllow(`pay-order:user:${user.id}`, 8, 10 * 60_000) || !rateLimitAllow(`pay-order:ip:${getClientIp(request)}`, 20, 10 * 60_000)) {
    return jsonError("下单太频繁，请稍后再试");
  }

  const body = await request.json().catch(() => null) as { packCny?: unknown } | null;
  const packCny = typeof body?.packCny === "number" ? body.packCny : Number(body?.packCny);
  if (!isCreditPackCny(packCny)) return jsonError("无效的充值档位");

  try {
    const order = await createAlipayCreditOrder(user.id, packCny);
    if (!order.qrCode) return jsonError("下单失败，请稍后再试");
    return Response.json({
      orderNo: order.orderNo,
      packCny: order.packCny,
      payCny: order.payCny,
      credits: order.credits,
      qrCode: order.qrCode,
      expiresAt: new Date(order.createdAt.getTime() + PAYMENT_ORDER_EXPIRE_MS).toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "下单失败";
    return jsonError(message === "支付宝未配置" || message === "支付宝回调地址未配置" ? message : "下单失败，请稍后再试", message.includes("未配置") ? 503 : 400);
  }
}
