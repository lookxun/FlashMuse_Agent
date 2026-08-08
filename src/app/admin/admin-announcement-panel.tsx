"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnnouncementBar } from "@/components/announcement-banner";

export type AnnouncementHistoryRow = { version: string; content: string; createdAtLabel: string; dismissed: number };

export function AdminAnnouncementPanel({ initialEnabled, initialContent, dismissedCount, history }: { initialEnabled: boolean; initialContent: string; dismissedCount: number; history: AnnouncementHistoryRow[] }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [content, setContent] = useState(initialContent);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [page, setPage] = useState(0);
  const [confirmMode, setConfirmMode] = useState<null | "open" | "close">(null);
  // 已落库的草稿内容。⛔ 点开关时 textarea 会先触发一次 blur，若不比对就会白发一次 save 请求，
  // 和紧随其后的 open 请求并发、把"已开启"的提示覆盖成"草稿已保存"。内容没变就不发。
  const savedContentRef = useRef(initialContent);
  // 开启/关闭动作的序号：草稿保存回来时若序号已变，说明期间用户已经点了开关，
  // 此时不许再把提示语覆盖成"草稿已保存"（两个请求是并发的）。
  const actionSeqRef = useRef(0);

  const pageSize = 15;
  const pageCount = Math.max(1, Math.ceil(history.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleHistory = history.slice(currentPage * pageSize, currentPage * pageSize + pageSize);
  const hasContent = content.trim().length > 0;

  // ⛔⛔ `pending` 只跟踪「开启/关闭」这两个动作，**绝不能**把草稿保存也算进去：
  //    点开关时 textarea 先 blur → 触发草稿保存 → 若它把 pending 置 true，
  //    紧接着的 click 就会被下面 `if (pending) return` 吞掉 =「输入文案后第一次点开关没反应」
  //    （2026-08-09 在测试服 v84 真机复现过，必须两个状态分开）。
  const request = (action: "open" | "close" | "save", onOk?: () => void) => {
    const isDraftSave = action === "save";
    if (!isDraftSave) setPending(true);
    const seqAtStart = isDraftSave ? actionSeqRef.current : (actionSeqRef.current += 1);
    setMessage("");
    fetch("/admin/api/announcement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, content }) })
      .then(async (response) => {
        const data = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) throw new Error(data.error || "保存失败");
        if (isDraftSave && actionSeqRef.current !== seqAtStart) return; // 已被开启/关闭动作接管，别覆盖提示
        setMessage(action === "open" ? "已开启，前台刷新即可看到公告。" : action === "close" ? "已关闭，本次投放已计入下方记录。" : "草稿已保存。");
        onOk?.();
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "保存失败"))
      .finally(() => { if (!isDraftSave) setPending(false); });
  };

  const toggleEnabled = () => {
    if (pending) return;
    if (!enabled) {
      if (!hasContent) return; // 无内容不能开启（开关此时也是禁用态）
      setConfirmMode("open");
      return;
    }
    setConfirmMode("close");
  };

  const confirmOpen = () => {
    setConfirmMode(null);
    setEnabled(true);
    savedContentRef.current = content; // open 请求本身也会把文案写库
    // ⭐ 必须 refresh：开启会生成新的 runId，"本次已关闭用户数量"要从 0 重新算
    //    （它是服务端算好的 prop，不刷新会一直显示上一次投放的数字）。
    request("open", () => router.refresh());
  };

  const confirmClose = () => {
    setConfirmMode(null);
    setEnabled(false);
    // 关闭会新增一条历史记录，刷新服务端数据把它显示出来。
    request("close", () => router.refresh());
  };

  const toggleDisabled = pending || (!enabled && !hasContent);

  return (
    <>
      {/* 预览：右侧内容区顶部通栏**铺满**（-mx-8 -mt-6 抵消 AdminShell 的 px-8 py-6）。
          ⭐ 必须复用前台那个 AnnouncementBar —— 高度/字号/颜色/走马灯行为与用户看到的完全一致，
          ⛔ 别在这里另写一份长相（原来就是各写一份，改了前台这里不会跟着变）。
          ⛔ 也别按"视口宽度"去限制它（2026-08-09 试过、被用户否掉）：后台页在窄屏下有横向滚动、
             右侧内容区比视口更宽，限制成视口宽会让预览条**铺不满右侧**、露出底色。
             用户要的是铺满 → 宽度跟随内容区，走马灯按这个宽度判断。 */}
      <div className="-mx-8 -mt-6 mb-6">
        <AnnouncementBar content={content || "（公告文案预览）"} />
      </div>

      <div className="mb-6">
        <h1 className="text-[24px] font-semibold tracking-[-0.03em]">顶部公告</h1>
        <div className="mt-2 text-[12px] text-[#888888]">输入文案后开启开关（需二次确认）即向所有用户显示；关闭开关（需二次确认）结束本次投放，下方记录会多一条。</div>
      </div>

      <section className="rounded-[14px] border border-[#eeeeee] bg-white p-5 shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2 text-[16px] font-semibold text-[#222222]">
          公告文案
          <span className="ml-auto flex items-center gap-2">
            {message ? <span className={`text-[12px] font-normal ${message.includes("失败") ? "text-red-500" : "text-[#367cee]"}`}>{message}</span> : null}
            <button type="button" aria-label="公告显示开关" disabled={toggleDisabled} onClick={toggleEnabled} className={`relative h-5 w-9 rounded-full transition ${enabled ? "bg-[#367cee]" : "bg-[#d4d4d4]"} ${toggleDisabled ? "cursor-not-allowed opacity-50" : ""}`}><span className={`absolute top-[3px] h-3.5 w-3.5 rounded-full bg-white shadow transition ${enabled ? "left-[18px]" : "left-[3px]"}`} /></button>
          </span>
        </div>
        <div className="mt-1 text-[12px] text-[#888888]">最多 500 字，可含 emoji。输入框为空时开关不可点；开启状态下文案锁定，需先关闭才能修改。</div>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value.slice(0, 500))}
          onBlur={() => { if (!enabled && content !== savedContentRef.current) { savedContentRef.current = content; request("save"); } }}
          maxLength={500}
          rows={1}
          disabled={enabled}
          placeholder="例：💥 Seedance 2.5 震撼上线！年付会员最高赠送 20 次生成，年付订阅低至 5 折"
          className="mt-5 w-full resize-y rounded-[10px] border border-[#e2e2e2] p-3 text-[12px] leading-5 text-[#222222] outline-none focus:border-[#367cee] disabled:cursor-not-allowed disabled:bg-[#f5f5f5] disabled:text-[#999999]"
        />
        <div className="mt-2 text-[12px] text-[#888888]">本次已关闭用户数量：{dismissedCount}</div>
      </section>

      <section className="mt-6 overflow-hidden rounded-[10px] border border-[#eeeeee] bg-white shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
        <div className="grid grid-cols-[180px_minmax(340px,1fr)_110px] border-b border-[#eeeeee] bg-[#fafafa] text-[13px] font-medium text-[#777777]">
          <div className="px-4 py-3">发公告时间</div>
          <div className="px-4 py-3">公告内容</div>
          <div className="px-4 py-3">关闭数量</div>
        </div>
        {history.length ? (
          visibleHistory.map((item) => (
            <div key={item.version} className="grid grid-cols-[180px_minmax(340px,1fr)_110px] border-b border-[#f0f0f0] text-[13px] leading-5 text-[#444444] last:border-b-0">
              <div className="whitespace-nowrap px-4 py-3 text-[#888888]">{item.createdAtLabel}</div>
              <div className="whitespace-pre-wrap break-words px-4 py-3 text-[#222222]">{item.content}</div>
              <div className="px-4 py-3">{item.dismissed}</div>
            </div>
          ))
        ) : (
          <div className="px-4 py-6 text-center text-[13px] text-[#999999]">暂无发布记录</div>
        )}
        {history.length > pageSize ? (
          <div className="flex items-center justify-end gap-3 px-5 py-3 text-[12px] text-[#666666]">
            <span>第 {currentPage + 1} / {pageCount} 页</span>
            <button type="button" disabled={currentPage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} className="rounded-[6px] border border-[#dddddd] px-3 py-1 disabled:opacity-40 hover:border-[#111111] hover:text-[#111111]">上一页</button>
            <button type="button" disabled={currentPage >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} className="rounded-[6px] border border-[#dddddd] px-3 py-1 disabled:opacity-40 hover:border-[#111111] hover:text-[#111111]">下一页</button>
          </div>
        ) : null}
      </section>

      {confirmMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmMode(null)}>
          <div className="w-[340px] rounded-[14px] bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.2)]" onClick={(event) => event.stopPropagation()}>
            <div className="text-[15px] font-semibold text-[#222222]">{confirmMode === "open" ? "确定开启公告？" : "确定关闭公告？"}</div>
            <div className="mt-2 text-[12px] leading-5 text-[#888888]">{confirmMode === "open" ? "开启后会立即向所有登录用户显示这条公告，并锁定文案不可编辑（需先关闭才能修改）。" : "关闭后公告立即下线，本次投放会计入下方发布记录（含本次关闭人数）。"}</div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setConfirmMode(null)} className="rounded-[8px] border border-[#dddddd] px-4 py-2 text-[13px] text-[#666666] hover:border-[#111111] hover:text-[#111111]">取消</button>
              <button type="button" disabled={pending} onClick={confirmMode === "open" ? confirmOpen : confirmClose} className="rounded-[8px] bg-[#111111] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50">{confirmMode === "open" ? "确定开启" : "确定关闭"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
