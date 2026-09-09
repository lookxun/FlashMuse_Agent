import { fulfillPaidCreditOrder } from "@/lib/payment-orders";
import { verifyAlipayNotify } from "@/lib/alipay";

export const runtime = "nodejs";

function parseNotifyBody(raw: string) {
  const params = new URLSearchParams(raw);
  const payload: Record<string, string> = {};
  for (const [key, value] of params.entries()) payload[key] = value;
  return payload;
}

export async function POST(request: Request) {
  const raw = await request.text();
  const payload = parseNotifyBody(raw);
  if (!payload.sign || !payload.out_trade_no) {
    return new Response("failure", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  let signed = false;
  try {
    signed = verifyAlipayNotify(payload);
  } catch {
    signed = false;
  }
  if (!signed) {
    return new Response("failure", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  const tradeStatus = payload.trade_status ?? "";
  if (tradeStatus !== "TRADE_SUCCESS" && tradeStatus !== "TRADE_FINISHED") {
    return new Response("success", { headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  try {
    const result = await fulfillPaidCreditOrder({
      orderNo: payload.out_trade_no,
      tradeNo: payload.trade_no,
      totalAmount: payload.total_amount,
      notifyPayload: payload,
    });
    if (!result.ok && result.reason === "amount") {
      return new Response("failure", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
    }
    return new Response("success", { headers: { "content-type": "text/plain; charset=utf-8" } });
  } catch {
    return new Response("failure", { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
}
