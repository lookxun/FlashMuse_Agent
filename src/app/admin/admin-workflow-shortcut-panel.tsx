"use client";

import { useState, useTransition, type ComponentType, type SVGProps } from "react";
import { RiFilmAiLine, RiImageAiLine } from "react-icons/ri";
import { audioGenerationModels, imageGenerationModels, models, videoGenerationModels } from "@/lib/models";
import type { AdminSystemSettings } from "@/lib/system-settings";
import { ModelIcon } from "@/components/model-icon";

const extraModelLabels: Record<string, string> = {
  "byteplus:conversation-image.seedream-4-5": "BytePlus Seedream 4.5",
  "byteplus:video.seedance-2-0-fast": "BytePlus Seedance 2.0 Fast",
  "byteplus:video.seedance-2-0": "BytePlus Seedance 2.0",
  "byteplus:video.seedance-2-0-mini": "BytePlus Seedance 2.0 Mini",
  "byteplus:video.seedance-2-5": "BytePlus Seedance 2.5",
  "mediakit:video.enhance-generative": "火山引擎画质增强大模型版",
  "mediakit:video.enhance-fast": "BytePlus画质增强极速版",
  "runninghub:video.depthcrafter": "RunningHub DepthCrafter",
};

function getModelLabel(id: string) {
  return extraModelLabels[id] ?? models.find((model) => model.id === id)?.label ?? imageGenerationModels.find((model) => model.id === id)?.label ?? videoGenerationModels.find((model) => model.id === id)?.label ?? audioGenerationModels.find((model) => model.id === id)?.label ?? id;
}

const EDIT_MODEL_CHAIN: Array<{ modelId: string; tier: string }> = [
  { modelId: "google/gemini-3.1-flash-image-preview", tier: "首选" },
  { modelId: "google/gemini-3-pro-image-preview", tier: "次选" },
  { modelId: "byteplus:conversation-image.seedream-4-5", tier: "三选" },
];

const HD_MODEL_CHAIN: Array<{ modelId: string; tier: string }> = [
  { modelId: "openai/gpt-5.4-image-2", tier: "GPT" },
  { modelId: "openai/gpt-image-2.5-flare", tier: "Flare" },
  { modelId: "openai/gpt-image-2.5-sunburst", tier: "Sunburst" },
  { modelId: "google/gemini-3.1-flash-image-preview", tier: "Gemini" },
];

const VIDEO_EDIT_MODEL_CHAIN: Array<{ modelId: string; tier: string }> = [
  { modelId: "byteplus:video.seedance-2-0-mini", tier: "首选" },
  { modelId: "byteplus:video.seedance-2-0-fast", tier: "次选" },
  { modelId: "byteplus:video.seedance-2-0", tier: "三选" },
  { modelId: "byteplus:video.seedance-2-5", tier: "四选" },
];

const VIDEO_ENHANCE_MODEL_CHAIN: Array<{ modelId: string; tier: string }> = [
  { modelId: "mediakit:video.enhance-generative", tier: "唯一" },
];
const VIDEO_ENHANCE_FAST_MODEL_CHAIN: Array<{ modelId: string; tier: string }> = [
  { modelId: "mediakit:video.enhance-fast", tier: "唯一" },
];
const VIDEO_DEPTH_MODEL_CHAIN: Array<{ modelId: string; tier: string }> = [
  { modelId: "runninghub:video.depthcrafter", tier: "唯一" },
];

type ShortcutRow = { key: string; name: string; rule: string; chain: Array<{ modelId: string; tier: string }> | null; chainEmptyHint: string };

