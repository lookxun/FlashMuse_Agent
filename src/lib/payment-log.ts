import { join } from "node:path";
import { appendDiagnosticsJsonl } from "@/lib/diagnostics-log-rotate";

/**
 * 支付审计日志（唯一实现）。落 `.runtime/payment-diagnostics-log.jsonl`，走统一轮转（20MB × 7 代）。
 *
 * ⭐ 为什么要单独一个日志：钱相关的链路必须**事后可追溯** ——
 *   「谁在什么时候下了单」「哪一笔真加分了」「有没有人在打我们的回调地址」
 *   全靠这一份；只落库的话，被拒的请求（验签失败、金额不符、限流）压根不会留痕。
 *
 * ⛔⛔ **禁止把敏感字段写进来**：`sign` / `ALIPAY_PRIVATE_KEY` / 完整 notify 报文 /
 *   买家账号。只允许记订单号、交易号、金额、状态、来源 IP 这类必要字段。
 * ⚠️ 服务器上这个文件的属主必须是 uid 1000（容器里 app 以 node 跑）。
 *   ⛔ 别用 root 跑脚本去创建它（root 建的文件会让 app 静默写不进去，见 AGENTS.md）。
 */
const LOG_PATH = join(process.cwd(), ".runtime", "payment-diagnostics-log.jsonl");

export type PaymentLogEvent =
  | "order-created"
  | "order-create-failed"
  | "order-closed"
  | "order-credited"
  | "order-credit-duplicated"
  | "order-amount-mismatch"
  | "notify-received"
  | "notify-unverified"
  | "notify-ignored"
  | "notify-throttled"
  | "credit-pack-settings-changed";

export async function appendPaymentLog(event: PaymentLogEvent, detail: Record<string, unknown> = {}) {
  const line = `${JSON.stringify({ ts: new Date().toISOString(), tsEpochMs: Date.now(), event, ...detail })}\n`;
  await appendDiagnosticsJsonl(LOG_PATH, line);
}
