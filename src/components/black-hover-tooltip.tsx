"use client";

import { ReactNode, useRef, useState } from "react";

/**
 * 通用「黑底悬浮提示框」——**全站唯一实现**（对话流 / 资产库 / 工作流画布共用）。
 *
 * 2026-08-09 从 `lib/chat/chat-workbench-core.tsx` 搬到这里：工作流画布也要用它
 * （提示词超字数时给发送键加说明），而 workflow-tldraw-canvas-inner **不能** import chat-workbench-core
 * （会绕成循环依赖）。⭐ `chat-workbench-core` 里已**再导出**这个符号，老 import 路径不用改。
 *
 * ⭐ 用法：`label={条件 ? "文案" : ""}` —— label 为空时整个气泡不渲染（不会 hover 出一个空黑块）。
 * ⭐ 给 disabled 的按钮做说明时也能用：CSS `:hover` 对 disabled 子元素的祖先仍然生效
 *   （JS 的边缘对齐可能不触发，退化成居中显示，可接受）。
 * ⛔ 别再用原生 `title=`（样式不统一、出现慢），也别各写一份黑底 div。
 */
export function BlackHoverTooltip({ label, children, className = "", side = "top" }: { label: ReactNode; children: ReactNode; className?: string; side?: "top" | "bottom" }) {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [horizontalAlign, setHorizontalAlign] = useState<"left" | "center" | "right">("center");
  const [verticalSide, setVerticalSide] = useState<"top" | "bottom">(side);
  const alignClass = horizontalAlign === "left" ? "left-0" : horizontalAlign === "right" ? "right-0" : "left-1/2 -translate-x-1/2";
  const positionClass = verticalSide === "bottom" ? "top-full mt-2" : "bottom-full mb-2";

  const updateTooltipAlign = () => {
    const wrapper = wrapperRef.current;
    const tooltip = tooltipRef.current;
    if (!wrapper || !tooltip) return;

    const margin = 8;
    const wrapperRect = wrapper.getBoundingClientRect();
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    const centeredLeft = wrapperRect.left + wrapperRect.width / 2 - tooltipWidth / 2;
    const centeredRight = centeredLeft + tooltipWidth;

    if (centeredLeft < margin) {
      setHorizontalAlign("left");
    } else if (centeredRight > window.innerWidth - margin) {
      setHorizontalAlign("right");
    } else {
      setHorizontalAlign("center");
    }

    if (side === "top" && wrapperRect.top - tooltipHeight - margin < margin) {
      setVerticalSide("bottom");
    } else if (side === "bottom" && wrapperRect.bottom + tooltipHeight + margin > window.innerHeight - margin) {
      setVerticalSide("top");
    } else {
      setVerticalSide(side);
    }
  };

  return (
    <span ref={wrapperRef} onMouseEnter={updateTooltipAlign} onFocus={updateTooltipAlign} className={`group/black-tooltip relative inline-flex ${className}`}>
      {children}
      {/* ⭐ label 为空（""/null/false）时**整个气泡不渲染** —— 否则会 hover 出一个空的黑方块。 */}
      {label ? (
        <span ref={tooltipRef} className={`pointer-events-none absolute ${alignClass} z-[9999] ${positionClass} whitespace-nowrap rounded-lg bg-[#111111] px-3 py-2 text-[12px] font-medium leading-none text-white opacity-0 shadow-[0_8px_18px_rgba(0,0,0,0.18)] transition group-hover/black-tooltip:opacity-100`}>
          {label}
        </span>
      ) : null}
    </span>
  );
}
