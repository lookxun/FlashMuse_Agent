import { AlipaySdk } from "alipay-sdk";

const GATEWAY = "https://openapi.alipay.com/gateway.do";

function readPem(value: string | undefined) {
  return (value ?? "").replace(/\\n/g, "\n").trim();
}

/** 本应用的支付宝 appId（回调里校验 `app_id` 用；没配时返回空串）。 */
export function getAlipayAppId() {
  return (process.env.ALIPAY_APP_ID ?? "").trim();
}

export function getAlipayNotifyUrl() {
  const configured = (process.env.ALIPAY_NOTIFY_URL ?? "").trim();
  if (configured) return configured;
  const base = (process.env.NEXT_PUBLIC_PRIMARY_BASE_URL ?? "").trim().replace(/\/+$/, "");
  return base ? `${base}/api/pay/alipay/notify` : "";
}

export function getAlipaySdk() {
  const appId = (process.env.ALIPAY_APP_ID ?? "").trim();
  const privateKey = readPem(process.env.ALIPAY_PRIVATE_KEY);
  const alipayPublicKey = readPem(process.env.ALIPAY_PUBLIC_KEY);
  if (!appId || !privateKey || !alipayPublicKey) {
    throw new Error("支付宝未配置");
  }
  return new AlipaySdk({
    appId,
    privateKey,
    alipayPublicKey,
    gateway: GATEWAY,
    keyType: "PKCS8",
    signType: "RSA2",
    camelcase: false,
    timeout: 15000,
  });
}

export function isAlipayConfigured() {
  return Boolean((process.env.ALIPAY_APP_ID ?? "").trim() && readPem(process.env.ALIPAY_PRIVATE_KEY) && readPem(process.env.ALIPAY_PUBLIC_KEY));
}

export async function alipayPrecreate(params: { orderNo: string; payCny: number; subject: string; notifyUrl: string }) {
  const sdk = getAlipaySdk();
  const result = await sdk.curl<{ qr_code?: string; qrCode?: string; out_trade_no?: string }>("POST", "/v3/alipay/trade/precreate", {
    body: {
      notify_url: params.notifyUrl,
      out_trade_no: params.orderNo,
      total_amount: params.payCny.toFixed(2),
      subject: params.subject,
      product_code: "QR_CODE_OFFLINE",
    },
  });
  const data = result.data ?? {};
  const qrCode = typeof data.qr_code === "string" ? data.qr_code : typeof data.qrCode === "string" ? data.qrCode : "";
  if (result.responseHttpStatus !== 200 || !qrCode) {
    throw new Error("支付宝下单失败");
  }
  return qrCode;
}

/**
 * 查单（`alipay.trade.query`）。
 *
 * ⭐⭐ **这是「这笔钱到底付没付」的唯一权威判据**：它是我们用自己的私钥签名发起的
 *   server-to-server 调用，且 alipay-sdk 会用「支付宝公钥」对 v3 响应做验签
 *   （`alipay-timestamp\nalipay-nonce\nbody\n`，见 alipay.js 的 `verifySignatureV3`）。
 *   ⛔ **绝不许拿异步通知报文里的 `trade_status` / `total_amount` 直接加分** ——
 *   那份报文是外网任何人都能 POST 过来的，只有验签能挡；而验签方式将来一变就成了洞。
 *   所以链路设计成：收到通知只当"去查一下"的触发器，加分永远看这个查单结果。
 *
 * ⚠️ 交易不存在（用户压根没扫码）时上游返回 4xx，SDK 会 **throw**（不是返回空）→
 *   调用方必须 try/catch，并且**不能把 throw 当成"没付钱"的证据**（网络抖动也走这里）。
 */
export async function alipayQuery(orderNo: string) {
  const sdk = getAlipaySdk();
  const result = await sdk.curl<{
    trade_status?: string;
    tradeStatus?: string;
    trade_no?: string;
    tradeNo?: string;
    total_amount?: string;
    totalAmount?: string;
  }>("POST", "/v3/alipay/trade/query", {
    body: { out_trade_no: orderNo },
  });
  const data = result.data ?? {};
  return {
    code: String(result.responseHttpStatus),
    tradeStatus: String(data.trade_status || data.tradeStatus || ""),
    tradeNo: typeof data.trade_no === "string" ? data.trade_no : typeof data.tradeNo === "string" ? data.tradeNo : "",
    totalAmount: String(data.total_amount || data.totalAmount || ""),
    raw: data as Record<string, unknown>,
  };
}

export function verifyAlipayNotify(payload: Record<string, string>) {
  return getAlipaySdk().checkNotifySignV2(payload);
}

/**
 * 解析支付宝异步通知的报文体（唯一实现，放在 lib 里是为了能写纯函数回归）。
 *
 * ⭐ 先按 `application/x-www-form-urlencoded` 解（v1 经典通知就是这种），
 *   解不出 `out_trade_no` 再试 JSON（万一将来换成 v3 那套 JSON 通知，我们不会直接 400）。
 * ⚠️ **form 解析必须只 decode 一次**：`URLSearchParams` 已经解码过，所以验签要用
 *   `checkNotifySignV2`（raw=true，内部不再 decodeURIComponent）。⛔ 用 `checkNotifySign`
 *   会二次解码、含 `%` 或中文的报文验签必挂。
 */
export function parseAlipayNotifyBody(raw: string, contentType = ""): Record<string, string> {
  const payload: Record<string, string> = {};
  if (!contentType.includes("json")) {
    for (const [key, value] of new URLSearchParams(raw).entries()) payload[key] = value;
    if (payload.out_trade_no) return payload;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === "string" || typeof value === "number") payload[key] = String(value);
      }
    }
  } catch {
    // 不是 JSON：保留上面 form 解析出来的内容
  }
  return payload;
}