const imageShortcutRows: ShortcutRow[] = [
  { key: "quick", name: "快捷编辑", rule: "尽量用源图同款模型/比例/分辨率重绘；上传图等对不上尺寸时回落 Seedream 4.5，比例+分辨率取最接近源图的一档。走 img2img，模型跟随源图、无候选链开关。", chain: null, chainEmptyHint: "跟随源图模型，无候选链开关" },
  { key: "hd", name: "高清", rule: "指令式提升清晰度，内容/构图/颜色不变；比例贴源图。快捷菜单里是下拉，用户自己选「GPT 2K / GPT 4K / Gemini 2K / Gemini 4K」。关掉某个模型，它的 2K/4K 两个选项一起隐藏；两个都关，高清按钮整个不显示。", chain: HD_MODEL_CHAIN, chainEmptyHint: "" },
  { key: "bg", name: "去背景", rule: "本地抠图（@imgly/background-removal-node），产透明 PNG，尺寸=源图。纯本地推理、不调云模型。", chain: null, chainEmptyHint: "本地抠图，无云模型" },
  { key: "eraser", name: "橡皮工具", rule: "半透明涂抹要消除的区域，导出时把标记区填中性灰盖住主体，模型做局部消除+补背景、其余不变；比例/尺寸贴源图。走「首选→次选→三选」模型候选链：前一个失败或关闭自动用下一个，全部关闭时回落完整候选链以免不可用。", chain: EDIT_MODEL_CHAIN, chainEmptyHint: "" },
  { key: "prompt", name: "使用提示词", rule: "用这个节点的提示词和参考素材新建一个同类节点。上传来的素材没有可复用提示词时按钮置灰。与右键菜单共用同一份实现。", chain: null, chainEmptyHint: "纯前端，无模型" },
  { key: "download", name: "下载", rule: "下载该图片原文件，文件名用资产系统名。与右键菜单的下载共用同一份实现，纯前端、不调模型。", chain: null, chainEmptyHint: "纯前端下载，无模型" },
];

const videoShortcutRows: ShortcutRow[] = [
  { key: "video_quick", name: "快捷编辑", rule: "用「源视频当参考视频 + 你输入的提示词」以融合模式重新生成一段视频。参数一律按源视频的真实尺寸/真实时长反推。需要 1080p 时只有 Seedance 2.0 支持，直接用它；480p/720p 才走下方候选链依次兜底。", chain: VIDEO_EDIT_MODEL_CHAIN, chainEmptyHint: "" },
  { key: "video_enhance", name: "画质增强", rule: "把已生成/已上传的视频超分到 720p / 1080p / 2K。快捷菜单里是下拉，用户自己选档位。走国内火山 MediaKit 大模型版。关掉开关或没填 API Key，前端整个按钮隐藏。", chain: VIDEO_ENHANCE_MODEL_CHAIN, chainEmptyHint: "" },
  { key: "video_enhance_fast", name: "画质增强极速", rule: "把已生成/已上传的视频超分到 720p / 1080p / 2K / 4K。快捷菜单里是下拉，用户自己选档位。走海外 BytePlus MediaKit 极速版。关掉开关或没填 API Key，前端整个按钮隐藏。", chain: VIDEO_ENHANCE_FAST_MODEL_CHAIN, chainEmptyHint: "" },
  { key: "video_depth", name: "深度动作捕捉", rule: "把已生成/已上传的视频抽出灰白深度视频，可再当 Seedance 参考视频用。走 RunningHub DepthCrafter。关掉开关或没填 API Key，前端整个按钮隐藏。", chain: VIDEO_DEPTH_MODEL_CHAIN, chainEmptyHint: "" },
  { key: "video_frame", name: "视频截图", rule: "截取首帧 / 尾帧 / 当前帧，当成一张上传图片走统一上传链路（去重/命名/进资产库都复用）。纯前端截帧，不调模型。", chain: null, chainEmptyHint: "纯前端截帧，无模型" },
  { key: "video_prompt", name: "使用提示词", rule: "用这个节点的提示词和参考素材新建一个同类节点。上传来的素材没有可复用提示词时按钮置灰。与右键菜单共用同一份实现。", chain: null, chainEmptyHint: "纯前端，无模型" },
  { key: "video_download", name: "下载", rule: "下载该视频原文件（mp4），文件名用资产系统名。与右键菜单的下载共用同一份实现，纯前端、不调模型。", chain: null, chainEmptyHint: "纯前端下载，无模型" },
];

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

