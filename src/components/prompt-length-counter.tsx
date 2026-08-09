"use client";

import { formatPromptCounter } from "@/lib/prompt-length";

/**
 * 提示词字数计数器（对话流 / 工作流 / 资产库**共用这一份**，⛔ 别再各写一份）。
 *
 * ⭐⭐ 2026-08-09 用户拍板的形态（⛔ 别自己改成别的样子）：
 * - **它是输入框里的独立一行**，不是浮在文字上的绝对定位层 —— 用户要的是
 *   「整个输入框加高一个字的高度、把输入区域往下移一行」，**绝不加宽、绝不压住第一行文字**。
 * - 位置**居右**、**灰字**、字号比正文小一档（正文 13~14px → 这里 11px）。
 * - **有内容才显示数字**；但这一行**始终占位**（`h-[18px]`），
 *   ⛔ 别做成"有内容才渲染整行" —— 那样一打字整个输入框会跳高一行。
 * - 超限时数字变红（红只表示"该删字了"，字**不会**被删）。
 *
 * ⭐ 工作流传的是**合计**（输入框 + 连接的文本节点），因为那边的限制本身就是合计。
 */
export function PromptLengthCounterRow({
  used,
  maxLength,
  className = "",
}: {
  used: number;
  maxLength: number;
  className?: string;
}) {
  const over = used > maxLength;

  return (
    <div className={`pointer-events-none flex h-[18px] shrink-0 items-center justify-end pr-1 ${className}`}>
      {used > 0 ? (
        <span className={`text-[11px] leading-[18px] tabular-nums ${over ? "text-red-500" : "text-[#aaaaaa]"}`} aria-live="polite">
          {formatPromptCounter(used, maxLength)}
        </span>
      ) : null}
    </div>
  );
}
