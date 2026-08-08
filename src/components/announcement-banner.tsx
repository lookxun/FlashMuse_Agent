"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { RiCloseLine } from "react-icons/ri";

/**
 * 顶部公告「那一条横幅」的唯一外观实现 —— 前台横幅（AnnouncementBanner）与
 * 后台「顶部公告」页的预览条**必须共用它**，否则两边长相会各自演化。
 * ⛔ 禁止在别处再手写一遍那串 className / 走马灯逻辑。
 *
 * 规则（2026-08-09 用户拍板）：
 * - 高度**固定 50px 永不变**；文案**永远只显示一行、绝不换行**。
 * - 一行放得下 → 居中静态显示。
 * - 一行放不下 → 变**走马灯**：从右往左缓慢匀速移动、首尾空几格、循环相接（无缝）。
 */
export const ANNOUNCEMENT_BAR_HEIGHT_PX = 50;

// 走马灯速度（px/秒）。⭐ 用"匀速"而不是"固定时长"：否则文案越长滚得越快、长公告会快到看不清。
// 30 = 2026-08-09 用户拍板（约每秒 2 个汉字，偏慢、好读）。改这个数字就是改速度，与文案长度无关。
const MARQUEE_SPEED_PX_PER_SECOND = 30;
// 首尾间隔（px）：一圈的尾巴和下一圈的头之间留的空，"空几格"。
const MARQUEE_GAP_PX = 96;
// 静态居中那一档左右留的呼吸空间（对应下面那个 px-4 × 2）。
// ⭐ 判定溢出时要把它减掉：否则会出现"刚好放得下但左右完全贴边"的难看临界状态。
const STATIC_PADDING_TOTAL_PX = 32;

export function AnnouncementBar({ content, canDismiss = false, onDismiss }: { content: string; canDismiss?: boolean; onDismiss?: () => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [textWidth, setTextWidth] = useState(0);

  // 是否放不下：拿"文案单行自然宽度"和"可用宽度"比。
  // ⭐ 用 ResizeObserver 盯容器（不只听 window resize）—— 后台侧边栏折叠、右侧内容区宽度变化
  //    这类"窗口没变但容器变了"的情况也能重测；后台预览条宽度跟随内容区，正是这种情况。
  useLayoutEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      const text = measureRef.current;
      if (!container || !text) return;
      const available = container.clientWidth - STATIC_PADDING_TOTAL_PX;
      const width = text.scrollWidth;
      setTextWidth(width);
      setOverflowing(width > available);
    };
    measure();
    // 字体可能晚于首帧就绪（自定义字体会让测量偏小）→ 就绪后再量一次。
    if (typeof document !== "undefined" && "fonts" in document) {
      void (document as Document & { fonts: FontFaceSet }).fonts.ready.then(measure).catch(() => undefined);
    }
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      observer = new ResizeObserver(() => measure());
      observer.observe(containerRef.current);
    }
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [content]);

  const cycle = textWidth + MARQUEE_GAP_PX;
  const durationSeconds = cycle > 0 ? cycle / MARQUEE_SPEED_PX_PER_SECOND : 0;

  return (
    <div
      className="flex w-full shrink-0 items-center overflow-hidden bg-[#e1ff67] text-[15px] font-medium text-slate-900"
      style={{ height: ANNOUNCEMENT_BAR_HEIGHT_PX, lineHeight: `${ANNOUNCEMENT_BAR_HEIGHT_PX}px` }}
    >
      {/*
        滚动区：⛔⛔ 给右侧的 × 留位**只能靠 flex 兄弟节点真正占宽**，
        绝不能用这个容器的 `padding-right` —— CSS 的 `overflow:hidden` 裁剪到 **padding box**，
        也就是说内容会照样画在 padding 区域里、**滚到 × 底下**（2026-08-09 窄屏实测重叠过）。
        所以这里不放左右 padding，裁剪边界就是 × 的左边。
      */}
      <div ref={containerRef} className="relative h-full min-w-0 flex-1 overflow-hidden">
        {/* 测量用的隐形副本：始终单行、不换行，用它的 scrollWidth 判断放不放得下 */}
        <span ref={measureRef} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 whitespace-pre">
          {content}
        </span>

        {overflowing ? (
          <div
            className="flashmuse-announcement-marquee flex h-full w-max items-center whitespace-pre will-change-transform"
            style={{ ["--flashmuse-marquee-shift" as string]: `-${cycle}px`, animationDuration: `${durationSeconds}s` }}
          >
            <span className="whitespace-pre">{content}</span>
            <span aria-hidden="true" style={{ width: MARQUEE_GAP_PX }} className="shrink-0" />
            {/* 第二份副本让首尾相接：第一份滚走的同时第二份正好补位 → 无缝循环 */}
            <span aria-hidden="true" className="whitespace-pre">{content}</span>
            <span aria-hidden="true" style={{ width: MARQUEE_GAP_PX }} className="shrink-0" />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center px-4">
            <span className="whitespace-pre">{content}</span>
          </div>
        )}
      </div>

      {canDismiss ? (
        <div className="flex h-full w-12 shrink-0 items-center justify-center">
          <button
            type="button"
            onClick={onDismiss}
            aria-label="关闭公告"
            className="flex h-8 w-8 items-center justify-center rounded-[8px] text-slate-700 transition hover:bg-black/10"
          >
            <RiCloseLine className="h-6 w-6" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

const DISMISS_STORAGE_KEY = "flashmuse-announcement-dismissed-version";

type AnnouncementState = { content: string; version: string };

// 主工作台/首页顶部通栏公告。
// 用户点 × 关闭后按 version(=本次投放 runId) 记进 localStorage；开启新一次 → runId 变 → 重新弹给所有人。
// 首屏拉一次 /api/announcement，之后靠 checkAuth(每5秒) 广播的 "flashmuse-announcement" 事件
// 准实时更新（无需刷新，切页面也能出现/消失），不新增请求。
// canDismiss=false（未登录）时不显示 × —— 因为关闭要按 userId 记录，未登录无法记，故不给关。
export function AnnouncementBanner({ canDismiss = true }: { canDismiss?: boolean }) {
  const [announcement, setAnnouncement] = useState<AnnouncementState | null>(null);

  useEffect(() => {
    let cancelled = false;

    const apply = (data: { enabled?: boolean; content?: string; version?: string } | null) => {
      if (cancelled) return;
      if (!data?.enabled || !data.content || !data.version) {
        setAnnouncement(null); // 已关闭/无公告 → 横幅消失
        return;
      }
      let dismissed: string | null = null;
      try {
        dismissed = window.localStorage.getItem(DISMISS_STORAGE_KEY);
      } catch {
        dismissed = null;
      }
      if (dismissed === data.version) {
        setAnnouncement(null);
        return;
      }
      setAnnouncement({ content: data.content, version: data.version });
    };

    fetch("/api/announcement", { cache: "no-store" })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data) => apply(data))
      .catch(() => undefined);

    const onEvent = (event: Event) => apply((event as CustomEvent).detail ?? null);
    window.addEventListener("flashmuse-announcement", onEvent);

    return () => {
      cancelled = true;
      window.removeEventListener("flashmuse-announcement", onEvent);
    };
  }, []);

  if (!announcement) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, announcement.version);
    } catch {
      /* ignore */
    }
    void fetch("/api/announcement/dismiss", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: announcement.version }) }).catch(() => undefined);
    setAnnouncement(null);
  };

  return <AnnouncementBar content={announcement.content} canDismiss={canDismiss} onDismiss={dismiss} />;
}
