"use client";

import { useEffect, useState } from "react";
import { CreditRechargeModal } from "@/components/credit-recharge-modal";

type Scenario = "pending" | "paid" | "closed" | "order-fail";

// 一张能扫（指向本站原型页）的示例二维码内容，仅用于原型展示。
const DEMO_QR_CODE = "https://qr.alipay.com/proto-demo-credit-recharge";

const DEMO_RECORDS = [
  { orderNo: "C2026090818421501", at: "2026-09-08 18:42", payCny: 50, credits: 250, rateLabel: "¥10=50积分" },
  { orderNo: "C2026090711030422", at: "2026-09-07 11:03", payCny: 10, credits: 50, rateLabel: "¥10=50积分" },
];

/**
 * 积分充值原型：渲染**真实**的 `CreditRechargeModal`，通过 monkey-patch fetch
 * mock 掉 `/api/pay/*` 与 `/api/membership/purchases`，用 scenario 切出四种展示：
 *   pending    下单成功、等待扫码支付（显示付款码）
 *   paid       支付成功（二维码变绿字「支付成功」、积分到账）
 *   closed     订单关闭（提示「订单已关闭，请重新下单」）
 *   order-fail 下单失败（二维码区域红字 + 顶部黑色 toast）
 */
export function ProtoCreditRechargeClient({ scenario, embed }: { scenario: Scenario; embed?: boolean }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const realFetch = window.fetch.bind(window);
    const json = (body: unknown, ok = true) =>
      Promise.resolve(new Response(JSON.stringify(body), {
        status: ok ? 200 : 400,
        headers: { "content-type": "application/json" },
      }));

    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      // 充值记录
      if (url.startsWith("/api/membership/purchases")) {
        return json({ credits: DEMO_RECORDS });
      }

      // 下单
      if (url.startsWith("/api/pay/credit-order/status")) {
        if (scenario === "paid") return json({ status: "paid", creditsBalance: 1750 });
        if (scenario === "closed") return json({ status: "closed" });
        return json({ status: "pending" });
      }
      if (url.startsWith("/api/pay/credit-order")) {
        if (scenario === "order-fail") {
          return json({ error: "下单失败，请稍后再试（原型模拟）" }, false);
        }
        return json({ qrCode: DEMO_QR_CODE, orderNo: "C2026090819001234", credits: 250, payCny: 50 });
      }

      return realFetch(input as RequestInfo, init);
    }) as typeof window.fetch;

    setReady(true);
    return () => {
      window.fetch = realFetch;
    };
  }, [scenario]);

  if (!ready) return <div className="fixed inset-0 bg-white" />;

  return (
    <ProtoAutoOpenPay scenario={scenario}>
      <CreditRechargeModal
        open
        nickname="原型测试"
        account="proto@local"
        credits={scenario === "paid" ? 1750 : 1500}
        onClose={() => {
          if (embed && window.parent !== window) {
            window.parent.postMessage("close-membership", "*");
            return;
          }
          window.location.href = "/proto-test";
        }}
      />
    </ProtoAutoOpenPay>
  );
}

// 除 pending 首屏外，其它场景自动点一次「充值」把支付弹层打开，省得手点。
function ProtoAutoOpenPay({ scenario, children }: { scenario: Scenario; children: React.ReactNode }) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      // 勾选协议
      const agree = document.querySelector<HTMLInputElement>('input[type="checkbox"]');
      if (agree && !agree.checked) agree.click();
      // 点「充值」打开支付弹层
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
      const payBtn = buttons.find((btn) => btn.textContent?.trim() === "充值");
      payBtn?.click();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [scenario]);
  return <>{children}</>;
}
