import { RiImage2Line, RiImageCircleLine, RiMultiImageLine } from "react-icons/ri";
import type { IconType } from "react-icons";
import { isHailuo3VideoModel, type VideoReferenceMode } from "@/lib/upload-rules";

/**
 * 视频「参考模式」菜单选项的唯一权威（2026-08-03 收敛）。
 *
 * ⛔ 原来对话流（`chat-workbench-core.tsx`）和工作流（`workflow-tldraw-canvas-inner.tsx`）
 *    各存一份选项数组，工作流那份**少了 Hailuo 3 的「尾帧模式」**、也没有按模型区分 —— 这正是
 *    H3 当时不敢在工作流放出来的原因。现在两处共用这一份，禁止再各写一套。
 *
 * ⭐ 两家的差异只有两点，全部体现在下面两个数组里：
 *    ① BytePlus Seedance 融合模式还能收参考视频/音频；Hailuo 3 只收图片
 *       （OpenRouter 对非 BytePlus 供应商会**静默丢弃**视频/音频参考）。
 *    ② Hailuo 3 多一个「尾帧模式」（OpenRouter `frame_images.frame_type = last_frame`）。
 */
export type VideoReferenceModeOption = {
  value: VideoReferenceMode;
  label: string;
  description: string;
  icon: IconType;
};

export const videoReferenceModeOptions: VideoReferenceModeOption[] = [
  { value: "reference", label: "融合模式", description: "支持 1-9 张图片，1-3 个视频，1-3 个音频", icon: RiImageCircleLine },
  { value: "first_frame", label: "首帧模式", description: "支持 1 张首帧图片", icon: RiImage2Line },
  { value: "first_last_frame", label: "首尾帧模式", description: "支持 2 张图片：首帧和尾帧", icon: RiMultiImageLine },
];

const hailuo3ReferenceModeOptions: VideoReferenceModeOption[] = [
  { value: "reference", label: "参考图模式", description: "支持 1-9 张参考图（不支持视频/音频）", icon: RiImageCircleLine },
  { value: "first_frame", label: "首帧模式", description: "支持 1 张首帧图片", icon: RiImage2Line },
  { value: "last_frame", label: "尾帧模式", description: "支持 1 张尾帧图片", icon: RiImage2Line },
  { value: "first_last_frame", label: "首尾帧模式", description: "支持 2 张图片：首帧和尾帧", icon: RiMultiImageLine },
];

/** 按模型给参考模式菜单选项 —— 唯一权威。 */
export function getVideoReferenceModeOptions(modelId?: string): VideoReferenceModeOption[] {
  if (isHailuo3VideoModel(modelId)) return hailuo3ReferenceModeOptions;
  return videoReferenceModeOptions;
}

/** 菜单按钮上显示的当前模式名（模型不同同一个 value 文案也不同：融合模式 / 参考图模式）。 */
export function getVideoReferenceModeLabel(modelId?: string, value?: VideoReferenceMode) {
  const options = getVideoReferenceModeOptions(modelId);
  return options.find((option) => option.value === value)?.label ?? options[0].label;
}

/**
 * 该参考模式**必须**有几张参考图才能提交（0 = 不强制）。
 * 首帧 / 尾帧 1 张，首尾帧 2 张 —— 两家一致，都是上游硬规则。
 */
export function getRequiredVideoReferenceImageCount(mode?: VideoReferenceMode) {
  if (mode === "first_last_frame") return 2;
  if (mode === "first_frame" || mode === "last_frame") return 1;
  return 0;
}
