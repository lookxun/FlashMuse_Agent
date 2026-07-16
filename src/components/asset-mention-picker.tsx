"use client";

import type { IconType } from "react-icons";
import { RiLoader4Line, RiPlayLargeFill, RiVideoOnLine } from "react-icons/ri";
import { AudioWaveformPlayer } from "@/components/audio-waveform-player";

export type MentionPickerCategory = { label: string; value: string; icon: IconType };
export type MentionPickerItem = {
  id: string;
  name: string;
  url: string;
  /** 图片/视频封面缩略图（视频没有真实封面时留空，改用首帧兜底） */
  thumbnailUrl?: string;
  kind: "image" | "video" | "audio";
};

export interface AssetMentionPickerProps {
  categories: MentionPickerCategory[];
  activeValue: string;
  onSelectCategory: (value: string) => void;
  /** 返回某个分类当前已加载、且已按搜索过滤的资产 */
  itemsFor: (value: string) => MentionPickerItem[];
  /** 分类总数（服务端计数），用于左侧标签显示与滚动加载判断 */
  counts?: Record<string, number>;
  /** 首次打开、左侧标签+计数尚未就绪时的整窗转圈 */
  loading?: boolean;
  /** 当前标签正在加载（切标签首屏 / 下拉加载更多） */
  activeLoading?: boolean;
  onPick: (item: MentionPickerItem) => void;
  onScrollLoadMore?: (value: string, loadedCount: number) => void;
  /** 把资产 url 解析成可播放/可显示的真实地址（视频首帧、音频波形用） */
  getMediaSrc?: (url: string) => string;
  className?: string;
}

/**
 * 统一的「@引用资产」选择器：左侧分类标签（图标+文字+计数），右侧 5 列 80×80 缩略图。
 * 对话流输入框、资产库生成弹窗输入框、工作流输入框三处一律复用它，禁止再各写一套。
 * 视频/音频是否能被引用由调用方在 onPick 里判断（本组件只负责展示与点击回调）。
 * 加载策略：首次只加载当前标签一屏 + 计数；切标签/下拉再各自懒加载（和资产库一致）。
 */
export function AssetMentionPicker({
  categories,
  activeValue,
  onSelectCategory,
  itemsFor,
  counts,
  loading,
  activeLoading,
  onPick,
  onScrollLoadMore,
  getMediaSrc = (url) => url,
  className,
}: AssetMentionPickerProps) {
  const items = itemsFor(activeValue);
  return (
    <div className={`flex w-[560px] max-w-[86vw] flex-col overflow-hidden rounded-[12px] bg-white p-2 shadow-[0_18px_44px_rgba(0,0,0,0.14)] ${className ?? ""}`}>
      <div className="px-1 pb-2 text-[12px] font-medium text-[#8a8a8a]">@引用资产</div>
      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center gap-2 text-[13px] font-medium text-[#367cee]"><RiLoader4Line className="h-[18px] w-[18px] animate-spin" /><span>正在加载中...</span></div>
      ) : (
        <div className="flex h-[378px] items-stretch">
          <div className="w-[128px] shrink-0 space-y-0.5 overflow-y-auto border-r border-[#eee] pr-1.5">
            {categories.map((cat) => {
              const isActive = cat.value === activeValue;
              const count = Number(counts?.[cat.value] ?? 0);
              const CategoryIcon = cat.icon;
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => onSelectCategory(cat.value)}
                  className={isActive ? "flex h-9 w-full items-center rounded-lg bg-[#ececec] px-2 text-left" : "flex h-9 w-full items-center rounded-lg px-2 text-left transition hover:bg-[#ececec]"}
                  title={cat.label}
                >
                  <CategoryIcon className="mr-1.5 h-[18px] w-[18px] shrink-0 text-[#777777]" aria-hidden="true" />
                  <span className={isActive ? "min-w-0 flex-1 truncate text-[12px] font-medium text-[#111111]" : "min-w-0 flex-1 truncate text-[12px] font-medium text-[#444444]"}>{cat.label}</span>
                  <span className="ml-1 shrink-0 text-[11px] text-[#9a9a9a]">{count}</span>
                </button>
              );
            })}
          </div>
          <div className="relative min-w-0 flex-1">
            <div
              className="absolute inset-0 overflow-y-auto pl-2"
              onScroll={(event) => {
                if (!onScrollLoadMore || activeLoading) return;
                const el = event.currentTarget;
                const total = Number(counts?.[activeValue] ?? 0);
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - 48 && items.length < total) onScrollLoadMore(activeValue, items.length);
              }}
            >
              {items.length === 0 ? (
                activeLoading
                  ? <div className="flex h-full items-center justify-center gap-2 text-[13px] font-medium text-[#367cee]"><RiLoader4Line className="h-[18px] w-[18px] animate-spin" /><span>正在加载中...</span></div>
                  : <div className="flex h-full items-center justify-center text-[13px] text-[#999]">暂无资产</div>
              ) : (
                <>
                <div className="grid grid-cols-5 gap-2">
                  {items.map((item) => (
                    <button key={item.id} type="button" onClick={() => onPick(item)} className="group relative aspect-square overflow-hidden rounded-[8px] bg-[#f4f4f4] text-left">
                    {item.kind === "audio" ? (
                      <div className="h-full w-full overflow-hidden"><AudioWaveformPlayer key={item.url} url={getMediaSrc(item.url)} variant="card" /></div>
                    ) : item.kind === "video" ? (
                      item.thumbnailUrl
                        ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={item.thumbnailUrl} alt={item.name} draggable={false} className="h-full w-full object-cover" />
                        : <div className="flex h-full w-full items-center justify-center bg-[#e9e9e9] text-[#b0b0b0]"><RiVideoOnLine className="h-7 w-7" aria-hidden="true" /></div>
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */ <img src={item.thumbnailUrl ?? getMediaSrc(item.url)} alt={item.name} draggable={false} className="h-full w-full object-cover" />
                    )}
                    {item.kind === "video" && item.thumbnailUrl ? (
                      <span className="pointer-events-none absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/42 text-white shadow-[0_8px_24px_rgba(0,0,0,0.22)] backdrop-blur-[4px]"><RiPlayLargeFill className="ml-0.5 h-4 w-4" aria-hidden="true" /></span>
                    ) : null}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/75 to-transparent" />
                      <span className="pointer-events-none absolute bottom-1.5 left-1.5 right-1.5 truncate text-[12px] font-medium leading-none text-white">@{item.name}</span>
                    </button>
                  ))}
                </div>
                {activeLoading ? <div className="flex items-center justify-center gap-2 py-3 text-[12px] font-medium text-[#367cee]"><RiLoader4Line className="h-[14px] w-[14px] animate-spin" /><span>正在加载中...</span></div> : null}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
