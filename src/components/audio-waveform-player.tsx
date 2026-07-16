"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RiPauseLargeFill, RiPlayLargeFill } from "react-icons/ri";

function formatAudioTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.floor(seconds);
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export interface AudioWaveformPlayerProps {
  url: string;
  /** "node" = 工作流画布节点（大卡）；"card" = 资产库方形小卡（自适应铺满容器） */
  variant?: "node" | "card";
  /** 灰色波形区拦截 pointerdown（工作流用：点波形不移动节点）；资产库不需要 */
  stopWaveformPointer?: boolean;
}

/**
 * 统一的音频波形播放器（基于 wavesurfer.js）。
 * 工作流音频节点、资产库上传音频卡等一律复用它，禁止再各写一套。
 */
export function AudioWaveformPlayer({ url, variant = "node", stopWaveformPointer = false }: AudioWaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const waveRef = useRef<{ play: () => void; pause: () => void; playPause: () => void; destroy: () => void } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const isCard = variant === "card";
  const waveHeight = isCard ? 64 : 96;

  useEffect(() => {
    let cancelled = false;
    let ws: import("wavesurfer.js").default | null = null;
    setIsPlaying(false);
    setDuration(0);
    setCurrentTime(0);
    (async () => {
      const { default: WaveSurfer } = await import("wavesurfer.js");
      const container = containerRef.current;
      if (cancelled || !container) return;
      ws = WaveSurfer.create({
        container,
        url,
        height: waveHeight,
        waveColor: "#b0b0b0",
        progressColor: "#1a1a1a",
        cursorWidth: 0,
        barWidth: isCard ? 2 : 3,
        barGap: isCard ? 2 : 3,
        barRadius: 0,
        normalize: true,
        hideScrollbar: true,
        dragToSeek: true,
      });
      waveRef.current = ws;
      ws.on("ready", (value) => setDuration(value));
      ws.on("timeupdate", (value) => setCurrentTime(value));
      ws.on("seeking", (value) => setCurrentTime(value));
      ws.on("interaction", (value) => setCurrentTime(value));
      ws.on("drag", (relativeX) => setCurrentTime(relativeX * (ws?.getDuration() || 0)));
      ws.on("play", () => setIsPlaying(true));
      ws.on("pause", () => setIsPlaying(false));
      ws.on("finish", () => setIsPlaying(false));
    })();
    return () => {
      cancelled = true;
      waveRef.current = null;
      if (ws) {
        try {
          ws.destroy();
        } catch {
          /* ignore teardown errors on unmount */
        }
      }
    };
  }, [url, waveHeight, isCard]);

  const togglePlay = useCallback(() => {
    waveRef.current?.playPause();
  }, []);

  const progressRatio = duration > 0 ? Math.min(currentTime / duration, 1) : 0;
  const lineHeight = isCard ? Math.round(waveHeight * 1.35) : 141;

  if (isCard) {
    return (
      <div
        className="relative h-full w-full overflow-hidden bg-[#e6e6e6]"
        onMouseEnter={() => waveRef.current?.play()}
        onMouseLeave={() => waveRef.current?.pause()}
      >
        <div className="absolute inset-x-3 inset-y-4">
          <div className="relative h-full w-full">
            <div className="absolute inset-0 flex items-center">
              <div ref={containerRef} className="w-full" style={{ height: waveHeight }} />
            </div>
            <div className="pointer-events-none absolute inset-y-0 z-10 w-[2px] bg-[#ff3b30]" style={{ left: `${progressRatio * 100}%` }} />
          </div>
        </div>
        <span className="pointer-events-none absolute left-2 top-2 z-20 rounded bg-black/12 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-[#333] backdrop-blur-sm">{formatAudioTime(currentTime)} / {formatAudioTime(duration)}</span>
        {!isPlaying ? (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/42 text-white shadow-[0_8px_24px_rgba(0,0,0,0.22)] backdrop-blur-[4px]">
            <RiPlayLargeFill className="ml-0.5 h-5 w-5" aria-hidden="true" />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col justify-center gap-3 px-4 pt-4 pb-3">
      <div
        className="grid place-items-center rounded-[12px] border border-[#e2e2e2] bg-[#e6e6e6] px-4"
        style={{ height: 150 }}
        onPointerDown={stopWaveformPointer ? (event) => event.stopPropagation() : undefined}
      >
        <div className="relative w-full self-center" style={{ height: 96 }}>
          <div ref={containerRef} className="h-full w-full" />
          <div className="pointer-events-none absolute top-1/2 w-[2px] -translate-y-1/2 bg-[#ff3b30]" style={{ left: `${progressRatio * 100}%`, height: lineHeight }} />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between px-1">
        <span className="text-[20px] font-medium tabular-nums text-[#9a9a9a]">{formatAudioTime(currentTime)} / {formatAudioTime(duration)}</span>
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={togglePlay}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ececec] text-[#1a1a1a] transition-colors hover:bg-[#e0e0e0]"
          aria-label={isPlaying ? "暂停" : "播放"}
        >
          {isPlaying ? <RiPauseLargeFill className="h-6 w-6" aria-hidden="true" /> : <RiPlayLargeFill className="ml-0.5 h-6 w-6" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