function ShortcutTable({ title, note, icon: Icon, rows, editModelToggles, isPending, onToggleFn, onToggleModel }: {
  title: string;
  note: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  rows: ShortcutRow[];
  editModelToggles: Record<string, boolean>;
  isPending: boolean;
  onToggleFn: (key: string, enabled: boolean) => void;
  onToggleModel: (key: string, enabled: boolean) => void;
}) {
  return (
    <section className="mt-8 min-w-[1180px]">
      <div className="mb-3 flex items-center text-[13px] text-[#777777]">
        <Icon className="h-4 w-4 shrink-0 text-[#555555]" aria-hidden="true" />
        <span className="ml-1.5 font-medium text-[#222222]">{title}</span>
        <span className="ml-2">{note}</span>
      </div>
      <div className="overflow-hidden rounded-[10px] border border-[#eeeeee] bg-white text-[13px] shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
      <div className="grid grid-cols-[200px_1fr_470px] border-b border-[#eeeeee] bg-[#fafafa] text-[12px] text-[#777777]">
        <div className="px-5 py-3 font-medium">功能</div>
        <div className="px-5 py-3 font-medium">规则说明</div>
        <div className="px-5 py-3 font-medium">使用模型</div>
      </div>
      {rows.map((row) => {
        const fnChecked = editModelToggles[`fn:${row.key}`] !== false;
        return (
          <div key={row.key} className="grid grid-cols-[200px_1fr_470px] border-b border-[#f2f2f2] last:border-b-0">
            <div className="flex items-center gap-2 px-5 py-4">
              <SettingSwitch checked={fnChecked} disabled={isPending} onChange={(value) => onToggleFn(row.key, value)} ariaLabel={`${row.name} 开关`} />
              <span className="font-medium text-[#222222]">{row.name}</span>
            </div>
            <div className="px-5 py-4 text-[12px] leading-5 text-[#666666]">{row.rule}</div>
            <div className="px-5 py-4">
              {row.chain ? (
                <div className="flex flex-col gap-2">
                  {row.chain.map((entry) => {
                    const toggleKey = `${row.key}:${entry.modelId}`;
                    const checked = editModelToggles[toggleKey] !== false;
                    return (
                      <span key={toggleKey} className="inline-flex h-8 w-full items-center gap-2 rounded-[7px] bg-[#f4f6fb] px-2.5 text-[12px] text-[#333333]">
                        <span className="w-8 shrink-0 text-[#999999]">{entry.tier}</span>
                        <ModelIcon modelId={entry.modelId} />
                        <span className="min-w-0 flex-1 truncate font-medium">{getModelLabel(entry.modelId)}</span>
                        <SettingSwitch checked={checked} disabled={isPending} onChange={(value) => onToggleModel(toggleKey, value)} ariaLabel={`${row.name} ${entry.tier} 开关`} />
                      </span>
                    );
                  })}
                </div>
              ) : (
                <span className="text-[12px] text-[#999999]">{row.chainEmptyHint}</span>
              )}
            </div>
          </div>
        );
      })}
      </div>
    </section>
  );
}

