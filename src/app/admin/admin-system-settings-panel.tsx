"use client";

import { useState, useTransition } from "react";
import { ADVANCED_CHAT_MODEL, DEFAULT_CHAT_MODEL, audioGenerationModels, imageGenerationModels, models, videoGenerationModels } from "@/lib/models";
import type { AdminSystemSettings } from "@/lib/system-settings";
import { BytePlusIcon } from "@/components/byteplus-icon";
import { ModelIcon } from "@/components/model-icon";


const extraModelLabels: Record<string, string> = {
  "openai/gpt-5.5": "GPT-5.5",
  "byteplus:chat.seed-2-0-pro": "BytePlus Seed 2.0 Pro",
  "byteplus:conversation-image.seedream-4-5": "BytePlus Seedream 4.5",
  "byteplus:conversation-image.seedream-5-0": "BytePlus Seedream 5.0 Lite",
  "byteplus:conversation-image.seedream-5-0-pro": "BytePlus Seedream 5.0 Pro",
  "byteplus:video.seedance-2-0-fast": "BytePlus Seedance 2.0 Fast",
  "byteplus:video.seedance-2-0": "BytePlus Seedance 2.0",
  "byteplus:video.seedance-2-0-mini": "BytePlus Seedance 2.0 Mini",
  "byteplus:video.seedance-2-5": "BytePlus Seedance 2.5",
};

function getModelLabel(id: string) {
  return extraModelLabels[id] ?? models.find((model) => model.id === id)?.label ?? imageGenerationModels.find((model) => model.id === id)?.label ?? videoGenerationModels.find((model) => model.id === id)?.label ?? audioGenerationModels.find((model) => model.id === id)?.label ?? (id === DEFAULT_CHAT_MODEL ? "Seed 2.0 Lite" : id === ADVANCED_CHAT_MODEL ? "GPT-5.4" : id);
}

type ModelUsageItem = {
  badge: string;
  modelId: string;
  providerKey?: string;
  bytePlusOptions?: Array<{ label: string; endpointId: string }>;
  bytePlusStatic?: { label: string; endpointId: string };
  hint?: string;
  subheading?: string;
  // additive 布局下，标记该项属于哪一列（openrouter 独有模型 / byteplus 模型）。
  provider?: "openrouter" | "byteplus";
};

type ModelUsageGroup = {
  title: string;
  note: string;
  // 作用位置：该组开关实际影响的功能位置（显示为黑字圆点列表）。
  usageLocations: string[];
  // 用于 openrouter-only providerKey 命名空间（与后端硬编码字符串对齐）；显示 title 可自由改。
  providerGroup?: string;
  // additive=true：不再互斥，OpenRouter 独有模型 + BytePlus 模型分列独立开关、简单相加。
  additive?: boolean;
  models: ModelUsageItem[];
};

const bytePlusChatModels = [
  { label: "Seed 2.0 Lite", endpointId: "ep-20260518173102-9mtk6" },
  { label: "Seed 2.0 Pro", endpointId: "ep-20260514173614-jbcb4" },
  { label: "GLM-4.7", endpointId: "ep-20260514175234-9ssvl" },
];

const bytePlusImageModels = [
  { label: "Seedream 4.0", endpointId: "ep-20260515121509-mvr84" },
  { label: "Seedream 4.5", endpointId: "ep-20260514174622-n9qfb" },
  { label: "Seedream 5.0 Lite", endpointId: "ep-20260514142211-p2wdk" },
  { label: "Seedream 5.0 Pro", endpointId: "ep-20260713101732-q5zvf" },
];

const bytePlusVideoModels = [
  { label: "Seedance 2.0 Mini", endpointId: "ep-20260713100634-mwp78" },
  { label: "Seedance 2.0 Fast", endpointId: "ep-20260521134040-vf2jf" },
  { label: "Seedance 2.0", endpointId: "ep-20260521133841-nn8bg" },
  { label: "Seedance 2.5", endpointId: "ep-20260807153703-h48pt" },
];

function getOpenRouterOnlyProviderKey(groupTitle: string, item: ModelUsageItem) {
  return item.providerKey ?? `openrouter-only:${groupTitle}:${item.badge}:${item.modelId}`;
}

