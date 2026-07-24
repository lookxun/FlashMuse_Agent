"use client";

import { useState, useTransition } from "react";
import { ADVANCED_CHAT_MODEL, DEFAULT_CHAT_MODEL, imageGenerationModels, models, videoGenerationModels } from "@/lib/models";
import type { AdminSystemSettings } from "@/lib/system-settings";
import { BytePlusIcon } from "@/components/byteplus-icon";
import { RiGoogleFill, RiOpenaiFill, RiTiktokFill } from "react-icons/ri";

const extraModelLabels: Record<string, string> = {
  "openai/gpt-5.5": "GPT-5.5",
  "byteplus:chat.seed-2-0-pro": "BytePlus Seed 2.0 Pro",
  "byteplus:conversation-image.seedream-4-5": "BytePlus Seedream 4.5",
  "byteplus:conversation-image.seedream-5-0": "BytePlus Seedream 5.0 Lite",
  "byteplus:conversation-image.seedream-5-0-pro": "BytePlus Seedream 5.0 Pro",
  "byteplus:video.seedance-2-0-fast": "BytePlus Seedance 2.0 Fast",
  "byteplus:video.seedance-2-0": "BytePlus Seedance 2.0",
  "byteplus:video.seedance-2-0-mini": "BytePlus Seedance 2.0 Mini",
};

function getModelLabel(id: string) {
  return extraModelLabels[id] ?? models.find((model) => model.id === id)?.label ?? imageGenerationModels.find((model) => model.id === id)?.label ?? videoGenerationModels.find((model) => model.id === id)?.label ?? (id === DEFAULT_CHAT_MODEL ? "Seed 2.0 Lite" : id === ADVANCED_CHAT_MODEL ? "GPT-5.4" : id);
}

type ModelUsageItem = {
  badge: string;
  modelId: string;
  providerKey?: string;
  bytePlusOptions?: Array<{ label: string; endpointId: string }>;
  bytePlusStatic?: { label: string; endpointId: string };
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
];

function getOpenRouterOnlyProviderKey(groupTitle: string, item: ModelUsageItem) {
  return item.providerKey ?? `openrouter-only:${groupTitle}:${item.badge}:${item.modelId}`;
}

