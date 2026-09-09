"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RiAlipayFill, RiCheckLine, RiCloseLine, RiErrorWarningFill, RiFileCopyLine, RiLeafLine, RiRefreshLine, RiShining2Fill } from "react-icons/ri";
import { DEFAULT_CREDIT_PACKS, getMembershipLabel, type CreditPack } from "@/lib/membership";
import { bytePlusVideoGenerationModels, frontendImageGenerationModels, getImageModelSelectHint, getVideoModelSelectHint, videoGenerationModels } from "@/lib/models";
import { useBodyScrollLock } from "@/components/use-body-scroll-lock";
import { FakePayQrCode } from "@/components/fake-pay-qr-code";
import type { CreditChargeRecord } from "@/lib/membership-purchase-records";

function priceFromHint(hint: string | null) {
  if (!hint) return "";
  const index = hint.lastIndexOf(" · ");
  return index >= 0 ? hint.slice(index + 3) : hint;
}

function uniquePricedModels(
  models: readonly { id: string; label: string }[],
  hintOf: (id: string, usdToCnyRate: number, creditsPerCny: number) => string | null,
  usdToCnyRate: number,
  creditsPerCny: number,
) {
  const seen = new Set<string>();
  const rows: { id: string; label: string; price: string }[] = [];
  for (const model of models) {
    if (seen.has(model.label)) continue;
    const price = priceFromHint(hintOf(model.id, usdToCnyRate, creditsPerCny));
    if (!price) continue;
    seen.add(model.label);
    rows.push({ id: model.id, label: model.label, price });
  }
  return rows;
}

/**
 * 积分充值（独立全屏页）。⭐ 这是**要上线收真钱**的页面，改动前先看这几条：
 *
 * ⛔⛔ **接支付时：金额和到账积分必须由服务端复算**，绝不许把这里显示的
 *   `selectedPackCny` / `getCreditPackCredits(...)` 直接当成入账依据。
 *   服务端唯一权威 = 后台「积分设置」那 8 档（`CREDIT_PACK_SETTINGS`）；
 *   下单接口只接收档位下标 `packIndex`，钱和积分服务端自己读设置。
 *   （同源铁律：钱只能在服务端算 —— 前端算好的金额一律不许直接写进账。）
 * ⚠️ 这里的积分一律按**基础档**算（`getCreditPackCredits("free", cny)`）：
 *   会员系统现在是关闭状态，人人基础档，8 格只显示基础价、不显示 7 折/6 折。
 * ⚠️ 「充值记录」来自 `/api/membership/purchases`；有真实已付订单时只显示真流水，
 *   生产环境不返回演示假数据。
 */