const modelUsageGroups: ModelUsageGroup[] = [
  {
    title: "图片生成",
    note: "",
    usageLocations: ["通用模式生图", "Agent 模式生图", "对话流图片模式", "工作流图片节点", "资产库生图"],
    providerGroup: "对话流图片生成",
    additive: true,
    models: [
      ...imageGenerationModels.filter((model) => model.id !== "bytedance-seed/seedream-4.5").map((model) => ({ provider: "openrouter" as const, badge: "", modelId: model.id })),
      { provider: "byteplus", badge: "", modelId: "byteplus:conversation-image.seedream-4-5", providerKey: "conversation-image.seedream-4-5", bytePlusStatic: bytePlusImageModels[1] },
      { provider: "byteplus", badge: "", modelId: "byteplus:conversation-image.seedream-5-0", providerKey: "conversation-image.seedream-5-0", bytePlusStatic: bytePlusImageModels[2] },
      { provider: "byteplus", badge: "", modelId: "byteplus:conversation-image.seedream-5-0-pro", providerKey: "conversation-image.seedream-5-0-pro", bytePlusStatic: bytePlusImageModels[3] },
    ],
  },
  {
    title: "视频生成",
    note: "",
    usageLocations: ["通用模式生视频", "Agent 模式生视频", "对话流视频", "工作流视频节点"],
    providerGroup: "对话流视频生成",
    additive: true,
    models: [
      ...videoGenerationModels.filter((model) => model.id !== "bytedance/seedance-2.0-fast" && model.id !== "bytedance/seedance-2.0").map((model) => ({ provider: "openrouter" as const, badge: "", modelId: model.id })),
      { provider: "byteplus", badge: "", modelId: "byteplus:video.seedance-2-0-mini", providerKey: "video.seedance-2-0-mini", bytePlusStatic: bytePlusVideoModels[0] },
      { provider: "byteplus", badge: "", modelId: "byteplus:video.seedance-2-0-fast", providerKey: "video.seedance-2-0-fast", bytePlusStatic: bytePlusVideoModels[1] },
      { provider: "byteplus", badge: "", modelId: "byteplus:video.seedance-2-0", providerKey: "video.seedance-2-0", bytePlusStatic: bytePlusVideoModels[2] },
      { provider: "byteplus", badge: "", modelId: "byteplus:video.seedance-2-5", providerKey: "video.seedance-2-5", bytePlusStatic: bytePlusVideoModels[3] },
    ],
  },
  {
    title: "语音生成",
    note: "",
    usageLocations: ["对话流语音生成"],
    providerGroup: "对话流语音生成",
    additive: true,
    models: audioGenerationModels.map((model) => ({ provider: "openrouter" as const, badge: "", modelId: model.id })),
  },
  {
    title: "通用模式",
    note: "",
    usageLocations: ["通用模式对话", "Agent 模式对话规划"],
    providerGroup: "通用模式 / Agent 规划 / 意图识别",
    additive: true,
    models: [
      ...models.filter((model) => model.id !== DEFAULT_CHAT_MODEL).map((model) => ({ provider: "openrouter" as const, badge: "", modelId: model.id, hint: model.id === "moonshotai/kimi-k3" ? "Agent优先" : undefined })),
      { provider: "byteplus", badge: "", modelId: "", providerKey: "general.seed-2-0-lite", bytePlusStatic: bytePlusChatModels[0] },
      { provider: "byteplus", badge: "", modelId: "", providerKey: "general.seed-2-0-pro", bytePlusStatic: bytePlusChatModels[1] },
    ],
  },
  {
    title: "反推提示词 / 优化提示词",
    note: "五个模型都开启时，按 GPT-5.6 Terra Pro → Kimi K3 → Grok 4.6 → Seed 2.0 Pro → Seed 2.0 Lite 顺序兜底，前一个失败/关闭再用下一个。",
    usageLocations: ["反推提示词", "优化提示词"],
    additive: true,
    models: [
      { provider: "openrouter", badge: "首选", modelId: "openai/gpt-5.6-terra-pro", providerKey: "prompt.priority" },
      { provider: "openrouter", badge: "次选", modelId: "moonshotai/kimi-k3", providerKey: "prompt.second" },
      { provider: "openrouter", badge: "三选", modelId: "x-ai/grok-4.6", providerKey: "prompt.third" },
      { provider: "byteplus", badge: "四选", modelId: "byteplus:chat.seed-2-0-pro", providerKey: "prompt.seed-2-0-pro", bytePlusStatic: bytePlusChatModels[1] },
      { provider: "byteplus", badge: "五选", modelId: "", providerKey: "prompt.seed-2-0-lite", bytePlusStatic: bytePlusChatModels[0] },
    ],
  },
  {
    title: "内容审核语义模型",
    note: "五个模型都开启时，按 GPT-5.6 Terra Pro → Kimi K3 → Grok 4.6 → Seed 2.0 Pro → Seed 2.0 Lite 顺序兜底，前一个失败/关闭再用下一个。全部关闭时语义审核不再执行（关键词拦截不受影响）。",
    usageLocations: ["内容审核语义审核"],
    additive: true,
    models: [
      { provider: "openrouter", badge: "首选", modelId: "openai/gpt-5.6-terra-pro", providerKey: "moderation.priority" },
      { provider: "openrouter", badge: "次选", modelId: "moonshotai/kimi-k3", providerKey: "moderation.second" },
      { provider: "openrouter", badge: "三选", modelId: "x-ai/grok-4.6", providerKey: "moderation.third" },
      { provider: "byteplus", badge: "四选", modelId: "byteplus:chat.seed-2-0-pro", providerKey: "moderation.seed-2-0-pro", bytePlusStatic: bytePlusChatModels[1] },
      { provider: "byteplus", badge: "五选", modelId: "", providerKey: "moderation.seed-2-0-lite", bytePlusStatic: bytePlusChatModels[0] },
    ],
  },
];