const modelUsageGroups: ModelUsageGroup[] = [
  {
    title: "图片生成",
    note: "",
    usageLocations: ["通用模式生图", "对话流图片模式", "工作流图片节点", "资产库生图"],
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
    usageLocations: ["通用模式生视频", "对话流视频", "工作流视频节点"],
    providerGroup: "对话流视频生成",
    additive: true,
    models: [
      ...videoGenerationModels.filter((model) => model.id !== "bytedance/seedance-2.0-fast" && model.id !== "bytedance/seedance-2.0").map((model) => ({ provider: "openrouter" as const, badge: "", modelId: model.id })),
      { provider: "byteplus", badge: "", modelId: "byteplus:video.seedance-2-0-mini", providerKey: "video.seedance-2-0-mini", bytePlusStatic: bytePlusVideoModels[0] },
      { provider: "byteplus", badge: "", modelId: "byteplus:video.seedance-2-0-fast", providerKey: "video.seedance-2-0-fast", bytePlusStatic: bytePlusVideoModels[1] },
      { provider: "byteplus", badge: "", modelId: "byteplus:video.seedance-2-0", providerKey: "video.seedance-2-0", bytePlusStatic: bytePlusVideoModels[2] },
    ],
  },
  {
    title: "通用模式",
    note: "",
    usageLocations: ["通用模式对话"],
    providerGroup: "通用模式 / Agent 规划 / 意图识别",
    additive: true,
    models: [
      ...models.filter((model) => model.id !== DEFAULT_CHAT_MODEL).map((model) => ({ provider: "openrouter" as const, badge: "", modelId: model.id })),
      { provider: "byteplus", badge: "", modelId: "", providerKey: "general.seed-2-0-lite", bytePlusStatic: bytePlusChatModels[0] },
      { provider: "byteplus", badge: "", modelId: "", providerKey: "general.seed-2-0-pro", bytePlusStatic: bytePlusChatModels[1] },
    ],
  },
  {
    title: "Agent 模式",
    note: "Agent 自动规划任务并调用模型：普通/高级两档分别用对应模型；自动生图/生视频的首选不可用时，随机使用「图片生成」「视频生成」里已开启的模型兜底。",
    usageLocations: ["Agent 对话规划", "Agent 自动生图", "Agent 自动生视频", "兜底：图片生成 / 视频生成"],
    providerGroup: "Agent 自动生成策略",
    models: [
      { badge: "", modelId: "", subheading: "规划对话模型" },
      { provider: "byteplus", badge: "普通", modelId: "byteplus:chat.seed-2-0-pro", providerKey: "agent-chat.seed-2-0-pro", bytePlusStatic: bytePlusChatModels[1] },
      { provider: "openrouter", badge: "高级", modelId: "openai/gpt-5.6-terra-pro", providerKey: "agent-chat.advanced" },
      { badge: "", modelId: "", subheading: "自动生成图片" },
      { provider: "byteplus", badge: "普通", modelId: "byteplus:conversation-image.seedream-4-5", providerKey: "agent-image.seedream-4-5", bytePlusStatic: bytePlusImageModels[1] },
      { provider: "openrouter", badge: "高级", modelId: "openai/gpt-5.4-image-2", providerKey: "agent-image.advanced" },
      { badge: "", modelId: "", subheading: "自动生成视频" },
      { provider: "byteplus", badge: "普通", modelId: "byteplus:video.seedance-2-0-fast", providerKey: "agent-video.seedance-2-0-fast", bytePlusStatic: bytePlusVideoModels[1] },
      { provider: "byteplus", badge: "高级", modelId: "byteplus:video.seedance-2-0", providerKey: "agent-video.seedance-2-0", bytePlusStatic: bytePlusVideoModels[2] },
    ],
  },
  {
    title: "反推提示词 / 优化提示词",
    note: "四个模型都开启时，按 GPT-5.5 → GPT-5.4 → Seed 2.0 Pro → Seed 2.0 Lite 顺序兜底，前一个失败/关闭再用下一个。",
    usageLocations: ["反推提示词", "优化提示词"],
    additive: true,
    models: [
      { provider: "openrouter", badge: "", modelId: "openai/gpt-5.5", providerKey: "prompt.priority" },
      { provider: "openrouter", badge: "", modelId: ADVANCED_CHAT_MODEL, providerKey: "prompt.second" },
      { provider: "byteplus", badge: "", modelId: "byteplus:chat.seed-2-0-pro", providerKey: "prompt.seed-2-0-pro", bytePlusStatic: bytePlusChatModels[1] },
      { provider: "byteplus", badge: "", modelId: "", providerKey: "prompt.seed-2-0-lite", bytePlusStatic: bytePlusChatModels[0] },
    ],
  },
];

// 工作流图片「编辑功能」快捷菜单：后台规则展示 + 高清/橡皮模型候选链开关。
// 候选链顺序（首选→次选→三选）与前端 EDIT_MODEL_CANDIDATES / system-settings 的 EDIT_FUNCTION_MODEL_CHAIN 一致。
const EDIT_MODEL_CHAIN: Array<{ modelId: string; tier: string }> = [
  { modelId: "google/gemini-3.1-flash-image-preview", tier: "首选" },
  { modelId: "google/gemini-3-pro-image-preview", tier: "次选" },
  { modelId: "byteplus:conversation-image.seedream-4-5", tier: "三选" },
];

const editFunctionRows: Array<{ key: string; name: string; rule: string; chain: boolean }> = [
  { key: "quick", name: "快捷编辑", rule: "尽量用源图同款模型/比例/分辨率重绘；上传图等对不上尺寸时回落 Seedream 4.5，比例+分辨率取最接近源图的一档。走 img2img，模型跟随源图、无候选链开关。", chain: false },
  { key: "hd", name: "高清", rule: "指令式提升清晰度，内容/构图/颜色不变；输出 4K、比例贴源图。走下方模型候选链：首选失败或关闭自动用下一个，全部失败才显示失败卡。", chain: true },
  { key: "bg", name: "去背景", rule: "本地抠图（@imgly/background-removal-node），产透明 PNG，尺寸=源图。纯本地推理、不调云模型、无候选链开关。", chain: false },
  { key: "eraser", name: "橡皮工具", rule: "半透明涂抹要消除的区域，导出时把标记区填中性灰盖住主体，模型做局部消除+补背景、其余不变；比例/尺寸贴源图。走下方模型候选链，规则同高清。", chain: true },
];

