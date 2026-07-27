"use client";

import { RiPlayLargeFill } from "react-icons/ri";

// 全平台统一：视频缩略图/封面中间的「播放按钮」标记，表示这是视频。
// 对话流·工作流·资产库·@引用·图层面板·上传缩略图等所有视频小图统一走它，禁止再各写一份 overlay。
export type VideoPlayBadgeSize = "xs" | "sm" | "md" | "lg" | "xl";

const BADGE_SIZE: Record<VideoPlayBadgeSize, string> = {
  xs: "h-5 w-5",
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-12 w-12",
  xl: "h-14 w-14",
};

const ICON_SIZE: Record<VideoPlayBadgeSize, string> = {
  xs: "h-3 w-3",
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
  xl: "h-7 w-7",
};

export function VideoPlayBadge({ size = "md", className }: { size?: VideoPlayBadgeSize; className?: string }) {
  return (
    <span className={`pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/42 text-white shadow-[0_8px_24px_rgba(0,0,0,0.22)] backdrop-blur-[4px] ${BADGE_SIZE[size]} ${className ?? ""}`}>
      <RiPlayLargeFill className={`ml-0.5 ${ICON_SIZE[size]}`} aria-hidden="true" />
    </span>
  );
}
