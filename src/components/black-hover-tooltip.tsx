"use client";

import { ReactNode, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * 通用「黑底悬浮提示框」——**全站唯一实现**（对话流 / 资产库 / 工作流画布共用）。
 *
 * 2026-08-09 从 `lib/chat/chat-workbench-core.tsx` 搬到这里：工作流画布也要用它
 * （提示词超字数时给发送键加说明），而 workflow-tldraw-canvas-inner **不能** import chat-workbench-core
 * （会绕成循环依赖）。⭐ `chat-workbench-core` 里已**再导出**这个符号，老 import 路径不用改。
 *
 * ⭐ 用法：`label={条件 ? "文案" : ""}` —— label 为空时整个气泡不渲染（不会 hover 出一个空黑块）。
 * ⭐ 给 disabled 的按钮做说明时也能用：鼠标进的是外层 span，不受里面 disabled 影响。
 * ⛔ 别再用原生 `title=`（样式不统一、出现慢），也别各写一份黑底 div。
 * ⭐ 气泡挂到 `document.body` + `position:fixed`，不被侧栏/输入框/画布的层叠上下文挡住。
 */
const BLACK_HOVER_TIP_Z = 13000;

export function BlackHoverTooltip({ label, children, className = "", side = "top" }: { label: ReactNode; children: ReactNode; className?: string; side?: "top" | "bottom" }) {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ left: number; top: number } | null>(null);

  const updatePosition = () => {
    const wrapper = wrapperRef.current;
    const tooltip = tooltipRef.current;
    if (!wrapper || !tooltip) return;
    const margin = 8;
    const gap = 8;
    const wrapperRect = wrapper.getBoundingClientRect();
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    let left = wrapperRect.left + wrapperRect.width / 2 - tooltipWidth / 2;
    left = Math.min(Math.max(margin, left), Math.max(margin, window.innerWidth - margin - tooltipWidth));
    let top = side === "top" ? wrapperRect.top - tooltipHeight - gap : wrapperRect.bottom + gap;
    if (side === "top" && top < margin) top = wrapperRect.bottom + gap;
    if (side === "bottom" && top + tooltipHeight > window.innerHeight - margin) top = wrapperRect.top - tooltipHeight - gap;
    top = Math.min(Math.max(margin, top), Math.max(margin, window.innerHeight - margin - tooltipHeight));
    setBox({ left, top });
  };

  useLayoutEffect(() => {
    if (!open || !label) return;
    updatePosition();
  }, [open, label, side]);

  return (
    <span
      ref={wrapperRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      className={`relative inline-flex ${className}`}
    >
      {children}
      {label && open && typeof document !== "undefined" ? createPortal(
        <span
          ref={tooltipRef}
          className="pointer-events-none fixed whitespace-nowrap rounded-lg bg-[#111111] px-3 py-2 text-[12px] font-medium leading-none text-white shadow-[0_8px_18px_rgba(0,0,0,0.18)]"
          style={{ left: box?.left ?? 0, top: box?.top ?? 0, zIndex: BLACK_HOVER_TIP_Z, visibility: box ? "visible" : "hidden" }}
        >
          {label}
        </span>,
        document.body,
      ) : null}
    </span>
  );
}