function AiGenerate3dIcon({ className = "h-4 w-4 shrink-0 text-[#555555]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M15.1416 2.81836L13.1016 3.94824L12 3.31055L4.5 7.65234V7.6582L12 12V20.6895L19.5 16.3467V11.5L21.5 10.3291V17.5L12 23L2.5 17.5V6.5L12 1L15.1416 2.81836ZM18.5293 2.31934C18.7059 1.8935 19.2943 1.89349 19.4707 2.31934L19.7236 2.93066C20.1556 3.97346 20.9615 4.80618 21.9746 5.25684L22.6924 5.57617C23.1026 5.75901 23.1026 6.3562 22.6924 6.53906L21.9326 6.87695C20.9449 7.31624 20.1534 8.11944 19.7139 9.12793L19.4668 9.69336C19.2864 10.1075 18.7137 10.1075 18.5332 9.69336L18.2871 9.12793C17.8476 8.11929 17.0552 7.31628 16.0674 6.87695L15.3076 6.53906C14.8974 6.35622 14.8974 5.75899 15.3076 5.57617L16.0254 5.25684C17.0385 4.80618 17.8445 3.97348 18.2764 2.93066L18.5293 2.31934Z" />
    </svg>
  );
}

function DeepSeekIcon({ className = "h-4 w-4 shrink-0 text-[#555555]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M19.7486 6.70266C20.3482 6.09168 21.0251 5.88487 21.8216 5.88487 22.4994 5.88487 22.8772 5.51788 23.1687 5.23481 23.3841 5.0256 23.5423 4.86223 23.7495 4.9267 23.9849 4.99995 24.0039 5.27202 23.9849 5.49211 23.8092 7.48319 22.5352 9.10375 20.5089 9.33432 20.3217 9.35326 20.2848 9.41777 20.2886 9.58097 20.2886 12.135 19.3023 14.3682 17.7413 16.3177 17.3773 16.7723 17.4617 17.397 18.0099 17.5934 18.2913 17.6942 18.6306 17.8197 19.0629 18.0261 19.3173 18.1475 19.3664 18.8022 18.6619 18.952 18.2141 19.0446 17.728 19.1012 17.2409 19.0989 16.0407 19.0932 14.7567 19.2619 13.6741 19.7802 12.5444 20.3211 11.5023 20.4276 10.5351 20.4832 6.05234 20.7487 1.91959 17.3891 1.14577 12.9829.4786 9.18832 2.57147 5.07162 6.66325 4.61173 7.14737 4.55719 7.62089 4.53981 8.0848 4.55739 8.87454 4.58733 9.6213 4.41281 10.366 4.23877 11.0506 4.07878 11.7335 3.9192 12.4464 3.9192 13.289 3.9192 13.4518 4.23796 13.1926 4.33093 12.9459 4.42011 12.0002 5.5 12.8219 6.09927 13.5751 6.5753 14.217 7.22865 14.859 7.88213 15.7004 8.73861 16.542 9.59533 17.6349 10.0534 17.8183 10.1293 17.8968 10.0914 17.9488 9.91865 17.984 9.80487 18.021 9.69242 18.0579 9.58018 18.1084 9.42668 18.1588 9.27358 18.2041 9.11798 18.2458 8.98703 18.2118 8.896 18.0803 8.80682 16.5019 7.7348 15.7807 5.49544 16.7241 3.7693 16.9257 3.40591 17.2152 3.45676 17.3454 3.8414 17.5002 4.5 17.6793 4.81997 18.5532 5.2113 19.1972 5.4997 19.6209 5.94937 19.7486 6.70266ZM12.2889 8.15848C10.7532 7.02012 8.79874 6.38384 6.88727 6.59919 5.50456 6.7546 4.48708 7.51265 3.84434 8.54596 4.06732 8.56243 4.31508 8.58934 4.58987 8.62966 6.85894 8.96265 8.79097 9.98777 10.3898 11.5802 11.3587 12.5454 12.1238 13.6898 12.8253 14.6671 13.4051 15.4748 13.9559 16.1921 14.5951 16.7793 15.8396 15.7081 16.6794 14.4169 17.0503 13.8 17.8977 12.3908 17.6928 12.2942 16.853 11.898 16.316 11.6446 15.5193 11.2687 14.5722 10.3488 13.5602 9.36588 13.0771 8.7451 12.2889 8.15848ZM3.11574 12.637C3.70717 16 6.70788 18.473 10.417 18.4867 11.3223 18.4901 12.1492 18.2666 12.8906 17.9119 12.2402 17.2517 11.6978 16.526 11.2006 15.8333 10.4412 14.7753 9.79818 13.8139 8.97846 12.9972 7.66251 11.6866 6.11607 10.8751 4.29954 10.6085 3.72541 10.5242 3.34242 10.5175 3.11076 10.5295 2.99297 11.2236 2.99407 11.9452 3.11574 12.637ZM15.1938 11.1427C14.7189 10.6785 13.9006 9.95702 13.1369 10.3762 12.0002 11 14.354 13.4813 15.472 13.4291 17.254 13.3458 15.7214 11.7533 15.1938 11.1427Z" />
    </svg>
  );
}

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