function ModelPriceTable({ title, rows }: { title: string; rows: { id: string; label: string; price: string }[] }) {
  return (
    <div>
      <div className="mb-3 text-[16px] font-semibold">{title}</div>
      <div className="overflow-hidden rounded-[12px] border border-[#ececec]">
        <div className="grid grid-cols-[1fr_160px] bg-[#f5f5f5] px-5 py-3 text-[13px] font-medium text-[#888888]">
          <span>模型</span>
          <span className="text-right">价格</span>
        </div>
        {rows.map((row) => (
          <div key={row.id} className="grid grid-cols-[1fr_160px] border-t border-[#ececec] px-5 py-3.5 text-[14px]">
            <span className="min-w-0 truncate text-[#111111]">{row.label}</span>
            <span className="text-right text-[#555555]">{row.price}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CreditRechargeModal({
  open,
  nickname,
  account,
  avatarUrl,
  credits,
  onClose,
  onCreditsPaid,
}: {
  open: boolean;
  nickname: string;
  account?: string;
  avatarUrl?: string;
  credits: number;
  onClose: () => void;
  onCreditsPaid?: (balance: number) => void;
}) {
  const [creditPacks, setCreditPacks] = useState<CreditPack[]>(DEFAULT_CREDIT_PACKS);
  const [selectedPackIndex, setSelectedPackIndex] = useState(0);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [creditRecords, setCreditRecords] = useState<CreditChargeRecord[]>([]);
  const [copiedOrderNo, setCopiedOrderNo] = useState("");
  const [agreeProtocol, setAgreeProtocol] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [agreeTip, setAgreeTip] = useState("");
  const [payLoading, setPayLoading] = useState(false);
  const [payQrDataUrl, setPayQrDataUrl] = useState("");
  const [payOrderNo, setPayOrderNo] = useState("");
  const [payCredits, setPayCredits] = useState(0);
  const [payAmount, setPayAmount] = useState(0);
  const [payStatus, setPayStatus] = useState<"pending" | "paid" | "closed">("pending");
  const [creditRate, setCreditRate] = useState({ usdToCnyRate: 7.2, creditsPerCny: 10 });
  const paidNotifiedRef = useRef(false);
  useBodyScrollLock(open);
  const loadRecords = () => {
    void fetch("/api/membership/purchases", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { credits?: CreditChargeRecord[] } | null) => {
        setCreditRecords(data?.credits ?? []);
      })
      .catch(() => undefined);
  };
  useEffect(() => {
    if (!open) return;
    setRecordsOpen(false);
    setAgreeProtocol(false);
    setPayOpen(false);
    setAgreeTip("");
    setPayLoading(false);
    setPayQrDataUrl("");
    setPayOrderNo("");
    setPayCredits(0);
    setPayAmount(0);
    setPayStatus("pending");
    paidNotifiedRef.current = false;
    loadRecords();
    void fetch("/api/credit-packs", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { packs?: CreditPack[] } | null) => {
        if (!Array.isArray(data?.packs) || data.packs.length === 0) return;
        setCreditPacks(data.packs);
        setSelectedPackIndex(0);
      })
      .catch(() => undefined);
    void fetch("/api/model-availability", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { creditRate?: { usdToCnyRate?: number; creditsPerCny?: number } } | null) => {
        if (data?.creditRate && typeof data.creditRate.usdToCnyRate === "number" && typeof data.creditRate.creditsPerCny === "number") {
          setCreditRate({ usdToCnyRate: data.creditRate.usdToCnyRate, creditsPerCny: data.creditRate.creditsPerCny });
        }
      })
      .catch(() => undefined);
  }, [open]);
  useEffect(() => {
    if (!payOpen || !payOrderNo || payStatus !== "pending") return;
    let cancelled = false;
    const tick = () => {
      void fetch(`/api/pay/credit-order/status?orderNo=${encodeURIComponent(payOrderNo)}`, { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .then((data: { status?: string; creditsBalance?: number } | null) => {
          if (cancelled || !data) return;
          if (data.status === "paid") {
            setPayStatus("paid");
            if (!paidNotifiedRef.current && typeof data.creditsBalance === "number") {
              paidNotifiedRef.current = true;
              onCreditsPaid?.(data.creditsBalance);
            }
            loadRecords();
          } else if (data.status === "closed") {
            setPayStatus("closed");
          }
        })
        .catch(() => undefined);
    };
    tick();
    const timer = window.setInterval(tick, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [payOpen, payOrderNo, payStatus, onCreditsPaid]);
  const showAgreeTip = () => {
    setAgreeTip("请勾选同意《闪念付费服务协议》");
    window.setTimeout(() => setAgreeTip(""), 2200);
  };
  const createPayOrder = () => {
    const pack = creditPacks[selectedPackIndex] ?? DEFAULT_CREDIT_PACKS[0];
    setPayLoading(true);
    setPayQrDataUrl("");
    setPayOrderNo("");
    setPayCredits(pack.credits);
    setPayAmount(pack.payCny);
    setPayStatus("pending");
    paidNotifiedRef.current = false;
    void fetch("/api/pay/credit-order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ packIndex: selectedPackIndex }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null) as { qrCode?: string; orderNo?: string; credits?: number; payCny?: number; error?: string } | null;
        if (!response.ok || !data?.qrCode || !data.orderNo) {
          throw new Error(data?.error || "下单失败，请稍后再试");
        }
        const QRCode = (await import("qrcode")).default;
        const dataUrl = await QRCode.toDataURL(data.qrCode, { margin: 1, width: 360, errorCorrectionLevel: "M" });
        setPayQrDataUrl(dataUrl);
        setPayOrderNo(data.orderNo);
        setPayCredits(data.credits ?? pack.credits);
        setPayAmount(data.payCny ?? pack.payCny);
      })
      .catch(() => undefined)
      .finally(() => {
        setPayLoading(false);
      });
  };
  const openPay = () => {
    if (!agreeProtocol) {
      showAgreeTip();
      return;
    }
    setPayOpen(true);
    createPayOrder();
  };
  const copyOrderNo = (orderNo: string) => {
    void navigator.clipboard?.writeText(orderNo).then(() => {
      setCopiedOrderNo(orderNo);
      window.setTimeout(() => setCopiedOrderNo((current) => (current === orderNo ? "" : current)), 1000);
    }).catch(() => undefined);
  };
  if (!open) return null;

  return (
    <div className="yinzao-scrollbar-always fixed inset-0 z-[12000] overflow-y-auto bg-white text-[#111111]">
      <button type="button" onClick={onClose} className="absolute right-6 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-[8px] text-[#888888] transition hover:bg-[#f3f3f3]" aria-label="关闭积分充值">
        <RiCloseLine className="h-6 w-6" />
      </button>
      <div className="mx-auto w-full max-w-[1120px] px-8 pb-16 pt-6">
        <div className="mb-8 flex min-w-0 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[#f3f3f3]">
              {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[15px] font-medium text-[#888888]">{nickname.slice(0, 1)}</div>}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[16px] font-semibold">
                {nickname}
                {account ? <span className="ml-1.5 text-[12px] font-normal text-[#888888]">{account}</span> : null}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[13px] text-[#888888]">
                <span className="inline-flex items-center gap-1">
                  <RiLeafLine className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {getMembershipLabel("free")}
                </span>
                <span className="h-3 w-px shrink-0 bg-[#d8d8d8]" />
                <span className="inline-flex items-center gap-1">
                  <RiShining2Fill className="h-3.5 w-3.5 shrink-0 text-[#111111]" />
                  <span className="font-medium text-[#111111]">{credits.toLocaleString("en-US")}</span>
                </span>
              </div>
            </div>
          </div>
          <button type="button" onClick={() => setRecordsOpen(true)} className="inline-flex h-9 shrink-0 items-center justify-center rounded-[8px] bg-[#f0f0f0] px-4 font-medium leading-none text-[#555555]"><span className="leading-none" style={{ fontSize: 13 }}>充值记录</span></button>
        </div>
        <div className="mb-4 overflow-hidden rounded-[22px] px-8 py-6 text-white" style={{ background: "linear-gradient(150deg, #2f6bff 0%, #4c8dff 42%, #f08a2a 88%, #f4a04a 100%)" }}>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/18 px-2.5 py-0.5 text-[12px] font-medium">Seedream 5.0 Pro</span>
            <span className="rounded-full bg-[#c9a227] px-2.5 py-0.5 text-[12px] font-medium text-white">Seedance 2.5</span>
          </div>
          <div className="mt-3 text-[26px] font-semibold leading-tight tracking-[-0.03em]">Seedance 2.5 已上线，更稳更便宜不抽卡</div>
          <div className="mt-1.5 text-[18px] font-medium text-white/90">图片、视频、语音全覆盖，充值积分永久有效</div>
        </div>
        <h2 className="text-center text-[28px] font-semibold tracking-[-0.04em]">充值积分</h2>
        <p className="mt-3 text-center text-[13px] text-[#8a8a8a]">¥10 = 50 积分，充值积分永久有效</p>
        <div className="mt-10">
          <div className="grid grid-cols-4 gap-3">
            {creditPacks.map((pack, index) => {
              const selected = selectedPackIndex === index;
              return (
                <button
                  key={`${pack.payCny}-${pack.credits}-${index}`}
                  type="button"
                  onClick={() => setSelectedPackIndex(index)}
                  className={`relative overflow-hidden rounded-[12px] bg-[#efefef] px-4 py-8 text-left transition ${selected ? "border-2 border-[#111111]" : "border-2 border-transparent"}`}
                >
                  <div className="flex items-center gap-1.5 text-[24px] font-semibold">
                    <RiShining2Fill className="h-5 w-5 text-[#555555]" />
                    {pack.credits.toLocaleString("en-US")}
                  </div>
                  <div className="mt-4 text-[16px] text-[#111111]">¥{pack.payCny.toFixed(2)}</div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-10">
          <div className="mb-3 flex items-center justify-end gap-2 text-[15px] text-[#555555]">
            <input type="checkbox" checked={agreeProtocol} onChange={(event) => setAgreeProtocol(event.target.checked)} className="h-4 w-4 cursor-pointer accent-[#2ec7c0]" />
            <span>已阅读并同意 <a href="/paid-terms" target="_blank" rel="noreferrer" className="text-[#2ec7c0]">闪念付费服务协议</a></span>
          </div>
          <div className="flex h-[96px] items-center justify-end gap-5 rounded-[16px] bg-[#efefef] px-6">
            <div className="text-[14px] text-[#888888]">
              实付款：<span className="text-[22px] font-semibold text-[#111111]">¥{(creditPacks[selectedPackIndex] ?? DEFAULT_CREDIT_PACKS[0]).payCny.toFixed(2)}</span>
            </div>
            <button type="button" onClick={openPay} className="flex h-14 w-[168px] items-center justify-center rounded-[10px] bg-[#2ec7c0] text-[16px] font-medium text-white hover:bg-[#28b8b1]">
              充值
            </button>
          </div>
        </div>
        <div className="mt-4 text-[13px] leading-5 text-[#9a9a9a]">温馨提示：积分不可转赠，也不可提现；充值积分永久有效，不可反向兑换为人民币。</div>
        <div className="mt-12 grid grid-cols-2 gap-6">
          <ModelPriceTable title="图片模型" rows={uniquePricedModels(frontendImageGenerationModels, getImageModelSelectHint, creditRate.usdToCnyRate, creditRate.creditsPerCny)} />
          <ModelPriceTable title="视频模型" rows={uniquePricedModels([...bytePlusVideoGenerationModels, ...videoGenerationModels], getVideoModelSelectHint, creditRate.usdToCnyRate, creditRate.creditsPerCny)} />
        </div>
      </div>
      {agreeTip && typeof document !== "undefined" ? createPortal(
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[13000] flex justify-center yinzao-asset-upload-tip-enter">
          <div className="inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#111111] px-4 text-[14px] font-medium leading-none text-white shadow-[0_8px_18px_rgba(0,0,0,0.18)]">
            <RiErrorWarningFill className="h-5 w-5" />
            {agreeTip}
          </div>
        </div>,
        document.body,
      ) : null}
      {payOpen ? (
        <div className="fixed inset-0 z-[12100] flex items-center justify-center bg-black/62 px-4" onClick={() => setPayOpen(false)}>
          <div className="relative w-full max-w-[720px] min-h-[404px] origin-center rounded-[22px] bg-white p-8 text-[#111111] shadow-[0_20px_60px_rgba(0,0,0,0.22)]" style={{ animation: "membershipCreditPop .22s ease-out" }} onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setPayOpen(false)} className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-[8px] text-[#888888] hover:bg-[#f3f3f3]" aria-label="关闭支付">
              <RiCloseLine className="h-5 w-5" />
            </button>
            {payStatus === "paid" ? (
              <div className="flex min-h-[340px] flex-col items-center justify-center">
                <div className="flex items-center gap-4">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#22a06b" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.2" /><path d="M8 12.2l2.6 2.6L16.2 9.2" /></svg>
                  <div>
                    <div className="text-[22px] font-semibold">支付成功</div>
                    <div className="mt-1.5 text-[14px] text-[#888888]">充值成功，获得{(payCredits || (creditPacks[selectedPackIndex] ?? DEFAULT_CREDIT_PACKS[0]).credits).toLocaleString("en-US")}积分。</div>
                  </div>
                </div>
                <button type="button" onClick={() => setPayOpen(false)} className="mt-[72px] h-[52px] min-w-[240px] rounded-[5px] border border-[#d0d0d0] bg-white px-14 text-[16px] font-medium text-[#111111]">返回</button>
              </div>
            ) : (
              <>
                <div>
                  <div className="flex items-center gap-2 text-[26px] font-semibold">
                    充值积分
                    <RiShining2Fill className="h-6 w-6 text-[#555555]" />
                    {(payCredits || (creditPacks[selectedPackIndex] ?? DEFAULT_CREDIT_PACKS[0]).credits).toLocaleString("en-US")}
                  </div>
                  <div className="mt-1 text-[14px] text-[#888888]">购买后立即生效</div>
                </div>
                <div className="mt-6 flex gap-2">
                  <div className="inline-flex h-10 items-center gap-2 rounded-[5px] bg-[#e8f7ff] px-4 text-[14px] text-[#1677ff] ring-1 ring-[#1677ff]">
                    <RiAlipayFill className="h-[22px] w-[22px]" />
                    支付宝
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-6">
                  <div className="relative flex h-[196px] w-[196px] shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-[#f7f7f7] p-2">
                    {payLoading ? (
                      <div className="text-[13px] text-[#888888]">正在生成付款码…</div>
                    ) : payQrDataUrl && payStatus !== "closed" ? (
                      <img src={payQrDataUrl} alt="支付宝付款码" className="h-full w-full object-contain" />
                    ) : (
                      <>
                        <FakePayQrCode />
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-white/42">
                          <RiErrorWarningFill className={`text-[44px] leading-none ${payStatus === "closed" ? "text-[#f5b400]" : "text-[#e05656]"}`} />
                          <div className="text-[13px] font-normal text-[#888888]">{payStatus === "closed" ? "二维码已过期请刷新" : "拉取二维码失败请刷新"}</div>
                          <button type="button" onClick={createPayOrder} className="inline-flex items-center gap-1 border-0 bg-transparent text-[12px] text-[#1677ff]">
                            <RiRefreshLine className="h-3.5 w-3.5" />
                            刷新二维码
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[36px] font-semibold">¥{(payAmount || (creditPacks[selectedPackIndex] ?? DEFAULT_CREDIT_PACKS[0]).payCny).toFixed(2)}</div>
                    <div className="mt-2 text-[14px] text-[#555555]">请使用支付宝扫码支付</div>
                    <div className="mt-3 text-[12px] leading-5 text-[#9a9a9a]">
                      支付即表示您同意闪念的 <a href="/paid-terms" target="_blank" rel="noreferrer" className="text-[#2ec7c0]">付费服务协议</a> 和 <a href="/privacy" target="_blank" rel="noreferrer" className="text-[#2ec7c0]">隐私政策</a>，虚拟产品不支持退款。
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
      {recordsOpen ? (
        <div className="fixed inset-0 z-[12100] flex items-center justify-center bg-black/62 px-4" onClick={() => setRecordsOpen(false)}>
          <div className="flex h-[720px] w-full max-w-[720px] origin-center flex-col rounded-[22px] bg-white px-8 py-7 text-[#111111] shadow-[0_20px_60px_rgba(0,0,0,0.22)]" style={{ animation: "membershipCreditPop .22s ease-out" }} onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="text-[20px] font-semibold">充值记录</div>
              <button type="button" onClick={() => setRecordsOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-[8px] text-[#888888] hover:bg-[#f3f3f3]" aria-label="关闭充值记录">
                <RiCloseLine className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pt-6">
              {creditRecords.length === 0 ? (
                <div className="flex h-full min-h-[240px] items-center justify-center text-[14px] text-[#888888]">暂无充值记录</div>
              ) : (
                <div className="space-y-4 pb-4">
                  {creditRecords.map((item) => (
                    <div key={item.orderNo} className="rounded-[14px] bg-[#f5f5f5] px-5 py-5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[20px] font-semibold text-[#111111]">{item.credits.toLocaleString("en-US")}积分充值</div>
                        <div className="shrink-0 text-[14px] font-medium text-[#22a06b]">付款成功</div>
                      </div>
                      <div className="mt-4 space-y-3 text-[13px]">
                        <div className="flex items-center justify-between"><span className="text-[#888888]">价格</span><span>¥{item.payCny.toFixed(2)}</span></div>
                        <div className="flex items-center justify-between"><span className="text-[#888888]">购买时间</span><span>{item.at}</span></div>
                        <div className="flex items-center justify-between gap-4"><span className="shrink-0 text-[#888888]">订单编号</span><span className="inline-flex min-w-0 items-center gap-1.5"><button type="button" onClick={() => copyOrderNo(item.orderNo)} className="flex h-5 w-5 shrink-0 items-center justify-center text-[#888888]" aria-label={copiedOrderNo === item.orderNo ? "已复制" : "复制订单编号"}>{copiedOrderNo === item.orderNo ? <RiCheckLine className="h-3.5 w-3.5 text-[#111111]" /> : <RiFileCopyLine className="h-3.5 w-3.5" />}</button><span className="truncate text-right font-mono text-[12px]">{item.orderNo}</span></span></div>
                        <div className="flex items-center justify-between"><span className="text-[#888888]">支付方式</span><span>支付宝支付</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
      <style>{`
        @keyframes membershipCreditPop { 0% { transform: scale(0.5); } 70% { transform: scale(1.05); } 100% { transform: scale(1); } }
      `}</style>
    </div>
  );
}
