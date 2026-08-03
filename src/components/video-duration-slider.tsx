import { useCallback, useMemo, useState } from "react";
import { RiArrowUpSLine, RiArrowDownSLine } from "react-icons/ri";

/**
 * 视频生成时长选择器（滑块 + 数字输入框）。全平台统一：对话流 / 工作流视频节点共用这一份。
 * - 量程按模型自身：最大档就是右端，末尾不留空刻度（如 Veo 只到 8，就不显示 10/15）。
 * - 每个模型只有 supportedSeconds 里那几档是合法的；小于最小档的区间灰显不可选。
 * - 拖动 / 输入 / 点数字刻度一律吸附到最近的合法档；上下箭头在合法档之间跳。
 */
const DURATION_SLIDER_MAX = 15;

export function VideoDurationSlider({ supportedSeconds, value, onChange }: { supportedSeconds: number[]; value: number; onChange: (seconds: number) => void }) {
  const sorted = useMemo(() => Array.from(new Set(supportedSeconds)).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b), [supportedSeconds]);
  const minSec = sorted[0] ?? 0;
  const maxSec = sorted[sorted.length - 1] ?? DURATION_SLIDER_MAX;
  const scaleMax = maxSec || DURATION_SLIDER_MAX;
  const snap = useCallback((seconds: number) => sorted.reduce((best, item) => (Math.abs(item - seconds) < Math.abs(best - seconds) ? item : best), sorted[0] ?? seconds), [sorted]);
  const current = sorted.includes(value) ? value : snap(value);
  const [inputText, setInputText] = useState(String(current));
  // 当外部选中值变化时同步输入框（React 官方「渲染期按上一次值调整 state」写法，用 state 不用 ref、也不用 effect）。
  const [prevCurrent, setPrevCurrent] = useState(current);
  if (prevCurrent !== current) { setPrevCurrent(current); setInputText(String(current)); }

  const pct = (seconds: number) => `${(Math.min(scaleMax, Math.max(0, seconds)) / scaleMax) * 100}%`;

  // ⭐⭐ 拖动必须用**原生 `<input type="range">`**（透明覆盖在自定义外观之上），不能用自己写的 pointer 事件：
  // 工作流节点编辑器的外层容器有 `onPointerDownCapture={stopCanvasPointer}`
  // （`workflow-tldraw-canvas-inner.tsx:2795`，作用是 `event.stopPropagation()` 拦住 tldraw 平移/选中）。
  // React 捕获阶段自根向下，那个祖先会**先**执行并掐断传播 → 自定义 pointerdown/move/up 永远收不到事件，
  // 于是滑块点得动、拖不动。而原生 range 的拖动是浏览器内建默认行为，不受 stopPropagation 影响
  // （橡皮擦画笔大小滑块同理，见同文件 2735 行，是本项目已验证可行的做法）。
  // ⛔ 别改回自己监听 pointer 事件。
  const commitSeconds = (raw: number) => {
    const clamped = Math.min(maxSec, Math.max(minSec, raw));
    onChange(snap(clamped));
  };

  const stepBy = (direction: 1 | -1) => {
    const index = sorted.indexOf(current);
    const nextIndex = Math.min(sorted.length - 1, Math.max(0, index + direction));
    onChange(sorted[nextIndex] ?? current);
  };

  const commitInput = () => {
    const parsed = Number(inputText);
    if (!Number.isFinite(parsed)) { setInputText(String(current)); return; }
    commitSeconds(parsed);
  };

  // 数字刻度：档位少（如 Veo 4/6/8、Seedance 5/10/15）直接标各档；档位多（如 H3 5~15）用 0/5/10/15 里 ≤ 最大档的那几个。始终包含 0 和最大档。
  const ticks = Array.from(new Set([0, ...(sorted.length <= 6 ? sorted : [5, 10, 15].filter((t) => t <= maxSec)), maxSec])).sort((a, b) => a - b);

  return (
    <div className="flex items-center gap-6 px-1 py-2">
      <div className="flex-1">
        <div className="relative h-4 select-none">
          {/* 整条底轨（浅灰） */}
          <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#ececec]" />
          {/* 小于最小档的禁用段（深灰、不可选） */}
          {minSec > 0 ? <div className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#cfcfcf]" style={{ left: 0, width: pct(minSec) }} /> : null}
          {/* 已选中的进度（从最小档到当前） */}
          <div className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#111111]" style={{ left: pct(minSec), width: `calc(${pct(current)} - ${pct(minSec)})` }} />
          {/* 手柄 */}
          <div className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#111111] shadow-[0_1px_4px_rgba(0,0,0,0.25)]" style={{ left: pct(current) }} />
          {/* 真正接收拖动的原生 range（透明覆盖）。min 固定 0 让它的坐标系和上面的视觉刻度完全对齐。 */}
          <input
            type="range"
            min={0}
            max={scaleMax}
            step={1}
            value={current}
            onChange={(event) => commitSeconds(Number(event.target.value))}
            aria-label="视频生成时长（秒）"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>
        <div className="relative mt-1.5 h-2">
          {/* 每个「可选秒」一根小竖线：连续档模型（如 H3）5~10 之间会有 6/7/8/9，离散档模型（如 Seedance 5/10/15）中间就没有 */}
          {sorted.map((sec) => (
            <div key={sec} className="absolute top-0 h-1.5 w-px -translate-x-1/2 bg-[#c8c8c8]" style={{ left: pct(sec) }} />
          ))}
        </div>
        <div className="relative mt-0.5 h-4 text-[11px]">
          {ticks.map((tick) => {
            const inRange = tick >= minSec && tick <= maxSec;
            return (
              <button
                key={tick}
                type="button"
                disabled={!inRange}
                onClick={() => commitSeconds(tick)}
                className={`absolute -translate-x-1/2 whitespace-nowrap rounded-[5px] px-1.5 py-0.5 leading-none ${inRange ? "cursor-pointer text-[#666666] hover:bg-[#f0f0f0] hover:text-[#111111]" : "cursor-default text-[#c8c8c8]"}`}
                style={{ left: pct(tick) }}
              >{tick}</button>
            );
          })}
        </div>
      </div>
      <div className="flex h-9 shrink-0 items-center gap-1 rounded-[10px] bg-[#f3f3f3] pl-2 pr-1">
        <input
          type="text"
          inputMode="numeric"
          value={inputText}
          onChange={(event) => setInputText(event.target.value.replace(/[^0-9]/g, ""))}
          onBlur={commitInput}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commitInput(); } }}
          className="w-7 bg-transparent text-center text-[14px] font-medium text-[#111111] outline-none"
        />
        <span className="text-[12px] text-[#8a8a8a]">S</span>
        <div className="flex flex-col">
          <button type="button" onClick={() => stepBy(1)} disabled={current >= maxSec} className="flex h-4 w-5 items-center justify-center text-[#777777] hover:text-[#111111] disabled:opacity-30" aria-label="加 1 档">
            <RiArrowUpSLine className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => stepBy(-1)} disabled={current <= minSec} className="flex h-4 w-5 items-center justify-center text-[#777777] hover:text-[#111111] disabled:opacity-30" aria-label="减 1 档">
            <RiArrowDownSLine className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
