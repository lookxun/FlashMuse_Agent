"use client";

import { useEffect, useMemo, useState } from "react";
import { RiEyeLine, RiEyeOffLine, RiFileCopyLine, RiLockLine, RiLockUnlockLine, RiShieldCheckLine } from "react-icons/ri";

export type ContentModerationEventRow = {
  id: string;
  createdAtLabel: string;
  userLabel: string;
  sourceLabel: string;
  kindLabel: string;
  action: string;
  status: string;
  prompt: string;
  matchedTerm?: string;
  semanticReason?: string;
};

export function AdminContentModerationPanel({ initialEnabled, initialHidden, initialUnlocked, initialTerms, events }: { initialEnabled: boolean; initialHidden: boolean; initialUnlocked: boolean; initialTerms: string[]; events: ContentModerationEventRow[] }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [terms, setTerms] = useState(initialTerms.join("，"));
  const [message, setMessage] = useState("");
  const [toggleMessage, setToggleMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [hidden, setHidden] = useState(true);
  const maskedTerms = useMemo(() => terms.replace(/[^\n,，]/g, "*"), [terms]);

  // 页面级锁：状态存库、全浏览器共享。解锁需密码，锁定不需要。
  const [unlocked, setUnlocked] = useState(initialUnlocked);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwValue, setPwValue] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwPending, setPwPending] = useState(false);

  const toggleLock = () => {
    if (unlocked) {
      setUnlocked(false);
      setHidden(true);
      void fetch("/admin/api/content-moderation/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unlocked: false }) }).catch(() => undefined);
      return;
    }
    setPwValue("");
    setPwError("");
    setPwOpen(true);
  };
  const closePassword = () => { setPwOpen(false); setPwPending(false); };

  // 离开本页（切到别的后台页 / 关闭）时恢复锁定：写库 editUnlocked=false。
  // keepalive 让请求在导航卸载后仍能发出；同时 pagehide 兜底覆盖关标签页/刷新的情况。
  useEffect(() => {
    const relock = () => {
      try {
        fetch("/admin/api/content-moderation/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unlocked: false }), keepalive: true }).catch(() => undefined);
      } catch { /* ignore */ }
    };
    window.addEventListener("pagehide", relock);
    return () => {
      window.removeEventListener("pagehide", relock);
      relock();
    };
  }, []);
  const confirmPassword = () => {
    if (pwPending) return;
    setPwPending(true);
    setPwError("");
    fetch("/admin/api/content-moderation/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unlocked: true, password: pwValue }) })
      .then(async (response) => {
        const data = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) throw new Error(data.error || "密码错误");
        setUnlocked(true);
        setPwOpen(false);
      })
      .catch((error) => { setPwError(error instanceof Error ? error.message : "密码错误"); })
      .finally(() => setPwPending(false));
  };

  const save = () => {
    setPending(true);
    setMessage("");
    fetch("/admin/api/content-moderation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled, terms }) })
      .then(async (response) => {
        const data = await response.json().catch(() => ({})) as { error?: string; count?: number };
        if (!response.ok) throw new Error(data.error || "保存失败");
        setMessage(`已保存 ${data.count ?? 0} 个匹配项`);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "保存失败"))
      .finally(() => setPending(false));
  };

  const toggleEnabled = () => {
    const nextEnabled = !enabled;
    setEnabled(nextEnabled);
    setPending(true);
    setToggleMessage("");
    fetch("/admin/api/content-moderation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: nextEnabled }) })
      .then(async (response) => {
        const data = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) throw new Error(data.error || "保存失败");
        setToggleMessage(nextEnabled ? "审核已开启" : "审核已关闭");
      })
      .catch((error) => { setEnabled(!nextEnabled); setToggleMessage(error instanceof Error ? error.message : "保存失败"); })
      .finally(() => setPending(false));
  };

  const toggleHidden = () => {
    const next = !hidden;
    setHidden(next);
    fetch("/admin/api/content-moderation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled, hidden: next }) })
      .then(async (response) => { if (!response.ok) setHidden(!next); })
      .catch(() => setHidden(!next));
  };

  const copyPromptToTerms = (prompt: string) => {
    setTerms((current) => `${current.trim()}${current.trim() ? "，" : ""}${prompt}`);
    void navigator.clipboard?.writeText(prompt).catch(() => undefined);
    setMessage("已复制完整提示词，并放入词库编辑框。请删改成需要匹配的词或短句后保存。");
  };

  const blocked = events.filter((item) => item.action === "keyword_block");
  const review = events.filter((item) => item.action === "semantic_review" && item.status === "flagged");
  const termCount = new Set(terms.split(/[\n,，]+/).map((item) => item.trim()).filter(Boolean)).size;
  return (
    <>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-[24px] font-semibold tracking-[-0.03em]">内容审核</h1>
          {unlocked ? <RiLockUnlockLine className="h-5 w-5 text-[#367cee]" /> : <RiLockLine className="h-5 w-5 text-[#bbbbbb]" />}
          <button type="button" aria-label="页面编辑锁" onClick={toggleLock} className={`relative h-6 w-11 rounded-full transition ${unlocked ? "bg-[#367cee]" : "bg-[#d4d4d4]"}`}><span className={`absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition ${unlocked ? "left-[23px]" : "left-[3px]"}`} /></button>
          <span className="text-[12px] text-[#888888]">{unlocked ? "已解锁，可编辑" : "已锁定，点开关输入密码解锁"}</span>
        </div>
        <div className="mt-2 text-[12px] text-[#888888]">关键词命中会直接拦截生成；语义审核只记录待确认，不拦截用户。</div>
      </div>

      <div className={unlocked ? "" : "pointer-events-none select-none opacity-45"} aria-disabled={!unlocked}>
      <section className="rounded-[14px] border border-[#eeeeee] bg-white p-5 shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
        <div>
          <div>
            <div className="flex items-center gap-2 text-[16px] font-semibold text-[#222222]"><RiShieldCheckLine className="h-5 w-5 text-[#367cee]" />敏感政治内容<button type="button" aria-label="敏感政治内容开关" disabled={pending} onClick={toggleEnabled} className={`relative h-5 w-9 rounded-full transition ${enabled ? "bg-[#367cee]" : "bg-[#d4d4d4]"}`}><span className={`absolute top-[3px] h-3.5 w-3.5 rounded-full bg-white shadow transition ${enabled ? "left-[18px]" : "left-[3px]"}`} /></button>{toggleMessage ? <span className={`text-[12px] font-normal ${toggleMessage.includes("失败") ? "text-red-500" : "text-[#367cee]"}`}>{toggleMessage}</span> : null}<span className="ml-auto flex items-center gap-2">{hidden ? <RiEyeOffLine className="h-4 w-4 text-[#367cee]" /> : <RiEyeLine className="h-4 w-4 text-[#bbbbbb]" />}<button type="button" aria-label="隐藏词库开关" onClick={toggleHidden} className={`relative h-5 w-9 rounded-full transition ${hidden ? "bg-[#367cee]" : "bg-[#d4d4d4]"}`}><span className={`absolute top-[3px] h-3.5 w-3.5 rounded-full bg-white shadow transition ${hidden ? "left-[18px]" : "left-[3px]"}`} /></button></span></div>
            <div className="mt-1 text-[12px] text-[#888888]">已录入 {termCount} 个匹配项。支持换行、中文逗号、英文逗号分隔。</div>
          </div>
        </div>
        <textarea value={hidden ? maskedTerms : terms} readOnly={hidden} onChange={(event) => setTerms(event.target.value)} placeholder="每个词或短句单独写一行，也可用逗号分隔" className="mt-5 h-56 w-full resize-y rounded-[10px] border border-[#e2e2e2] p-3 text-[12px] leading-5 text-[#222222] outline-none focus:border-[#367cee]" />
        <div className="mt-3 flex items-center justify-end gap-3">{message ? <span className={`text-[12px] ${message.includes("失败") ? "text-red-500" : "text-[#367cee]"}`}>{message}</span> : null}<button type="button" disabled={pending} onClick={save} className="rounded-[8px] bg-[#111111] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50">{pending ? "保存中..." : "保存规则"}</button></div>
      </section>

  <EventTable title="已拦截记录" subtitle="命中词库后直接停止生成，不扣积分。" events={blocked} showMatchedTerm />
  <EventTable title="语义审核待确认" subtitle="关键词没命中时异步检查；目前只记录，绝不拦截。" events={review} onUsePrompt={copyPromptToTerms} />
      </div>
      {pwOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closePassword}>
          <div className="w-[320px] rounded-[14px] bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.2)]" onClick={(event) => event.stopPropagation()}>
            <div className="text-[15px] font-semibold text-[#222222]">请输入密码解锁</div>
            <div className="mt-1 text-[12px] text-[#888888]">解锁后本页可编辑；离开页面会自动重新锁定。</div>
            <input type="password" autoFocus value={pwValue} onChange={(event) => { setPwValue(event.target.value); setPwError(""); }} onKeyDown={(event) => { if (event.key === "Enter") confirmPassword(); }} placeholder="请输入密码" className="mt-4 w-full rounded-[8px] border border-[#e2e2e2] px-3 py-2 text-[13px] outline-none focus:border-[#367cee]" />
            {pwError ? <div className="mt-2 text-[12px] text-red-500">{pwError}</div> : null}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={closePassword} className="rounded-[8px] border border-[#dddddd] px-4 py-2 text-[13px] text-[#666666] hover:border-[#111111] hover:text-[#111111]">取消</button>
              <button type="button" disabled={pwPending} onClick={confirmPassword} className="rounded-[8px] bg-[#111111] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50">{pwPending ? "验证中..." : "确认"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function EventTable({ title, subtitle, events, onUsePrompt, showMatchedTerm = false }: { title: string; subtitle: string; events: ContentModerationEventRow[]; onUsePrompt?: (prompt: string) => void; showMatchedTerm?: boolean }) {
  const [page, setPage] = useState(0);
  const gridClassName = onUsePrompt ? "grid-cols-[130px_170px_110px_120px_minmax(340px,1fr)_130px]" : "grid-cols-[130px_170px_110px_120px_minmax(340px,1fr)]";
  const pageCount = Math.max(1, Math.ceil(events.length / 10));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleEvents = events.slice(currentPage * 10, currentPage * 10 + 10);
  return <section className="mt-6 overflow-hidden rounded-[14px] border border-[#eeeeee] bg-white shadow-[0_10px_28px_rgba(0,0,0,0.04)]"><div className="border-b border-[#eeeeee] px-5 py-4"><div className="font-semibold text-[#222222]">{title}</div><div className="mt-1 text-[12px] text-[#888888]">{subtitle}</div></div><div className={`grid ${gridClassName} border-b border-[#eeeeee] bg-[#fafafa] text-[12px] text-[#777777]`}><div className="px-4 py-3">时间</div><div className="px-4 py-3">用户</div><div className="px-4 py-3">来源</div><div className="px-4 py-3">{showMatchedTerm ? "命中" : "结果"}</div><div className="px-4 py-3">完整提示词</div>{onUsePrompt ? <div className="px-4 py-3">操作</div> : null}</div>{events.length ? <>{visibleEvents.map((item) => <div key={item.id} className={`grid ${gridClassName} border-b border-[#f0f0f0] text-[12px] leading-5 text-[#444444] last:border-b-0`}><div className="whitespace-nowrap px-4 py-3 text-[#888888]">{item.createdAtLabel}</div><div className="whitespace-pre-line break-all px-4 py-3">{item.userLabel}</div><div className="px-4 py-3">{item.sourceLabel} / {item.kindLabel}</div><div className="px-4 py-3">{showMatchedTerm ? <span className="text-[#d95d35]">{item.matchedTerm ?? "-"}</span> : <><div>{item.status === "flagged" ? "疑似命中" : item.status === "clear" ? "正常" : item.status === "blocked" ? "已拦截" : item.status === "error" ? "审核失败" : "待审核"}</div>{item.matchedTerm ? <div className="mt-1 text-[#d95d35]">命中：{item.matchedTerm}</div> : null}{item.semanticReason ? <div className="mt-1 text-[#888888]">{item.semanticReason}</div> : null}</>}</div><div className="whitespace-pre-wrap break-words px-4 py-3 text-[#222222]">{item.prompt}</div>{onUsePrompt ? <div className="px-4 py-3"><button type="button" onClick={() => onUsePrompt(item.prompt)} className="inline-flex items-center gap-1 rounded-[6px] border border-[#dddddd] px-2 py-1 text-[#666666] hover:border-[#111111] hover:text-[#111111]"><RiFileCopyLine className="h-3 w-3" />加入词库</button></div> : null}</div>)}{pageCount > 1 ? <div className="flex items-center justify-end gap-2 px-5 py-3 text-[12px] text-[#777777]"><button type="button" disabled={currentPage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} className="rounded-[6px] border border-[#dddddd] px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40">上一页</button><span>第 {currentPage + 1} / {pageCount} 页</span><button type="button" disabled={currentPage >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} className="rounded-[6px] border border-[#dddddd] px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40">下一页</button></div> : null}</> : <div className="px-5 py-8 text-center text-[13px] text-[#999999]">暂无记录</div>}</section>;
}
