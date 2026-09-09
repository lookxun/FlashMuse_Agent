import { getCurrentUser, jsonError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PAYMENT_ORDER_NO_PATTERN, syncAlipayCreditOrder } from "@/lib/payment-orders";
import { getClientIp, rateLimitAllow } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * 前端付款弹层每 2.5 秒轮询这个接口。
 *
 * ⭐ 两层保护：
 *   ① 接口级限流（防止有人拿脚本高频打）；
 *   ② **对同一个订单号，2 秒内最多向支付宝查一次**（`allowRemote`）——
 *      不然一个登录用户就能把我们的 `alipay.trade.query` 调用量放大成 DDoS/额度耗尽。
 *      被节流时不打支付宝，直接返回库里的状态，前端轮询照常工作。
 * ⭐ 归属校验在 `syncAlipayCreditOrder(orderNo, user.id)` 里做：不是自己的单一律当"不存在"。
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);

  const orderNo = new URL(request.url).searchParams.get("orderNo")?.trim() ?? "";
  if (!orderNo || !PAYMENT_ORDER_NO_PATTERN.test(orderNo)) return jsonError("订单号无效");

  // 正常轮询 15 分钟约 360 次 → 每用户 900/15min、每 IP 3000/15min 只挡异常流量
  if (!rateLimitAllow(`pay-status:user:${user.id}`, 900, 15 * 60_000) || !rateLimitAllow(`pay-status:ip:${getClientIp(request)}`, 3000, 15 * 60_000)) {
    return jsonError("查询太频繁，请稍后再试", 429);
  }

  try {
    const allowRemote = rateLimitAllow(`pay-query:${orderNo}`, 1, 2_000);
    const order = await syncAlipayCreditOrder(orderNo, user.id, { allowRemote });
    if (!order) return jsonError("订单不存在", 404);
    const userRow = order.status === "paid"
      ? await prisma.user.findUnique({ where: { id: user.id }, select: { credits: true } })
      : null;
    return Response.json({
      orderNo: order.orderNo,
      status: order.status,
      packCny: order.packCny,
      payCny: order.payCny,
      credits: order.credits,
      creditsBalance: userRow?.credits,
    });
  } catch {
    return jsonError("查询失败，请稍后再试");
  }
}
