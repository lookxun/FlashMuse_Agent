import { AlipaySdk } from "alipay-sdk";

const GATEWAY = "https://openapi.alipay.com/gateway.do";

function readPem(value: string | undefined) {
  return (value ?? "").replace(/\\n/g, "\n").trim();
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
