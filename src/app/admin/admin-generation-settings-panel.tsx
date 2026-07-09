"use client";

import { useState, useTransition } from "react";
import type { AdminSystemSettings, CompressionQuality } from "@/lib/system-settings";

// 质量三档：高(95%)/标准(80%)/低(60%)。用通用档位命名，避免"原图的xx%"在视频下被误解。
const qualityOptions: Array<{ value: CompressionQuality; label: string; percent: number }> = [
  { value: "high", label: "高", percent: 95 },
  { value: "standard", label: "标准", percent: 80 },
  { value: "low", label: "低", percent: 60 },
];

function getQualityOptionLabel(option: { label: string; percent: number }) {
  return `${option.label}(${option.percent}%)`;
}

function SettingSwitch({ checked, disabled, onChange, ariaLabel }: { checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void; ariaLabel: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${checked ? "bg-[#367cee]" : "bg-[#d8d8d8]"}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${checked ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

function CompressionRow({ title, note, toggleLabel, enabled, quality, disabled, onToggle, onQualityChange }: {
  title: string;
  note: string;
  toggleLabel: string;
  enabled: boolean;
  quality: CompressionQuality;
  disabled: boolean;
  onToggle: (checked: boolean) => void;
  onQualityChange: (value: CompressionQuality) => void;
}) {
  return (
    <div className="grid grid-cols-[280px_1fr] items-center gap-5 border-b border-[#f2f2f2] px-5 py-4 last:border-b-0">
      <div>
        <div className="font-medium text-[#222222]">{title}</div>
        <div className="mt-1 text-[12px] leading-5 text-[#888888]">{note}</div>
      </div>
      <div className="flex items-center gap-4">
        <span className="inline-flex items-center gap-2">
          <span className="text-[12px] text-[#777777]">{toggleLabel}</span>
          <SettingSwitch checked={enabled} disabled={disabled} onChange={onToggle} ariaLabel={`${title}${toggleLabel}开关`} />
          <span className={`text-[12px] ${enabled ? "text-[#367cee]" : "text-[#999999]"}`}>{enabled ? "已开启" : "已关闭"}</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <span className={`text-[12px] ${enabled ? "text-[#777777]" : "text-[#bbbbbb]"}`}>质量</span>
          <select
            value={quality}
            disabled={disabled || !enabled}
            onChange={(event) => onQualityChange(event.target.value as CompressionQuality)}
            className="h-8 w-[160px] rounded-[6px] border border-[#e3e5eb] bg-white px-2 text-[13px] text-[#555555] outline-none transition focus:border-[#367cee] disabled:cursor-not-allowed disabled:bg-[#eeeeee] disabled:text-[#aaaaaa]"
          >
            {qualityOptions.map((option) => <option key={option.value} value={option.value}>{getQualityOptionLabel(option)}</option>)}
          </select>
        </span>
      </div>
    </div>
  );
}

export function AdminGenerationSettingsPanel({ settings }: { settings: AdminSystemSettings }) {
  const [imageEnabled, setImageEnabled] = useState(settings.imageCompressionEnabled);
  const [imageQuality, setImageQuality] = useState<CompressionQuality>(settings.imageCompressionQuality);
  const [videoEnabled, setVideoEnabled] = useState(settings.videoCompressionEnabled);
  const [videoQuality, setVideoQuality] = useState<CompressionQuality>(settings.videoCompressionQuality);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const save = (next: { imageCompressionEnabled?: boolean; imageCompressionQuality?: CompressionQuality; videoCompressionEnabled?: boolean; videoCompressionQuality?: CompressionQuality }) => {
    const payload = {
      imageCompressionEnabled: next.imageCompressionEnabled ?? imageEnabled,
      imageCompressionQuality: next.imageCompressionQuality ?? imageQuality,
      videoCompressionEnabled: next.videoCompressionEnabled ?? videoEnabled,
      videoCompressionQuality: next.videoCompressionQuality ?? videoQuality,
    };
    setImageEnabled(payload.imageCompressionEnabled);
    setImageQuality(payload.imageCompressionQuality);
    setVideoEnabled(payload.videoCompressionEnabled);
    setVideoQuality(payload.videoCompressionQuality);
    setMessage("");
    startTransition(async () => {
      try {
        const response = await fetch("/admin/api/system-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await response.json().catch(() => ({}))) as { error?: string; settings?: AdminSystemSettings };
        if (!response.ok || !data.settings) throw new Error(data.error || "保存失败");
        setImageEnabled(data.settings.imageCompressionEnabled);
        setImageQuality(data.settings.imageCompressionQuality);
        setVideoEnabled(data.settings.videoCompressionEnabled);
        setVideoQuality(data.settings.videoCompressionQuality);
        setMessage("已保存");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "保存失败");
      }
    });
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-[24px] font-semibold tracking-[-0.03em]">系统设置</h1>
        {message ? <div className={`text-[13px] ${message.includes("失败") ? "text-red-500" : "text-[#367cee]"}`}>{message}</div> : null}
      </div>

      <section className="min-w-[760px] max-w-[760px] overflow-hidden rounded-[10px] border border-[#eeeeee] bg-white text-[13px] shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
        <div className="border-b border-[#eeeeee] bg-[#fafafa] px-5 py-3 text-[12px] font-medium text-[#777777]">生成文件压缩</div>
        <CompressionRow
          title="图片生成"
          note="开启后模型出图转成 JPG 并按所选质量压缩落盘（体积更小、跨境更快）；关闭则保留原图不转码不压缩。"
          toggleLabel="压缩"
          enabled={imageEnabled}
          quality={imageQuality}
          disabled={isPending}
          onToggle={(value) => save({ imageCompressionEnabled: value })}
          onQualityChange={(value) => save({ imageCompressionQuality: value })}
        />
        <CompressionRow
          title="视频生成"
          note="开启后模型出视频压缩转码落盘（体积更小、跨境更快）；关闭则保留原视频不转码。"
          toggleLabel="压缩"
          enabled={videoEnabled}
          quality={videoQuality}
          disabled={isPending}
          onToggle={(value) => save({ videoCompressionEnabled: value })}
          onQualityChange={(value) => save({ videoCompressionQuality: value })}
        />
      </section>
    </>
  );
}
