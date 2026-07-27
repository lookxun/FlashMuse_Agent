/**
 * 媒体时长显示的唯一权威格式化（全平台统一）。
 * 音频波形播放器的时间显示、资产库视频卡左上角时长角标等，一律走这里，
 * 保证"同一个秒数在哪里都显示成同一个样子"。
 */

/** 秒 → `mm:ss`（分钟不足两位补零；超过 60 分钟自然进位成 `mmm:ss`）。 */
export function formatMediaClockTime(seconds: number) {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const total = Math.floor(safe);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/** 秒 → 两位整秒（如 `09`），@引用资产弹窗的倒计时用。 */
export function formatMediaPaddedSeconds(seconds: number) {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  return String(Math.round(safe)).padStart(2, "0");
}

/**
 * 从"N秒"这类中文时长文案里取秒数（老数据只有 previewMeta.duration / videoDuration 字符串时的兜底）。
 */
export function parseChineseDurationSeconds(text?: string | null) {
  if (!text) return undefined;
  const matched = /(\d+(?:\.\d+)?)\s*秒/.exec(text) ?? /^(\d+(?:\.\d+)?)$/.exec(text.trim());
  if (!matched) return undefined;
  const value = Number(matched[1]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}