function ModelIcon({ modelId }: { modelId: string }) {
  if (modelId.startsWith("byteplus:")) return <BytePlusIcon className="h-4 w-4 shrink-0 text-[#555555]" aria-hidden="true" />;
  if (modelId.startsWith("deepseek/")) return <DeepSeekIcon />;
  if (modelId.startsWith("openai/")) return <RiOpenaiFill className="h-4 w-4 shrink-0 text-[#555555]" aria-hidden="true" />;
  if (modelId.startsWith("google/")) return <RiGoogleFill className="h-4 w-4 shrink-0 text-[#555555]" aria-hidden="true" />;
  if (modelId.startsWith("bytedance/") || modelId.startsWith("bytedance-seed/")) return <RiTiktokFill className="h-4 w-4 shrink-0 text-[#555555]" aria-hidden="true" />;
  return <AiGenerate3dIcon />;
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
            <span className="inline-flex items-center gap-2">
              <span>解除限制</span>
              <SettingSwitch checked={bytePlusUnlockLimits} disabled={isPending} onChange={(value) => saveSettings({ bytePlusUnlockLimits: value })} ariaLabel="BytePlus 解除限制开关" />
            </span>
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
          <span className="ml-2">选中工作流图片节点后顶部快捷菜单里的编辑功能。高清 / 橡皮工具走「首选→次选→三选」模型候选链，前一个失败或关闭自动用下一个；全部关闭时回落到完整候选链以免不可用。</span>
        </div>
        <div className="grid grid-cols-[140px_1fr_470px] border-b border-[#eeeeee] bg-[#fafafa] text-[12px] text-[#777777]">
          <div className="px-5 py-3 font-medium">功能</div>
          <div className="px-5 py-3 font-medium">规则说明</div>
          <div className="px-5 py-3 font-medium">使用模型（首选 / 次选 / 三选）</div>
        </div>
        {editFunctionRows.map((row) => (
          <div key={row.key} className="grid grid-cols-[140px_1fr_470px] border-b border-[#f2f2f2] last:border-b-0">
            <div className="px-5 py-4 font-medium text-[#222222]">{row.name}</div>
            <div className="px-5 py-4 text-[12px] leading-5 text-[#666666]">{row.rule}</div>
            <div className="px-5 py-4">
              {row.chain ? (
                <div className="flex flex-col gap-2">
                  {EDIT_MODEL_CHAIN.map((entry) => {
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
                <span className="text-[12px] text-[#999999]">{row.key === "bg" ? "本地抠图，无云模型" : "跟随源图模型，无候选链开关"}</span>
              )}
            </div>
          </div>
        ))}
      </section>

    </>
  );
}