// 工作流图片「编辑功能」快捷菜单：后台规则展示 + 高清/橡皮模型开关。
// 橡皮的候选链顺序（首选→次选→三选）与前端 EDIT_MODEL_CANDIDATES / system-settings 的 EDIT_FUNCTION_MODEL_CHAIN 一致。
const EDIT_MODEL_CHAIN: Array<{ modelId: string; tier: string }> = [
  { modelId: "google/gemini-3.1-flash-image-preview", tier: "首选" },
  { modelId: "google/gemini-3-pro-image-preview", tier: "次选" },
  { modelId: "byteplus:conversation-image.seedream-4-5", tier: "三选" },
];

// 「高清」不是候选链，而是用户在下拉里自己选模型 + K 数（每个模型 2K/4K 两个选项）。
// 开关粒度 = 按模型：关掉一个模型，它的 2K/4K 两个选项在前端一起隐藏；两个都关则整个高清按钮隐藏。
// 与前端 HD_MODEL_OPTIONS / system-settings 的 HD_FUNCTION_MODEL_CHAIN 一致，新增模型三处一起改。
const HD_MODEL_CHAIN: Array<{ modelId: string; tier: string }> = [
  { modelId: "openai/gpt-5.4-image-2", tier: "GPT" },
  { modelId: "google/gemini-3.1-flash-image-preview", tier: "Gemini" },
];

const editFunctionRows: Array<{ key: string; name: string; rule: string; chain: Array<{ modelId: string; tier: string }> | null }> = [
  { key: "quick", name: "快捷编辑", rule: "尽量用源图同款模型/比例/分辨率重绘；上传图等对不上尺寸时回落 Seedream 4.5，比例+分辨率取最接近源图的一档。走 img2img，模型跟随源图、无候选链开关。", chain: null },
  { key: "hd", name: "高清", rule: "指令式提升清晰度，内容/构图/颜色不变；比例贴源图。快捷菜单里是下拉，用户自己选「GPT 2K / GPT 4K / Gemini 2K / Gemini 4K」四个选项之一（模型 + 分辨率档）。⚠️ 用户既然明确选了模型，失败就不再自动换成别的模型，直接显示失败卡。下方开关按模型生效：关掉某个模型，它的 2K/4K 两个选项一起隐藏；两个都关，高清按钮整个不显示。", chain: HD_MODEL_CHAIN },
  { key: "bg", name: "去背景", rule: "本地抠图（@imgly/background-removal-node），产透明 PNG，尺寸=源图。纯本地推理、不调云模型、无候选链开关。", chain: null },
  { key: "eraser", name: "橡皮工具", rule: "半透明涂抹要消除的区域，导出时把标记区填中性灰盖住主体，模型做局部消除+补背景、其余不变；比例/尺寸贴源图。走下方「首选→次选→三选」模型候选链：前一个失败或关闭自动用下一个，全部关闭时回落完整候选链以免不可用。", chain: EDIT_MODEL_CHAIN },
];

// 工作流视频「编辑功能」快捷菜单：后台规则展示 + 快捷编辑模型候选链开关。
// 候选链顺序与前端 WORKFLOW_VIDEO_EDIT_MODEL_CHAIN / system-settings 的 VIDEO_EDIT_FUNCTION_MODEL_CHAIN 一致。
const VIDEO_EDIT_MODEL_CHAIN: Array<{ modelId: string; tier: string }> = [
  { modelId: "byteplus:video.seedance-2-0-mini", tier: "首选" },
  { modelId: "byteplus:video.seedance-2-0-fast", tier: "次选" },
  { modelId: "byteplus:video.seedance-2-0", tier: "三选" },
  // ⭐ 2.5 放最后一位（2026-08-09 加）：前三个都关掉才会用它，默认行为不变。⛔ 别挪到首位（更贵）。
  { modelId: "byteplus:video.seedance-2-5", tier: "四选" },
];

