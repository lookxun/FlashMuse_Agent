import { fulfillPaidCreditOrder, PAYMENT_ORDER_NO_PATTERN, syncAlipayCreditOrder } from "@/lib/payment-orders";
import { getAlipayAppId, parseAlipayNotifyBody, verifyAlipayNotify } from "@/lib/alipay";
import { appendPaymentLog } from "@/lib/payment-log";
import { getClientIp, rateLimitAllow } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * 支付宝异步通知（公网可达、任何人都能 POST 过来）。
 *
 * ⭐⭐ **核心设计：这个接口只是"去查一下"的触发器，加分依据永远不是这份报文。**
 *   两条路：
 *   ① 报文验签通过 + `app_id` 是我们的 + `trade_status` 是成功 → 走快路直接结算（正常情况）；
 *   ② 验签没过 / app_id 不对 / 格式不认识 → **一个字都不信**，改成用我们自己的私钥
 *      去 `alipay.trade.query` 查一遍（SDK 会用支付宝公钥验 v3 响应签名），查到真付了才加分。
 *   这样即使将来支付宝改了通知格式、或验签方式与 SDK 不匹配（本项目的真实风险：
 *      到目前为止线上加分全是走前端轮询查单，这条验签**从没被真正跑过**），
 *   也不可能出现"伪造一份报文就白拿积分"，最坏只是慢一点。
 *
 * ⛔ 别把 `trade_status` / `total_amount` 当权威（外网可控）。
 * ⛔ 别对未知订单号返回 failure（会让支付宝一直重试别人的单）；不是我们的单一律 success。
 */
function textResponse(body: "success" | "failure", status = 200) {
  return new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

export async function POST(request: Request) {
  const raw = await request.text();
  const payload = parseAlipayNotifyBody(raw, request.headers.get("content-type") ?? "");
  const orderNo = payload.out_trade_no ?? "";
  const ip = getClientIp(request);
  if (!orderNo || !PAYMENT_ORDER_NO_PATTERN.test(orderNo)) return textResponse("failure", 400);

  // 限流远高于支付宝真实重试频率（每笔最多几次）→ 只会挡住拿真实订单号来放大我们查单调用的人。
  if (!rateLimitAllow(`pay-notify:order:${orderNo}`, 30, 60_000) || !rateLimitAllow(`pay-notify:ip:${ip}`, 600, 60_000)) {
    void appendPaymentLog("notify-throttled", { orderNo, ip });
    return textResponse("failure", 429);
  }

  let signed = false;
  try {
    signed = verifyAlipayNotify(payload);
  } catch {
    signed = false;
  }
  const configuredAppId = getAlipayAppId();
  const appIdOk = !payload.app_id || !configuredAppId || payload.app_id === configuredAppId;
  const tradeStatus = payload.trade_status ?? "";
  void appendPaymentLog("notify-received", { orderNo, ip, signed, appIdOk, tradeStatus, tradeNo: payload.trade_no ?? "" });

  if (signed && appIdOk) {
    if (tradeStatus !== "TRADE_SUCCESS" && tradeStatus !== "TRADE_FINISHED") {
      void appendPaymentLog("notify-ignored", { orderNo, tradeStatus });
      return textResponse("success");
    }
    try {
      const result = await fulfillPaidCreditOrder({
        orderNo,
        tradeNo: payload.trade_no,
        totalAmount: payload.total_amount,
        notifyPayload: payload,
        source: "notify",
      });
      // 金额比订单少 = 绝不加分，也别告诉支付宝"处理成功"（留着重试 + 日志里有痕）
      if (!result.ok && result.reason === "amount") return textResponse("failure", 400);
      return textResponse("success");
    } catch {
      return textResponse("failure", 500);
    }
  }

  // ⭐ 走到这里 = 这份报文不可信。只用它的订单号当线索，钱付没付由我们自己去问支付宝。
  void appendPaymentLog("notify-unverified", { orderNo, ip, tradeStatus });
  try {
    const exists = await prisma.paymentOrder.findUnique({ where: { orderNo }, select: { id: true } });
    if (!exists) return textResponse("success");
    await syncAlipayCreditOrder(orderNo);
  } catch {
    return textResponse("failure", 500);
  }
  return textResponse("success");
}
