"use client";

import { useEffect, useState } from "react";

type ServerInfoRow = {
  title: string;
  ali: string;
  malaysia: string;
};

function getDiskUsedPercent(value: string) {
  const match = value.match(/已用\s*(\d+(?:\.\d+)?)%/);
  if (!match) return null;
  const percent = Number(match[1]);
  if (!Number.isFinite(percent)) return null;
  return Math.max(0, Math.min(100, percent));
}

function ServerInfoCell({ rowTitle, value }: { rowTitle: string; value: string }) {
  const diskUsedPercent = rowTitle.startsWith("硬盘") ? getDiskUsedPercent(value) : null;

  return (
    <div className="break-words px-5 py-3 font-mono text-[12px] text-[#333333]">
      <div>{value}</div>
      {diskUsedPercent !== null ? (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#edf2ff]">
            <div className="h-full rounded-full bg-[#367cee]" style={{ width: `${diskUsedPercent}%` }} />
          </div>
          <span className="shrink-0 text-[11px] font-medium text-[#367cee]">{diskUsedPercent}%</span>
        </div>
      ) : null}
    </div>
  );
}

export function AdminServerInfoPanel() {
  const [rows, setRows] = useState<ServerInfoRow[]>([]);
  const [message, setMessage] = useState("");
  const [refreshedAt, setRefreshedAt] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const refreshServerInfo = async () => {
    setIsLoading(true);
    setMessage("");
    try {
      const response = await fetch("/admin/api/server-info", { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as { error?: string; rows?: ServerInfoRow[]; refreshedAt?: string };
      if (!response.ok || !Array.isArray(data.rows)) throw new Error(data.error || "读取服务器信息失败");
      setRows(data.rows);
      setRefreshedAt(data.refreshedAt ? new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(data.refreshedAt)) : "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "读取服务器信息失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshServerInfo();
  }, []);

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-[24px] font-semibold tracking-[-0.03em]">服务器信息</h1>
        <div className="flex items-center gap-3">
          {refreshedAt ? <span className="text-[12px] text-[#888888]">最近刷新：{refreshedAt}</span> : null}
          <button type="button" disabled={isLoading} onClick={() => void refreshServerInfo()} className="h-8 rounded-[8px] bg-[#111111] px-4 text-[12px] font-medium text-white transition hover:bg-[#333333] disabled:cursor-not-allowed disabled:bg-[#bcbcbc]">
            {isLoading ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      <section className="min-w-[1180px] overflow-hidden rounded-[10px] border border-[#eeeeee] bg-white text-[13px] shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
        <div className="border-b border-[#eeeeee] bg-[#fafafa] px-5 py-4">
          <div className="text-[15px] font-medium text-[#222222]">服务器运行状态</div>
          <div className="mt-1 text-[12px] leading-5 text-[#888888]">显示两台服务器硬盘、网速、带宽和基础运行状态。硬盘容量单位为 G，保留三位小数。</div>
        </div>
        {message ? <div className="border-b border-[#f2f2f2] px-5 py-3 text-[12px] text-red-500">{message}</div> : null}
        <div className="grid grid-cols-[260px_460px_460px] border-b border-[#eeeeee] bg-[#fafafa] text-[12px] font-medium text-[#777777]">
          <div className="px-5 py-3">内容标题</div>
          <div className="px-5 py-3">阿里服务器</div>
          <div className="px-5 py-3">马来服务器</div>
        </div>
        {rows.length > 0 ? rows.map((row) => (
          <div key={row.title} className="grid grid-cols-[260px_460px_460px] border-b border-[#f2f2f2] text-[12px] leading-5 text-[#444444] last:border-b-0">
            <div className="px-5 py-3 font-medium text-[#222222]">{row.title}</div>
            <ServerInfoCell rowTitle={row.title} value={row.ali} />
            <ServerInfoCell rowTitle={row.title} value={row.malaysia} />
          </div>
        )) : (
          <div className="px-5 py-8 text-center text-[13px] text-[#999999]">{isLoading ? "正在读取服务器信息..." : "点击刷新读取服务器信息"}</div>
        )}
      </section>
    </>
  );
}
