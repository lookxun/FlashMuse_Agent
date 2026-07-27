"use client";

import { formatMediaClockTime } from "@/lib/media-duration-format";

export interface MediaDurationBadgeProps {
  /** 真实时长（秒）。<=0 或非法时不渲染。 */
  seconds?: number;
  /** 角标位置，默认左上角（与音频卡时间显示同位置）。 */
  position?: "top-left" | "top-right";
  className?: string;
}

/**
 * 媒体时长角标（全平台统一）：叠在视频/音频缩略图角上显示 `mm:ss`。
 * 尺寸/字号/圆角与音频卡左上角时间显示一致；因为要叠在任意封面上，用深底白字保证可读。
 */
export function MediaDurationBadge({ seconds, position = "top-left", className }: MediaDurationBadgeProps) {
  if (!Number.isFinite(seconds ?? Number.NaN) || (seconds ?? 0) <= 0) return null;
  const place = position === "top-right" ? "right-2 top-2" : "left-2 top-2";
  return (
    <span className={`pointer-events-none absolute z-20 rounded bg-black/45 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white backdrop-blur-sm ${place} ${className ?? ""}`}>
      {formatMediaClockTime(seconds ?? 0)}
    </span>
  );
}

export default MediaDurationBadge;
