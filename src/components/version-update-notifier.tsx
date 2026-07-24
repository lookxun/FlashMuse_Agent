"use client";

import { useEffect, useRef, useState } from "react";
import { APP_VERSION } from "@/lib/app-version";

// 发现新版本提示条：
// - 不专门轮询、不开长连接；拦截页面自己发出的 fetch，顺带读服务端在 /api/* 响应里带的 x-app-version 头。
// - 只有服务端「已发布版本」数值上 > 本 bundle 打死的 APP_VERSION 时才弹（升级方向），点「刷新」重载拿新版。
// - 点「×」忽略当前版本（记住），不再反复弹；除非服务端又升到更高版本号才重新弹。
// - 服务端只有在「完全部署完（含静态同步）」后才把该头置为新版，保证弹出时刷新必正常、不会白屏。

// 把 "vAA.BB.CC.DD" 解析成可比较的数值（四段 100 进制）。解析失败返回 -1。
function parseVersion(value: string | null | undefined): number {
  if (!value) return -1;
  const m = value.trim().match(/^v(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return -1;
  return ((Number(m[1]) * 100 + Number(m[2])) * 100 + Number(m[3])) * 100 + Number(m[4]);
}

export function VersionUpdateNotifier() {
  const [newVersion, setNewVersion] = useState<string | null>(null);
  // 左侧主菜单宽度（展开 262 / 收起 80 / 隐藏 0，动态）。用于让提示条只在「右侧内容区」左右居中，不算上主菜单。
  const [sidebarWidth, setSidebarWidth] = useState(0);
  const dismissedRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.fetch !== "function") return;
    const originalFetch = window.fetch.bind(window);
    let patched = true;
    const localVersionNum = parseVersion(APP_VERSION);

    const check = (serverVersion: string | null) => {
      if (!serverVersion) return;
      if (serverVersion === dismissedRef.current) return;
      // 只在服务端版本数值更高时提示（升级方向）；解析失败或不更高都不弹。
      const serverNum = parseVersion(serverVersion);
      if (serverNum < 0 || localVersionNum < 0) return;
      if (serverNum <= localVersionNum) return;
      setNewVersion(serverVersion);
    };

    window.fetch = (async (...args: Parameters<typeof fetch>) => {
      const response = await originalFetch(...args);
      try {
        check(response.headers.get("x-app-version"));
      } catch {
        // 读头失败（如跨域不可读）静默忽略，绝不影响原始 fetch 行为。
      }
      return response;
    }) as typeof fetch;

    return () => {
      if (patched && window.fetch !== originalFetch) window.fetch = originalFetch;
      patched = false;
    };
  }, []);

  // 量左侧主菜单实际宽度，随其展开/收起/隐藏变化实时更新，让提示条中心右移半个菜单宽 = 在右侧内容区居中。
  useEffect(() => {
    if (typeof window === "undefined") return;
    const measure = () => {
      const el = document.querySelector(".flashmuse-sidebar");
      const width = el ? Math.round((el as HTMLElement).getBoundingClientRect().width) : 0;
      setSidebarWidth(width);
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    const el = document.querySelector(".flashmuse-sidebar");
    if (ro && el) ro.observe(el);
    window.addEventListener("resize", measure);
    const timer = window.setInterval(measure, 1000); // 兜底：菜单显隐（display:none）RO 不一定触发
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
      window.clearInterval(timer);
    };
  }, []);

  if (!newVersion) return null;

  const handleDismiss = () => {
    dismissedRef.current = newVersion;
    setNewVersion(null);
  };

  const handleReload = () => {
    // 强制刷新：给当前 URL 换一个时间戳参数再跳转，绕过 HTML 文档缓存，确保拿到最新页面与新哈希的 chunk。
    // 用 replace 避免往历史里塞一条带参数的记录。全浏览器支持。
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("_v", Date.now().toString());
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  };

  return (
    <div
      style={{ position: "fixed", top: 16, left: `calc(50% + ${sidebarWidth / 2}px)`, transform: "translateX(-50%)", zIndex: 2147483647 }}
      className="pointer-events-none flex justify-center"
    >
      <div
        className="pointer-events-auto flex items-center gap-3 bg-white px-4"
        style={{ width: 360, height: 60, borderRadius: 10, border: "1px solid #d9d9d9", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
        role="alert"
      >
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
          <span className="truncate text-[14px] font-medium text-[#1a1a1a]">发现新版本 {newVersion}！</span>
          <span className="truncate text-[12px] leading-tight text-[#9ca3af]">或 <span className="text-[#367cee]">CTRL+F5</span> 强制刷新即可加载新版本！</span>
        </div>
        <button
          type="button"
          onClick={handleReload}
          className="shrink-0 rounded-[8px] bg-black px-3 py-1.5 text-[13px] font-medium text-white transition-opacity hover:opacity-80"
        >
          刷新
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="关闭"
          style={{ fontSize: 30, lineHeight: 1, fontWeight: 300 }}
          className="shrink-0 text-[#8c8c8c] transition-colors hover:text-[#1a1a1a]"
        >
          ×
        </button>
      </div>
    </div>
  );
}