export function AdminWorkflowShortcutPanel({ settings }: { settings: AdminSystemSettings }) {
  const [mediaKitApiKeyInput, setMediaKitApiKeyInput] = useState(settings.mediaKitApiKey);
  const [mediaKitEnabled, setMediaKitEnabled] = useState(settings.mediaKitApiKeyEnabled);
  const [bytePlusMediaKitApiKeyInput, setBytePlusMediaKitApiKeyInput] = useState(settings.bytePlusMediaKitApiKey);
  const [bytePlusMediaKitEnabled, setBytePlusMediaKitEnabled] = useState(settings.bytePlusMediaKitApiKeyEnabled);
  const [runningHubApiKeyInput, setRunningHubApiKeyInput] = useState(settings.runningHubApiKey);
  const [runningHubEnabled, setRunningHubEnabled] = useState(settings.runningHubApiKeyEnabled);
  const [editModelToggles, setEditModelToggles] = useState(settings.editModelToggles);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const saveSettings = (nextSettings?: Partial<AdminSystemSettings>) => {
    const nextMediaKitKey = nextSettings?.mediaKitApiKey ?? mediaKitApiKeyInput.trim();
    const nextMediaKitEnabled = nextSettings?.mediaKitApiKeyEnabled ?? mediaKitEnabled;
    const nextBytePlusMediaKitKey = nextSettings?.bytePlusMediaKitApiKey ?? bytePlusMediaKitApiKeyInput.trim();
    const nextBytePlusMediaKitEnabled = nextSettings?.bytePlusMediaKitApiKeyEnabled ?? bytePlusMediaKitEnabled;
    const nextRunningHubKey = nextSettings?.runningHubApiKey ?? runningHubApiKeyInput.trim();
    const nextRunningHubEnabled = nextSettings?.runningHubApiKeyEnabled ?? runningHubEnabled;
    const nextEditModelToggles = nextSettings?.editModelToggles ?? editModelToggles;
    if (nextMediaKitEnabled && !nextMediaKitKey) {
      setMessage("请输入火山引擎 MediaKit API Key");
      return;
    }
    if (nextBytePlusMediaKitEnabled && !nextBytePlusMediaKitKey) {
      setMessage("请输入 BytePlus MediaKit API Key");
      return;
    }
    if (nextRunningHubEnabled && !nextRunningHubKey) {
      setMessage("请输入 RunningHub API Key");
      return;
    }

    setMediaKitEnabled(nextMediaKitEnabled);
    setBytePlusMediaKitEnabled(nextBytePlusMediaKitEnabled);
    setRunningHubEnabled(nextRunningHubEnabled);
    setEditModelToggles(nextEditModelToggles);
    setMessage("");
    startTransition(async () => {
      try {
        const response = await fetch("/admin/api/system-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaKitApiKey: nextMediaKitKey, mediaKitApiKeyEnabled: nextMediaKitEnabled, bytePlusMediaKitApiKey: nextBytePlusMediaKitKey, bytePlusMediaKitApiKeyEnabled: nextBytePlusMediaKitEnabled, runningHubApiKey: nextRunningHubKey, runningHubApiKeyEnabled: nextRunningHubEnabled, editModelToggles: nextEditModelToggles }),
        });
        const data = (await response.json().catch(() => ({}))) as { error?: string; settings?: AdminSystemSettings };
        if (!response.ok || !data.settings) throw new Error(data.error || "保存失败");
        setMediaKitApiKeyInput(data.settings.mediaKitApiKey);
        setMediaKitEnabled(data.settings.mediaKitApiKeyEnabled);
        setBytePlusMediaKitApiKeyInput(data.settings.bytePlusMediaKitApiKey);
        setBytePlusMediaKitEnabled(data.settings.bytePlusMediaKitApiKeyEnabled);
        setRunningHubApiKeyInput(data.settings.runningHubApiKey);
        setRunningHubEnabled(data.settings.runningHubApiKeyEnabled);
        setEditModelToggles(data.settings.editModelToggles);
        setMessage("");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "保存失败");
      }
    });
  };

  const updateEditModelToggle = (key: string, enabled: boolean) => {
    saveSettings({ editModelToggles: { ...editModelToggles, [key]: enabled } });
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-[24px] font-semibold tracking-[-0.03em]">快捷菜单开关(工作流)</h1>
        {message ? <div className={`text-[13px] ${message.includes("失败") || message.includes("请输入") ? "text-red-500" : "text-[#367cee]"}`}>{message}</div> : null}
      </div>

      <section className="min-w-[1180px]">
        <div className="grid w-[1180px] grid-cols-2 items-start gap-5">
          <div className="flex w-full flex-col gap-1 text-[12px] text-[#777777]">
            <div className="flex items-center gap-2">
              <span>火山引擎 MediaKit API</span>
              <SettingSwitch checked={mediaKitEnabled} disabled={isPending} onChange={(value) => saveSettings({ mediaKitApiKeyEnabled: value })} ariaLabel="火山引擎 MediaKit API 开关" />
            </div>
            <div className="relative">
              <input
                type="text"
                value={mediaKitApiKeyInput}
                disabled={mediaKitEnabled || isPending}
                onChange={(event) => setMediaKitApiKeyInput(event.target.value)}
                placeholder="请输入火山引擎 MediaKit API Key"
                className="h-9 w-full rounded-[8px] border border-[#e5e5e5] bg-white py-0 pl-3 pr-20 text-[13px] text-[#222222] outline-none transition focus:border-[#367cee] disabled:bg-[#f3f3f3] disabled:text-[#999999]"
              />
              <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] ${mediaKitEnabled ? "text-[#367cee]" : "text-[#999999]"}`}>{mediaKitEnabled ? "已启用" : "已关闭"}</span>
            </div>
          </div>
          <div className="flex w-full flex-col gap-1 text-[12px] text-[#777777]">
            <div className="flex items-center gap-2">
              <span>BytePlus MediaKit API</span>
              <SettingSwitch checked={bytePlusMediaKitEnabled} disabled={isPending} onChange={(value) => saveSettings({ bytePlusMediaKitApiKeyEnabled: value })} ariaLabel="BytePlus MediaKit API 开关" />
            </div>
            <div className="relative">
              <input
                type="text"
                value={bytePlusMediaKitApiKeyInput}
                disabled={bytePlusMediaKitEnabled || isPending}
                onChange={(event) => setBytePlusMediaKitApiKeyInput(event.target.value)}
                placeholder="请输入 BytePlus MediaKit API Key"
                className="h-9 w-full rounded-[8px] border border-[#e5e5e5] bg-white py-0 pl-3 pr-20 text-[13px] text-[#222222] outline-none transition focus:border-[#367cee] disabled:bg-[#f3f3f3] disabled:text-[#999999]"
              />
              <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] ${bytePlusMediaKitEnabled ? "text-[#367cee]" : "text-[#999999]"}`}>{bytePlusMediaKitEnabled ? "已启用" : "已关闭"}</span>
            </div>
          </div>
        </div>
        <div className="mt-5 grid w-[1180px] grid-cols-2 items-start gap-5">
          <div className="flex w-full flex-col gap-1 text-[12px] text-[#777777]">
            <div className="flex items-center gap-2">
              <span>RunningHub API</span>
              <SettingSwitch checked={runningHubEnabled} disabled={isPending} onChange={(value) => saveSettings({ runningHubApiKeyEnabled: value })} ariaLabel="RunningHub API 开关" />
            </div>
            <div className="relative">
              <input
                type="text"
                value={runningHubApiKeyInput}
                disabled={runningHubEnabled || isPending}
                onChange={(event) => setRunningHubApiKeyInput(event.target.value)}
                placeholder="请输入 RunningHub API Key"
                className="h-9 w-full rounded-[8px] border border-[#e5e5e5] bg-white py-0 pl-3 pr-20 text-[13px] text-[#222222] outline-none transition focus:border-[#367cee] disabled:bg-[#f3f3f3] disabled:text-[#999999]"
              />
              <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] ${runningHubEnabled ? "text-[#367cee]" : "text-[#999999]"}`}>{runningHubEnabled ? "已启用" : "已关闭"}</span>
            </div>
          </div>
        </div>
      </section>

      <ShortcutTable
        title="工作流 · 图片快捷菜单"
        note="选中工作流图片节点后顶部快捷菜单。每个功能前面的开关控制前端显不显示，默认打开；关掉后对应按钮隐藏。高清/橡皮右侧仍是模型开关。"
        icon={RiImageAiLine}
        rows={imageShortcutRows}
        editModelToggles={editModelToggles}
        isPending={isPending}
        onToggleFn={(key, enabled) => updateEditModelToggle(`fn:${key}`, enabled)}
        onToggleModel={updateEditModelToggle}
      />

      <ShortcutTable
        title="工作流 · 视频快捷菜单"
        note="选中工作流视频节点后顶部快捷菜单。每个功能前面的开关控制前端显不显示，默认打开；关掉后对应按钮隐藏。快捷编辑/画质增强右侧仍是模型开关。"
        icon={RiFilmAiLine}
        rows={videoShortcutRows}
        editModelToggles={editModelToggles}
        isPending={isPending}
        onToggleFn={(key, enabled) => updateEditModelToggle(`fn:${key}`, enabled)}
        onToggleModel={updateEditModelToggle}
      />
    </>
  );
}
