"use client";

import { useEffect, useRef, useState, useTransition, type ComponentType, type ReactNode, type SVGProps } from "react";
import { RiArrowDropDownFill, RiFilmAiLine, RiImageAiLine, RiMicAiLine, RiQuillPenAiLine, RiShieldCheckLine } from "react-icons/ri";
import { ADVANCED_CHAT_MODEL, DEFAULT_CHAT_MODEL, audioGenerationModels, frontendConversationModels, imageGenerationModels, models, videoGenerationModels } from "@/lib/models";
import type { AdminSystemSettings } from "@/lib/system-settings";
import { BytedanceIcon } from "@/components/bytedance-icon";
import { AiAgentLineIcon, ModelIcon } from "@/components/model-icon";


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
  icon: ComponentType<SVGProps<SVGSVGElement>>;
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
    title: "AI聊天对话",
    icon: AiAgentLineIcon,
    note: "",
    usageLocations: ["通用模式对话", "Agent 模式对话规划"],
    providerGroup: "通用模式 / Agent 规划 / 意图识别",
    additive: true,
    models: [
      ...models.filter((model) => model.id !== DEFAULT_CHAT_MODEL).map((model) => ({ provider: "openrouter" as const, badge: "", modelId: model.id })),
      { provider: "byteplus", badge: "", modelId: "", providerKey: "general.seed-2-0-lite", bytePlusStatic: bytePlusChatModels[0] },
      { provider: "byteplus", badge: "", modelId: "", providerKey: "general.seed-2-0-pro", bytePlusStatic: bytePlusChatModels[1] },
    ],
  },
  {
    title: "图片生成",
    icon: RiImageAiLine,
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
    icon: RiFilmAiLine,
    note: "",
    usageLocations: ["通用模式生视频", "Agent 模式生视频", "对话流视频", "工作流视频节点"],
    providerGroup: "对话流视频生成",
    additive: true,
    models: [
      ...videoGenerationModels.map((model) => ({ provider: "openrouter" as const, badge: "", modelId: model.id })),
      { provider: "byteplus", badge: "", modelId: "byteplus:video.seedance-2-0-mini", providerKey: "video.seedance-2-0-mini", bytePlusStatic: bytePlusVideoModels[0] },
      { provider: "byteplus", badge: "", modelId: "byteplus:video.seedance-2-0-fast", providerKey: "video.seedance-2-0-fast", bytePlusStatic: bytePlusVideoModels[1] },
      { provider: "byteplus", badge: "", modelId: "byteplus:video.seedance-2-0", providerKey: "video.seedance-2-0", bytePlusStatic: bytePlusVideoModels[2] },
      { provider: "byteplus", badge: "", modelId: "byteplus:video.seedance-2-5", providerKey: "video.seedance-2-5", bytePlusStatic: bytePlusVideoModels[3] },
    ],
  },
  {
    title: "语音生成",
    icon: RiMicAiLine,
    note: "",
    usageLocations: ["对话流语音生成"],
    providerGroup: "对话流语音生成",
    additive: true,
    models: audioGenerationModels.map((model) => ({ provider: "openrouter" as const, badge: "", modelId: model.id })),
  },
  {
    title: "反推提示词 / 优化提示词",
    icon: RiQuillPenAiLine,
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
    icon: RiShieldCheckLine,
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

function AgentPriorityModelMenu({ value, disabled, onChange, trailing }: { value: string; disabled?: boolean; onChange: (modelId: string) => void; trailing?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = frontendConversationModels.find((model) => model.id === value) ?? frontendConversationModels[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative w-full">
      <div className="inline-flex h-8 w-full items-center gap-2 rounded-[7px] bg-[#f4f6fb] px-2.5 text-[12px] text-[#333333]">
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen((current) => !current)}
          className="inline-flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ModelIcon modelId={selected?.id ?? ""} />
          <span className="min-w-0 flex-1 truncate font-medium">{selected?.label ?? ""}</span>
          <RiArrowDropDownFill className="h-5 w-5 shrink-0 text-[#888888]" aria-hidden="true" />
        </button>
        {trailing}
      </div>
      {open && !disabled ? (
        <div role="listbox" className="absolute left-0 top-full z-20 mt-1 w-full overflow-hidden rounded-[8px] border border-[#e5e5e5] bg-white py-1 shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
          {frontendConversationModels.map((model) => (
            <button
              key={model.id}
              type="button"
              role="option"
              aria-selected={model.id === selected?.id}
              onClick={() => {
                onChange(model.id);
                setOpen(false);
              }}
              className={`flex h-8 w-full items-center gap-2 px-2.5 text-left text-[12px] ${model.id === selected?.id ? "bg-[#eef4ff] text-[#222222]" : "text-[#333333] hover:bg-[#f6f7fb]"}`}
            >
              <ModelIcon modelId={model.id} />
              <span className="min-w-0 truncate font-medium">{model.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
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
        <BytedanceIcon className="h-4 w-4 shrink-0 text-[#555555]" aria-hidden="true" />
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
      <BytedanceIcon className="h-4 w-4 shrink-0 text-[#555555]" aria-hidden="true" />
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
  const [agentPriorityModelId, setAgentPriorityModelId] = useState(settings.agentPriorityModelId || "deepseek/deepseek-v4-pro");
  const [agentPriorityEnabled, setAgentPriorityEnabled] = useState(settings.agentPriorityEnabled);
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
    const nextAgentPriorityModelId = nextSettings?.agentPriorityModelId ?? agentPriorityModelId;
    const nextAgentPriorityEnabled = nextSettings?.agentPriorityEnabled ?? agentPriorityEnabled;
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
    setAgentPriorityModelId(nextAgentPriorityModelId);
    setAgentPriorityEnabled(nextAgentPriorityEnabled);
    setMessage("");
    startTransition(async () => {
      try {
        const response = await fetch("/admin/api/system-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ openRouterApiKey: nextOpenRouterKey, openRouterApiKeyEnabled: nextOpenRouterEnabled, bytePlusApiKey: nextBytePlusKey, bytePlusApiKeyEnabled: nextBytePlusEnabled, bytePlusUnlockLimits: nextBytePlusUnlockLimits, bytePlusRegion: nextBytePlusRegion, modelProviderPreferences: nextModelProviderPreferences, bytePlusModelSelections: nextBytePlusModelSelections, agentPriorityModelId: nextAgentPriorityModelId, agentPriorityEnabled: nextAgentPriorityEnabled }),
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
        setAgentPriorityModelId(data.settings.agentPriorityModelId);
        setAgentPriorityEnabled(data.settings.agentPriorityEnabled);
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

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-[24px] font-semibold tracking-[-0.03em]">模型开关</h1>
        <div className="text-[13px] text-[#777777]">管理员白名单：{adminEmailCount} 个邮箱</div>
      </div>

      <section className="min-w-[1180px]">
        <div className="grid w-[1180px] grid-cols-2 items-start gap-5">
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
        <div className="grid grid-cols-[220px_1fr] border-b border-[#eeeeee] bg-[#fafafa] text-[12px] text-[#777777]">
          <div className="px-5 py-3 font-medium">功能模块</div>
          <div className="grid grid-cols-[360px_70px_360px] px-5 py-3">
            <div className="font-medium">OpenRouter</div>
            <div className="text-center font-medium">说明</div>
            <div className="font-medium">BytePlus</div>
          </div>
        </div>
        {modelUsageGroups.map((group) => (
          <div key={group.title} className="grid grid-cols-[220px_1fr] border-b border-[#f2f2f2] last:border-b-0">
            <div className="flex flex-col gap-1.5 px-5 py-4">
              <div className="flex items-center gap-1.5 font-bold text-[#222222]">
                <group.icon className="h-4 w-4 shrink-0 text-[#555555]" aria-hidden="true" />
                <span>{group.title}</span>
              </div>
              {group.note ? <div className="text-[12px] leading-5 text-[#888888]">{group.note}</div> : null}
              {group.usageLocations.map((location) => (
                <div key={location} className="flex items-start gap-2 text-[13px] text-[#222222]">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#367cee]" />
                  <span>{location}</span>
                </div>
              ))}
              {group.title === "AI聊天对话" ? (
                <div className="mt-auto flex h-8 items-center gap-2 text-[13px] text-[#222222]">
                  <span className="h-1 w-1 shrink-0 rounded-full bg-[#367cee]" />
                  <span>Agent优先</span>
                </div>
              ) : null}
            </div>
            <div className="px-5 py-4">
              {group.additive ? (
                <div className="flex h-full flex-col gap-2">
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
                {group.title === "AI聊天对话" ? (
                  <div className="mt-auto grid grid-cols-[360px_70px_360px] items-center">
                    <AgentPriorityModelMenu
                      value={agentPriorityModelId}
                      disabled={agentPriorityEnabled || isPending}
                      onChange={(modelId) => saveSettings({ agentPriorityModelId: modelId })}
                      trailing={<SettingSwitch checked={agentPriorityEnabled} disabled={isPending} onChange={(value) => saveSettings({ agentPriorityEnabled: value })} ariaLabel="Agent优先模型开关" />}
                    />
                    <span />
                    <span />
                  </div>
                ) : null}
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
    </>
  );
}