const videoEditFunctionRows: Array<{ key: string; name: string; rule: string; chain: boolean }> = [
  { key: "video_quick", name: "快捷编辑", rule: "用「源视频当参考视频 + 你输入的提示词」以融合模式重新生成一段视频。参数一律按源视频的真实尺寸/真实时长反推（比例取最接近的一档、分辨率取总像素最接近的一档、时长取最接近的「N秒」档），因此上传视频也能贴合原视频而不是用节点默认值。⚠️ 分辨率优先决定模型：需要 1080p 时只有 Seedance 2.0 支持（2.5 只有 480p/720p），直接用它、不再依次尝试；480p/720p 才走下方候选链依次兜底。", chain: true },
  { key: "video_download", name: "下载", rule: "下载该视频原文件（mp4），文件名用资产系统名。与右键菜单的下载共用同一份实现，纯前端、不调模型。", chain: false },
];



function SettingSwitch({ checked, disabled, onChange, ariaLabel }: { checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void; ariaLabel: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${checked ? "bg-[#367cee]" : "bg-[#d8d8d8]"}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${checked ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}


function ProviderSwitch({ checked, disabled, onChange, ariaLabel }: { checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void; ariaLabel: string }) {
  return <SettingSwitch checked={checked} disabled={disabled} onChange={onChange} ariaLabel={ariaLabel} />;
}

function OpenRouterModelTag({ item, checked, onToggle }: { item: ModelUsageItem; checked: boolean; onToggle: (checked: boolean) => void }) {
  if (!item.modelId) return <span className="inline-flex h-8 w-full rounded-[7px] bg-[#f4f6fb]" />;
  return (
    <span className="inline-flex h-8 w-full items-center gap-2 rounded-[7px] bg-[#f4f6fb] px-2.5 text-[12px] text-[#333333]">
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <ModelIcon modelId={item.modelId} />
        <span className="min-w-0 truncate font-medium">{getModelLabel(item.modelId)}</span>
        {item.hint ? <span className="shrink-0 text-[11px] text-[#999999]">{item.hint}</span> : null}
      </span>
      <ProviderSwitch checked={checked} onChange={onToggle} ariaLabel="启用 OpenRouter" />
    </span>
  );
}

function BytePlusModelTag({ item, selectedEndpointId, selectedProvider, onToggle, onChange }: { item: ModelUsageItem; selectedEndpointId: string; selectedProvider: "openrouter" | "byteplus"; onToggle: (checked: boolean) => void; onChange: (endpointId: string) => void }) {
  if (!item.bytePlusOptions?.length && !item.bytePlusStatic) return <span className="inline-flex h-8 w-full rounded-[7px] bg-[#f4f6fb]" />;
  if (item.bytePlusStatic) {
    return (
      <span className="inline-flex h-8 w-full items-center gap-2 rounded-[7px] bg-[#f4f6fb] px-2.5 text-[12px] text-[#333333]">
        <BytePlusIcon className="h-4 w-4 shrink-0 text-[#555555]" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate font-medium">{item.bytePlusStatic.label}</span>
        <ProviderSwitch checked={selectedProvider === "byteplus"} onChange={onToggle} ariaLabel="启用 BytePlus" />
      </span>
    );
  }
  const bytePlusOptions = item.bytePlusOptions ?? [];
  const selectedOption = bytePlusOptions.find((option) => option.endpointId === selectedEndpointId) ?? bytePlusOptions[0];
  const isBytePlusSelected = selectedProvider === "byteplus";

  return (
    <span className="inline-flex h-8 w-full items-center gap-2 rounded-[7px] bg-[#f4f6fb] px-2.5 text-[12px] text-[#333333]">
      <BytePlusIcon className="h-4 w-4 shrink-0 text-[#555555]" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate font-medium">{selectedOption.label}</span>
      <select value={selectedOption.endpointId} disabled={isBytePlusSelected} onChange={(event) => onChange(event.target.value)} className="h-6 w-[128px] rounded-[6px] border border-[#e3e5eb] bg-white px-2 text-[12px] text-[#555555] outline-none disabled:cursor-not-allowed disabled:bg-[#eeeeee] disabled:text-[#999999]">
        {bytePlusOptions.map((option) => <option key={option.endpointId} value={option.endpointId}>{option.label}</option>)}
      </select>
      <ProviderSwitch checked={isBytePlusSelected} onChange={onToggle} ariaLabel="启用 BytePlus" />
    </span>
  );
}

export function AdminSystemSettingsPanel({ settings, adminEmailCount }: { settings: AdminSystemSettings; adminEmailCount: number }) {
  const [apiKeyInput, setApiKeyInput] = useState(settings.openRouterApiKey);
  const [enabled, setEnabled] = useState(settings.openRouterApiKeyEnabled);
  const [bytePlusApiKeyInput, setBytePlusApiKeyInput] = useState(settings.bytePlusApiKey);
  const [bytePlusEnabled, setBytePlusEnabled] = useState(settings.bytePlusApiKeyEnabled);
  const [bytePlusUnlockLimits, setBytePlusUnlockLimits] = useState(settings.bytePlusUnlockLimits);
  const [bytePlusRegion, setBytePlusRegion] = useState<"ap-southeast-1" | "eu-west-1">(settings.bytePlusRegion);
  const [modelProviderPreferences, setModelProviderPreferences] = useState(settings.modelProviderPreferences);
  const [bytePlusModelSelections, setBytePlusModelSelections] = useState(settings.bytePlusModelSelections);
  const [editModelToggles, setEditModelToggles] = useState(settings.editModelToggles);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const saveSettings = (nextSettings?: Partial<AdminSystemSettings>) => {
    const nextOpenRouterKey = nextSettings?.openRouterApiKey ?? apiKeyInput.trim();
    const nextOpenRouterEnabled = nextSettings?.openRouterApiKeyEnabled ?? enabled;
    const nextBytePlusKey = nextSettings?.bytePlusApiKey ?? bytePlusApiKeyInput.trim();
    const nextBytePlusEnabled = nextSettings?.bytePlusApiKeyEnabled ?? bytePlusEnabled;
    const nextBytePlusUnlockLimits = nextSettings?.bytePlusUnlockLimits ?? bytePlusUnlockLimits;
    const nextBytePlusRegion = nextSettings?.bytePlusRegion ?? bytePlusRegion;
    const nextModelProviderPreferences = nextSettings?.modelProviderPreferences ?? modelProviderPreferences;
    const nextBytePlusModelSelections = nextSettings?.bytePlusModelSelections ?? bytePlusModelSelections;
    const nextEditModelToggles = nextSettings?.editModelToggles ?? editModelToggles;
    if (nextOpenRouterEnabled && !nextOpenRouterKey) {
      setMessage("请输入 OpenRouter API Key");
      return;
    }
    if (nextBytePlusEnabled && !nextBytePlusKey) {
      setMessage("请输入 BytePlus API Key");
      return;
    }

    setEnabled(nextOpenRouterEnabled);
    setBytePlusEnabled(nextBytePlusEnabled);
    setBytePlusUnlockLimits(nextBytePlusUnlockLimits);
    setBytePlusRegion(nextBytePlusRegion);
    setModelProviderPreferences(nextModelProviderPreferences);
    setBytePlusModelSelections(nextBytePlusModelSelections);
    setEditModelToggles(nextEditModelToggles);
    setMessage("");
    startTransition(async () => {
      try {
        const response = await fetch("/admin/api/system-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ openRouterApiKey: nextOpenRouterKey, openRouterApiKeyEnabled: nextOpenRouterEnabled, bytePlusApiKey: nextBytePlusKey, bytePlusApiKeyEnabled: nextBytePlusEnabled, bytePlusUnlockLimits: nextBytePlusUnlockLimits, bytePlusRegion: nextBytePlusRegion, modelProviderPreferences: nextModelProviderPreferences, bytePlusModelSelections: nextBytePlusModelSelections, editModelToggles: nextEditModelToggles }),
        });
        const data = (await response.json().catch(() => ({}))) as { error?: string; settings?: AdminSystemSettings };
        if (!response.ok || !data.settings) throw new Error(data.error || "保存失败");
        setApiKeyInput(data.settings.openRouterApiKey);
        setEnabled(data.settings.openRouterApiKeyEnabled);
        setBytePlusApiKeyInput(data.settings.bytePlusApiKey);
        setBytePlusEnabled(data.settings.bytePlusApiKeyEnabled);
        setBytePlusUnlockLimits(data.settings.bytePlusUnlockLimits);
        setBytePlusRegion(data.settings.bytePlusRegion);
        setModelProviderPreferences(data.settings.modelProviderPreferences);
        setBytePlusModelSelections(data.settings.bytePlusModelSelections);
        setEditModelToggles(data.settings.editModelToggles);
        setMessage("");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "保存失败");
      }
    });
  };

  const updateProvider = (key: string, provider: "openrouter" | "byteplus") => {
    const next: Record<string, "openrouter" | "byteplus"> = { ...modelProviderPreferences, [key]: provider };
    saveSettings({ modelProviderPreferences: next });
  };

  const updateOpenRouterOnlyProvider = (key: string, checked: boolean) => {
    const next: Record<string, "openrouter" | "byteplus"> = { ...modelProviderPreferences, [key]: checked ? "openrouter" : "byteplus" };
    saveSettings({ modelProviderPreferences: next });
  };

  const updateBytePlusModel = (key: string, endpointId: string) => {
    const next = { ...bytePlusModelSelections, [key]: endpointId };
    saveSettings({ bytePlusModelSelections: next });
  };

  const updateEditModelToggle = (key: string, enabled: boolean) => {
    const next = { ...editModelToggles, [key]: enabled };
    saveSettings({ editModelToggles: next });
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-[24px] font-semibold tracking-[-0.03em]">模型开关</h1>
        <div className="text-[13px] text-[#777777]">管理员白名单：{adminEmailCount} 个邮箱</div>
      </div>

      <section className="min-w-[1090px]">
        <div className="grid w-[1090px] grid-cols-[620px_450px] items-start gap-5">
        <div className="flex w-full flex-col gap-1 text-[12px] text-[#777777]">
          <div className="flex items-center gap-2">
            <span>OpenRouter API</span>
            <SettingSwitch checked={enabled} disabled={isPending} onChange={(value) => saveSettings({ openRouterApiKeyEnabled: value })} ariaLabel="OpenRouter API 开关" />
          </div>
          <div className="relative">
            <input
              type="text"
              value={apiKeyInput}
              disabled={enabled || isPending}
              onChange={(event) => setApiKeyInput(event.target.value)}
              placeholder="请输入 OpenRouter API Key"
              className="h-9 w-full rounded-[8px] border border-[#e5e5e5] bg-white py-0 pl-3 pr-20 text-[13px] text-[#222222] outline-none transition focus:border-[#367cee] disabled:bg-[#f3f3f3] disabled:text-[#999999]"
            />
            <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] ${enabled ? "text-[#367cee]" : "text-[#999999]"}`}>{enabled ? "已启用" : "已关闭"}</span>
          </div>
        </div>
        <div className="flex w-full flex-col gap-1 text-[12px] text-[#777777]">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2">
              <span>BytePlus API</span>
              <SettingSwitch checked={bytePlusEnabled} disabled={isPending} onChange={(value) => saveSettings({ bytePlusApiKeyEnabled: value })} ariaLabel="BytePlus API 开关" />
            </span>
            {/* ⭐ 2026-07-30：原来这里有个「解除限制」总开关，已改成**按账号**控制，
                入口移到左侧「帐号功能管理」（标题栏那个是"一键全开"的批量按钮）。
                `.env.local` 的 BYTEPLUS_UNLOCK_LIMITS 仍保留，只作为"拿不到 userId 时"的回落。 */}
          </div>
          <div className="relative">
            <input
              type="text"
              value={bytePlusApiKeyInput}
              disabled={bytePlusEnabled || isPending}
              onChange={(event) => setBytePlusApiKeyInput(event.target.value)}
              placeholder="请输入 BytePlus API Key"
              className="h-9 w-full rounded-[8px] border border-[#e5e5e5] bg-white py-0 pl-3 pr-20 text-[13px] text-[#222222] outline-none transition focus:border-[#367cee] disabled:bg-[#f3f3f3] disabled:text-[#999999]"
            />
            <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] ${bytePlusEnabled ? "text-[#367cee]" : "text-[#999999]"}`}>{bytePlusEnabled ? "已启用" : "已关闭"}</span>
          </div>
        </div>
        </div>
        {message ? <div className={`mt-2 text-[12px] ${message.includes("失败") || message.includes("请输入") ? "text-red-500" : "text-[#367cee]"}`}>{message}</div> : null}
      </section>

      <section className="mt-8 min-w-[1180px] overflow-hidden rounded-[10px] border border-[#eeeeee] bg-white text-[13px] shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
        <div className="grid grid-cols-[200px_170px_1fr] border-b border-[#eeeeee] bg-[#fafafa] text-[12px] text-[#777777]">
          <div className="px-5 py-3 font-medium">功能模块</div>
          <div className="px-5 py-3 font-medium">作用位置</div>
          <div className="grid grid-cols-[360px_70px_360px] px-5 py-3">
            <div className="font-medium">OpenRouter</div>
            <div className="text-center font-medium">说明</div>
            <div className="font-medium">BytePlus</div>
          </div>
        </div>
        {modelUsageGroups.map((group) => (
          <div key={group.title} className="grid grid-cols-[200px_170px_1fr] border-b border-[#f2f2f2] last:border-b-0">
            <div className="px-5 py-4">
              <div className="font-medium text-[#222222]">{group.title}</div>
              {group.note ? <div className="mt-1 text-[12px] leading-5 text-[#888888]">{group.note}</div> : null}
            </div>
            <div className="flex flex-col gap-1.5 px-5 py-4 text-[13px] text-[#222222]">
              {group.usageLocations.map((location) => (
                <div key={location} className="flex items-start gap-2">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#367cee]" />
                  <span>{location}</span>
                </div>
              ))}
            </div>
            <div className="px-5 py-4">
              {group.additive ? (
                <div className="grid grid-cols-[360px_70px_360px]">
                  <div className="flex flex-col gap-2">
                    {group.models.filter((model) => model.provider === "openrouter").map((model, index) => {
                      const openRouterOnlyKey = getOpenRouterOnlyProviderKey(group.providerGroup ?? group.title, model);
                      const effectiveKey = model.providerKey ?? openRouterOnlyKey;
                      const checked = modelProviderPreferences[effectiveKey] !== "byteplus";
                      return <OpenRouterModelTag key={`${group.title}-or-${index}-${model.modelId}`} item={model} checked={checked} onToggle={(value) => model.providerKey ? updateProvider(model.providerKey, value ? "openrouter" : "byteplus") : updateOpenRouterOnlyProvider(openRouterOnlyKey, value)} />;
                    })}
                  </div>
                  <div />
                  <div className="flex flex-col gap-2">
                    {group.models.filter((model) => model.provider === "byteplus").map((model, index) => (
                      <BytePlusModelTag key={`${group.title}-bp-${index}-${model.modelId}`} item={model} selectedEndpointId={model.providerKey ? bytePlusModelSelections[model.providerKey] : ""} selectedProvider={model.providerKey ? modelProviderPreferences[model.providerKey] ?? "openrouter" : "openrouter"} onToggle={(value) => model.providerKey && updateProvider(model.providerKey, value ? "byteplus" : "openrouter")} onChange={(endpointId) => model.providerKey && updateBytePlusModel(model.providerKey, endpointId)} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {group.models.map((model, index) => {
                    if (model.subheading) return <div key={`${group.title}-sub-${index}`} className={`text-[12px] font-medium text-[#555555] ${index === 0 ? "" : "mt-1"}`}>{model.subheading}</div>;
                    const providerKey = getOpenRouterOnlyProviderKey(group.providerGroup ?? group.title, model);
                    const checked = model.providerKey ? modelProviderPreferences[model.providerKey] !== "byteplus" : modelProviderPreferences[providerKey] !== "byteplus";
                    const showOpenRouter = model.provider === undefined || model.provider === "openrouter";
                    const showBytePlus = model.provider === undefined || model.provider === "byteplus";
                    return (
                      <div key={`${group.title}-${index}-${model.modelId}`} className="grid grid-cols-[360px_70px_360px] items-center">
                        {showOpenRouter ? <OpenRouterModelTag item={model} checked={checked} onToggle={(value) => model.providerKey ? updateProvider(model.providerKey, value ? "openrouter" : "byteplus") : updateOpenRouterOnlyProvider(providerKey, value)} /> : <span className="inline-flex h-8 w-full rounded-[7px] bg-[#f4f6fb]" />}
                        <span className="flex h-8 items-center justify-center text-[12px] text-[#888888]">{model.badge}</span>
                        {showBytePlus ? <BytePlusModelTag item={model} selectedEndpointId={model.providerKey ? bytePlusModelSelections[model.providerKey] : ""} selectedProvider={model.providerKey ? modelProviderPreferences[model.providerKey] ?? "openrouter" : "openrouter"} onToggle={(value) => model.providerKey && updateProvider(model.providerKey, value ? "byteplus" : "openrouter")} onChange={(endpointId) => model.providerKey && updateBytePlusModel(model.providerKey, endpointId)} /> : <span className="inline-flex h-8 w-full rounded-[7px] bg-[#f4f6fb]" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="mt-8 min-w-[1180px] overflow-hidden rounded-[10px] border border-[#eeeeee] bg-white text-[13px] shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
        <div className="border-b border-[#eeeeee] bg-[#fafafa] px-5 py-3 text-[12px] text-[#777777]">
          <span className="font-medium text-[#555555]">工作流 · 图片编辑功能</span>
          <span className="ml-2">选中工作流图片节点后顶部快捷菜单里的编辑功能。高清 = 用户在下拉里自己选「GPT / Gemini × 2K / 4K」，关掉某个模型它的两个选项就隐藏；橡皮工具走「首选→次选→三选」模型候选链，前一个失败或关闭自动用下一个，全部关闭时回落到完整候选链以免不可用。</span>
        </div>
        <div className="grid grid-cols-[140px_1fr_470px] border-b border-[#eeeeee] bg-[#fafafa] text-[12px] text-[#777777]">
          <div className="px-5 py-3 font-medium">功能</div>
          <div className="px-5 py-3 font-medium">规则说明</div>
          <div className="px-5 py-3 font-medium">使用模型（高清=按模型开关 / 橡皮=首选→次选→三选）</div>
        </div>
        {editFunctionRows.map((row) => (
          <div key={row.key} className="grid grid-cols-[140px_1fr_470px] border-b border-[#f2f2f2] last:border-b-0">
            <div className="px-5 py-4 font-medium text-[#222222]">{row.name}</div>
            <div className="px-5 py-4 text-[12px] leading-5 text-[#666666]">{row.rule}</div>
            <div className="px-5 py-4">
              {row.chain ? (
                <div className="flex flex-col gap-2">
                  {row.chain.map((entry) => {
                    const toggleKey = `${row.key}:${entry.modelId}`;
                    const checked = editModelToggles[toggleKey] !== false;
                    return (
                      <span key={toggleKey} className="inline-flex h-8 w-full items-center gap-2 rounded-[7px] bg-[#f4f6fb] px-2.5 text-[12px] text-[#333333]">
                        <span className="w-12 shrink-0 text-[#999999]">{entry.tier}</span>
                        <ModelIcon modelId={entry.modelId} />
                        <span className="min-w-0 flex-1 truncate font-medium">{getModelLabel(entry.modelId)}</span>
                        <SettingSwitch checked={checked} disabled={isPending} onChange={(value) => updateEditModelToggle(toggleKey, value)} ariaLabel={`${row.name} ${entry.tier} 开关`} />
                      </span>
                    );
                  })}
                </div>
              ) : (
                <span className="text-[12px] text-[#999999]">{row.key === "bg" ? "本地抠图，无云模型" : "跟随源图模型，无候选链开关"}</span>
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="mt-8 min-w-[1180px] overflow-hidden rounded-[10px] border border-[#eeeeee] bg-white text-[13px] shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
        <div className="border-b border-[#eeeeee] bg-[#fafafa] px-5 py-3 text-[12px] text-[#777777]">
          <span className="font-medium text-[#555555]">工作流 · 视频编辑功能</span>
          <span className="ml-2">选中工作流视频节点后顶部快捷菜单里的编辑功能。快捷编辑走「首选→次选→三选→四选」模型候选链，前一个失败或关闭自动用下一个；全部关闭时回落到完整候选链以免不可用。需要 1080p 时只有 Seedance 2.0 支持（2.5 只有 480p/720p），会直接用它而不走候选链。</span>
        </div>
        <div className="grid grid-cols-[140px_1fr_470px] border-b border-[#eeeeee] bg-[#fafafa] text-[12px] text-[#777777]">
          <div className="px-5 py-3 font-medium">功能</div>
          <div className="px-5 py-3 font-medium">规则说明</div>
          <div className="px-5 py-3 font-medium">使用模型（首选 / 次选 / 三选 / 四选）</div>
        </div>
        {videoEditFunctionRows.map((row) => (
          <div key={row.key} className="grid grid-cols-[140px_1fr_470px] border-b border-[#f2f2f2] last:border-b-0">
            <div className="px-5 py-4 font-medium text-[#222222]">{row.name}</div>
            <div className="px-5 py-4 text-[12px] leading-5 text-[#666666]">{row.rule}</div>
            <div className="px-5 py-4">
              {row.chain ? (
                <div className="flex flex-col gap-2">
                  {VIDEO_EDIT_MODEL_CHAIN.map((entry) => {
                    const toggleKey = `${row.key}:${entry.modelId}`;
                    const checked = editModelToggles[toggleKey] !== false;
                    return (
                      <span key={toggleKey} className="inline-flex h-8 w-full items-center gap-2 rounded-[7px] bg-[#f4f6fb] px-2.5 text-[12px] text-[#333333]">
                        <span className="w-8 shrink-0 text-[#999999]">{entry.tier}</span>
                        <ModelIcon modelId={entry.modelId} />
                        <span className="min-w-0 flex-1 truncate font-medium">{getModelLabel(entry.modelId)}</span>
                        <SettingSwitch checked={checked} disabled={isPending} onChange={(value) => updateEditModelToggle(toggleKey, value)} ariaLabel={`${row.name} ${entry.tier} 开关`} />
                      </span>
                    );
                  })}
                </div>
              ) : (
                <span className="text-[12px] text-[#999999]">纯前端下载，无模型</span>
              )}
            </div>
          </div>
        ))}
      </section>

    </>
  );
}
