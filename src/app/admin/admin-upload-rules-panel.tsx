"use client";

import { useMemo, useState, useTransition } from "react";
import { ADVANCED_CHAT_MODEL, DEFAULT_AUDIO_MODEL, DEFAULT_CHAT_MODEL, DEFAULT_IMAGE_MODEL, audioGenerationModels, frontendImageGenerationModels, isFishAudioModel, SEEDANCE_25_VIDEO_MODEL_ID, videoGenerationModels, type GenerationModel } from "@/lib/models";
import { DEFAULT_PROMPT_MAX_LENGTH, getDefaultPromptMaxLength, getPromptLengthOverrideKey, normalizePromptMaxLength, PROMPT_MAX_LENGTH_CEILING, type PromptLengthOverrides } from "@/lib/prompt-length";
import { AiAgentLineIcon, ModelIcon } from "@/components/model-icon";
import { BYTEPLUS_SEEDANCE_25_UPLOAD_RULE_KEYS, BYTEPLUS_SEEDANCE_UPLOAD_RULE_KEYS, getUploadRule, getUploadRuleOverrideKey, type UploadKind, type UploadKindRule, type UploadRule, type UploadRuleOverrides } from "@/lib/upload-rules";

type EditableUploadRuleRow = {
  key: string;
  modelName: string;
  context: Parameters<typeof getUploadRule>[0];
};

// ⭐ 列顺序：提示词「文字」必须排在「文件」**前面**（2026-08-09 用户指定）。
const editableUploadKinds: Array<{ key: UploadKind; label: string }> = [
  { key: "document", label: "文件" },
  { key: "image", label: "图片" },
  { key: "video", label: "视频" },
  { key: "audio", label: "音频" },
];

// ⭐ 2026-08-09 用户要求：删掉原来的第一列「提供商 + 模型类型」（表太宽），
//    供应商信息改由「模型名称」前面的图标表达（图标映射唯一实现：@/components/model-icon）。
const editableTableGridClass = "grid grid-cols-[340px_170px_150px_150px_150px_150px]";

function SettingSwitch({ checked, disabled, onChange, ariaLabel }: { checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void; ariaLabel: string }) {
  return (
    <button type="button" aria-label={ariaLabel} aria-pressed={checked} disabled={disabled} onClick={() => onChange(!checked)} className={`relative h-5 w-9 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "bg-[#367cee]" : "bg-[#d8d8d8]"}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${checked ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

function getEditableUploadRuleRows(enabledImageModelIds: string[], enabledVideoModelIds: string[], enabledAudioModelIds: string[]): EditableUploadRuleRow[] {
  const imageEnabled = new Set(enabledImageModelIds);
  const videoEnabled = new Set(enabledVideoModelIds);
  const audioEnabled = new Set(enabledAudioModelIds);
  const openRouterImageRows = frontendImageGenerationModels.filter((model) => !model.id.startsWith("byteplus:") && imageEnabled.has(model.id)).map((model) => makeModelRow(model, { mode: "image", modelId: model.id, transportMode: "local-base64" }));
  const openRouterVideoRows = videoGenerationModels.filter((model) => videoEnabled.has(model.id)).map((model) => makeModelRow(model, { mode: "video", modelId: model.id, transportMode: "local-base64" }));
  const enabledAudioModels = audioGenerationModels.filter((model) => audioEnabled.has(model.id));
  const fishModel = enabledAudioModels.find((model) => isFishAudioModel(model.id));
  const fishAudioRows: EditableUploadRuleRow[] = fishModel
    ? [
        { key: getUploadRuleOverrideKey({ mode: "audio", modelId: fishModel.id }), modelName: "Fish Audio · 文本转换", context: { mode: "audio", modelId: fishModel.id, transportMode: "local-base64" } },
        { key: getUploadRuleOverrideKey({ mode: "audio", modelId: fishModel.id, audioReferenceMode: "clone" }), modelName: "Fish Audio · 音色克隆", context: { mode: "audio", modelId: fishModel.id, transportMode: "local-base64", audioReferenceMode: "clone" } },
      ]
    : [];
  const otherAudioRows = enabledAudioModels.filter((model) => !isFishAudioModel(model.id)).map((model) => makeModelRow(model, { mode: "audio", modelId: model.id, transportMode: "local-base64" }));
  const audioRows = [...fishAudioRows, ...otherAudioRows];
  const bytePlusImageRows = frontendImageGenerationModels.filter((model) => model.id.startsWith("byteplus:") && imageEnabled.has(model.id)).map((model) => makeModelRow(model, { mode: "image", modelId: model.id, transportMode: "local-base64" }));
  const bytePlusVideoRows: EditableUploadRuleRow[] = [
    // ⭐ 2.0 系与 2.5 是**两组独立 key**（getSeedanceUploadRuleKeys），所以这里必须各列 3 行；
    //    每一行的 context.modelId 必须写对应那一代的模型 id，否则 fallback 数字（面板上显示的默认值）会取错。
    { key: BYTEPLUS_SEEDANCE_UPLOAD_RULE_KEYS.reference, modelName: "Seedance 2.0 / Fast / Mini · 融合模式", context: { mode: "video", modelId: "byteplus:video.seedance-2-0", transportMode: "local-base64", videoReferenceMode: "reference" } },
    { key: BYTEPLUS_SEEDANCE_UPLOAD_RULE_KEYS.firstFrame, modelName: "Seedance 2.0 / Fast / Mini · 首帧模式", context: { mode: "video", modelId: "byteplus:video.seedance-2-0", transportMode: "local-base64", videoReferenceMode: "first_frame" } },
    { key: BYTEPLUS_SEEDANCE_UPLOAD_RULE_KEYS.firstLastFrame, modelName: "Seedance 2.0 / Fast / Mini · 首尾帧模式", context: { mode: "video", modelId: "byteplus:video.seedance-2-0", transportMode: "local-base64", videoReferenceMode: "first_last_frame" } },
    { key: BYTEPLUS_SEEDANCE_25_UPLOAD_RULE_KEYS.reference, modelName: "Seedance 2.5 · 融合模式", context: { mode: "video", modelId: SEEDANCE_25_VIDEO_MODEL_ID, transportMode: "local-base64", videoReferenceMode: "reference" } },
    { key: BYTEPLUS_SEEDANCE_25_UPLOAD_RULE_KEYS.firstFrame, modelName: "Seedance 2.5 · 首帧模式", context: { mode: "video", modelId: SEEDANCE_25_VIDEO_MODEL_ID, transportMode: "local-base64", videoReferenceMode: "first_frame" } },
    { key: BYTEPLUS_SEEDANCE_25_UPLOAD_RULE_KEYS.firstLastFrame, modelName: "Seedance 2.5 · 首尾帧模式", context: { mode: "video", modelId: SEEDANCE_25_VIDEO_MODEL_ID, transportMode: "local-base64", videoReferenceMode: "first_last_frame" } },
  ];
  return [
    {
      key: "chat",
      modelName: `全部对话模型（${DEFAULT_CHAT_MODEL} / ${ADVANCED_CHAT_MODEL} 等）`,
      context: { mode: "general", modelId: DEFAULT_CHAT_MODEL, transportMode: "local-base64" },
    },
    ...openRouterImageRows,
    ...openRouterVideoRows,
    ...audioRows,
    ...bytePlusImageRows,
    ...bytePlusVideoRows,
  ];
}

function makeModelRow(model: GenerationModel, context: EditableUploadRuleRow["context"]): EditableUploadRuleRow {
  return {
    key: getUploadRuleOverrideKey(context),
    modelName: model.label,
    context,
  };
}

function getKindDraft(overrides: UploadRuleOverrides, row: EditableUploadRuleRow, kind: UploadKind, fallback: UploadKindRule) {
  const override = overrides[row.key]?.[kind];
  return {
    enabled: override?.enabled ?? fallback.enabled,
    maxCount: override?.maxCount ?? fallback.maxCount,
  };
}

function normalizeCount(value: number) {
  return Math.max(0, Math.min(99, Math.floor(Number.isFinite(value) ? value : 0)));
}

function getPromptDraft(overrides: PromptLengthOverrides, promptKey: string, defaultMaxLength: number) {
  const override = overrides[promptKey];
  // ⭐ 没配过 = 「该模型的默认值 + 开关开着」（Seedance 2.0 系 3500、2.5 是 14500、其余 2000），
  //    和运行时 getPromptMaxLength 的默认完全一致。
  //    ⛔ 这里绝不能写死 2000 —— 面板显示 2000 而实际生效 14500，管理员一保存就把 2.5 砍到 2000。
  return {
    enabled: override?.enabled ?? true,
    maxLength: override?.maxLength ?? defaultMaxLength,
  };
}

/**
 * 「文字」列的单元格。⭐ **一个模型只有一个开关**：
 * 同一个模型的多个参考模式行（Seedance 融合 / 首帧 / 首尾帧）只有**第一行**给出输入框，
 * 其余行显示「跟随上面」——运行时它们本来就取同一个 key，不存在配不到的问题。
 */
function EditablePromptLengthCell({ promptKey, owner, defaultMaxLength, draft, disabled, ariaPrefix, onChange }: { promptKey: string; owner: boolean; defaultMaxLength: number; draft: PromptLengthOverrides; disabled?: boolean; ariaPrefix: string; onChange: (promptKey: string, patch: { enabled?: boolean; maxLength?: number }, saveNow?: boolean) => void }) {
  if (!owner) return <div className="px-4 py-3 text-[#999999]">跟随上面</div>;
  const value = getPromptDraft(draft, promptKey, defaultMaxLength);
  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <input
        type="text"
        inputMode="numeric"
        value={String(value.maxLength)}
        disabled={value.enabled || disabled}
        onChange={(event) => {
          const next = event.target.value.replace(/\D/g, "").slice(0, 5);
          onChange(promptKey, { maxLength: next ? normalizePromptMaxLength(Number(next)) : 1 });
        }}
        onBlur={() => onChange(promptKey, { enabled: value.enabled, maxLength: value.maxLength }, true)}
        className="h-8 w-[80px] rounded-[8px] border border-[#e5e5e5] bg-white px-2 text-center text-[13px] text-[#222222] outline-none transition focus:border-[#367cee] disabled:bg-[#f3f3f3] disabled:text-[#999999]"
      />
      <SettingSwitch checked={value.enabled} disabled={disabled} onChange={(checked) => onChange(promptKey, { enabled: checked, maxLength: value.maxLength }, true)} ariaLabel={`${ariaPrefix}-提示词字数开关`} />
    </div>
  );
}

type UploadRuleRow = {
  scene: string;
  model: string;
  rule: UploadRule;
  note: string;
  details?: Partial<Record<"image" | "document" | "video" | "audio", string>>;
  incomplete?: Partial<Record<"image" | "document" | "video" | "audio", string>>;
};

const imageFormatText = "格式 jpg/jpeg/png/webp（全站统一，不含 bmp/tiff/gif/heic）。上传图和 @资产引用合并计数。";

const uploadRuleRows: UploadRuleRow[] = [
  {
    scene: "通用 / Agent",
    model: "对话模型",
    rule: getUploadRule({ mode: "general", transportMode: "local-base64" }),
    note: "通用和 Agent 同一套：可传图片和文档，不支持视频/音频。",
    details: {
      image: imageFormatText,
      document: "格式 pdf/txt/csv/docx/doc/xlsx/xls/pptx/ppt/md。",
    },
  },
  {
    scene: "对话流 / 资产库图片",
    model: "Seedream / Gemini 等",
    rule: getUploadRule({ mode: "image", modelId: DEFAULT_IMAGE_MODEL, transportMode: "local-base64" }),
    note: "默认图片模型：最多 3 张、单张≤8MB。不支持文件/视频/音频。",
    details: { image: imageFormatText },
  },
  {
    scene: "对话流 / 资产库图片",
    model: "GPT-5.4 Image 2",
    rule: getUploadRule({ mode: "image", modelId: "openai/gpt-5.4-image-2", transportMode: "local-base64" }),
    note: "走 /api/v1/images，参考图最多 16 张、单张≤10MB。",
    details: { image: imageFormatText },
  },
  {
    scene: "对话流 / 资产库图片",
    model: "Recraft V4.1 / Pro",
    rule: getUploadRule({ mode: "image", modelId: "recraft/recraft-v4.1", transportMode: "local-base64" }),
    note: "上游硬上限 1 张参考图。不支持文件/视频/音频。",
    details: { image: imageFormatText },
  },
  {
    scene: "对话流 / 资产库图片",
    model: "BytePlus Seedream（本地）",
    rule: getUploadRule({ mode: "image", modelId: "byteplus:conversation-image.seedream-4-5", transportMode: "local-base64" }),
    note: "4.5 / Lite / Pro 同一套。本地 Base64 入口最多 6 张、单张≤30MB。",
    details: { image: imageFormatText },
  },
  {
    scene: "对话流 / 资产库图片",
    model: "BytePlus Seedream（服务器 URL）",
    rule: getUploadRule({ mode: "image", modelId: "byteplus:conversation-image.seedream-4-5", transportMode: "server-url" }),
    note: "服务器 URL 入口按火山上限最多 14 张、单张≤30MB。",
    details: { image: imageFormatText },
  },
  {
    scene: "对话流语音",
    model: "文本转换",
    rule: getUploadRule({ mode: "audio", modelId: DEFAULT_AUDIO_MODEL, transportMode: "local-base64" }),
    note: "MiniMax / Qwen / Fish 文本转换都不吃参考文件。",
  },
  {
    scene: "对话流语音",
    model: "Fish 音色克隆",
    rule: getUploadRule({ mode: "audio", modelId: "fish-audio/s2.1-pro", transportMode: "local-base64", audioReferenceMode: "clone" }),
    note: "收费和免费共用。只支持 1 段参考音频。",
    details: { audio: "mp3/wav；1 个；10-60 秒、≤15MB。" },
  },
  {
    scene: "对话流视频",
    model: "Kling / Veo",
    rule: getUploadRule({ mode: "video", modelId: "kwaivgi/kling-v3.0-std", transportMode: "local-base64" }),
    note: "只支持图片参考，最多 2 张。不支持参考视频/音频。",
    details: { image: imageFormatText },
  },
  {
    scene: "对话流视频",
    model: "MiniMax Hailuo 3",
    rule: getUploadRule({ mode: "video", modelId: "minimax/hailuo-3", transportMode: "local-base64", videoReferenceMode: "reference" }),
    note: "只支持图片。融合最多 9 张；首帧/尾帧 1 张；首尾帧 2 张。参考视频/音频不支持。",
    details: { image: imageFormatText },
  },
  {
    scene: "对话流视频",
    model: "OpenRouter Seedance",
    rule: getUploadRule({ mode: "video", modelId: "bytedance/seedance-2.0-fast", transportMode: "local-base64" }),
    note: "只支持图片参考，最多 3 张。不支持参考视频/音频。",
    details: { image: imageFormatText },
  },
  {
    scene: "对话流视频",
    model: "Seedance 2.0 / Fast / Mini · 融合",
    rule: getUploadRule({ mode: "video", modelId: "byteplus:video.seedance-2-0", transportMode: "server-url", videoReferenceMode: "reference" }),
    note: "2.0 系共用。融合可传图/视频/音频。首帧只 1 张图、首尾帧只 2 张图，不支持视频/音频。",
    details: {
      image: `${imageFormatText}融合最多 9 张。`,
      video: "mp4/mov；最多 3 个；单个 2-15 秒、≤200MB；总时长≤15 秒。",
      audio: "mp3/wav；最多 3 个；单个 2-15 秒、≤15MB；总时长≤15 秒。不能单独传音频，必须带图或视频。",
    },
  },
  {
    scene: "对话流视频",
    model: "Seedance 2.5 · 融合",
    rule: getUploadRule({ mode: "video", modelId: SEEDANCE_25_VIDEO_MODEL_ID, transportMode: "server-url", videoReferenceMode: "reference" }),
    note: "与 2.0 独立配置。融合可传图/视频/音频。首帧 1 张图、首尾帧 2 张图。",
    details: {
      image: `${imageFormatText}融合最多 30 张。`,
      video: "mp4/mov；最多 10 个；单个 2-30 秒、≤200MB；总时长≤30 秒。",
      audio: "mp3/wav；最多 10 个；单个 2-30 秒、≤15MB；总时长≤30 秒。可以只传音频。",
    },
  },
  {
    scene: "对话流视频",
    model: "Seedance 2.5 · 编辑 / 延长",
    rule: getUploadRule({ mode: "video", modelId: SEEDANCE_25_VIDEO_MODEL_ID, transportMode: "server-url", videoReferenceMode: "edit" }),
    note: "只吃 1 个源视频，图片/音频按钮隐藏。源视频必须 4-30 秒。",
    details: { video: "mp4/mov；1 个；4-30 秒、≤200MB。" },
  },
];

function formatKindRule(rule: UploadKindRule, label: string) {
  if (!rule.enabled) return "不支持";
  const parts = [`最多${rule.maxCount}${label}`];
  if (rule.maxSizeMb > 0) parts.push(`单个≤${rule.maxSizeMb}MB`);
  if (rule.minSeconds !== undefined && rule.maxSeconds !== undefined) parts.push(`${rule.minSeconds}-${rule.maxSeconds}秒`);
  if (rule.maxTotalSeconds !== undefined) parts.push(`总≤${rule.maxTotalSeconds}秒`);
  if (rule.requiresServerUrl) parts.push("需服务器URL");
  parts.push(rule.formats.join("/"));
  return parts.join("，");
}

function UploadRuleCell({ rule, label, detail, incomplete }: { rule: UploadKindRule; label: string; detail?: string; incomplete?: string }) {
  return (
    <div className="break-words px-4 py-3">
      <div>{formatKindRule(rule, label)}</div>
      {detail ? <div className="mt-1 text-[12px] leading-5 text-[#777777]">{detail}</div> : null}
      {incomplete ? <div className="mt-1 text-[12px] leading-5 text-red-500">{incomplete}</div> : null}
    </div>
  );
}

function EditableUploadRuleCell({ row, kind, fallback, draft, disabled, onChange }: { row: EditableUploadRuleRow; kind: UploadKind; fallback: UploadKindRule; draft: UploadRuleOverrides; disabled?: boolean; onChange: (rowKey: string, kind: UploadKind, patch: { enabled?: boolean; maxCount?: number }, saveNow?: boolean) => void }) {
  if (!fallback.enabled) return <div className="px-4 py-3 text-[#999999]">不支持</div>;
  const value = getKindDraft(draft, row, kind, fallback);
  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <input
        type="text"
        inputMode="numeric"
        value={String(value.maxCount)}
        disabled={value.enabled || disabled}
        onChange={(event) => {
          const next = event.target.value.replace(/\D/g, "");
          onChange(row.key, kind, { maxCount: normalizeCount(Number(next || 0)) });
        }}
        onBlur={() => onChange(row.key, kind, { enabled: value.enabled, maxCount: value.maxCount }, true)}
        className="h-8 w-[64px] rounded-[8px] border border-[#e5e5e5] bg-white px-2 text-center text-[13px] text-[#222222] outline-none transition focus:border-[#367cee] disabled:bg-[#f3f3f3] disabled:text-[#999999]"
      />
      <SettingSwitch checked={value.enabled} disabled={disabled} onChange={(checked) => onChange(row.key, kind, { enabled: checked, maxCount: value.maxCount }, true)} ariaLabel={`${row.modelName}-${kind}-上传开关`} />
    </div>
  );
}

export function AdminUploadRulesPanel({ initialUploadRuleOverrides = {}, initialPromptLengthOverrides = {}, enabledImageModelIds = [], enabledVideoModelIds = [], enabledAudioModelIds = [] }: { initialUploadRuleOverrides?: UploadRuleOverrides; initialPromptLengthOverrides?: PromptLengthOverrides; enabledImageModelIds?: string[]; enabledVideoModelIds?: string[]; enabledAudioModelIds?: string[] }) {
  const rows = useMemo(() => getEditableUploadRuleRows(enabledImageModelIds, enabledVideoModelIds, enabledAudioModelIds), [enabledImageModelIds, enabledVideoModelIds, enabledAudioModelIds]);
  // ⭐ 每一行算出它的「文字」key，并标出这个 key 的**第一行**（只有它显示输入框，其余行「跟随上面」）。
  const promptRowMeta = useMemo(() => {
    const seen = new Set<string>();
    return rows.map((row) => {
      const context = { mode: row.context.mode, modelId: row.context.modelId };
      const promptKey = getPromptLengthOverrideKey(context);
      const owner = !seen.has(promptKey);
      seen.add(promptKey);
      return { promptKey, owner, defaultMaxLength: getDefaultPromptMaxLength(context) };
    });
  }, [rows]);
  const [draft, setDraft] = useState<UploadRuleOverrides>(initialUploadRuleOverrides);
  const [promptDraft, setPromptDraft] = useState<PromptLengthOverrides>(initialPromptLengthOverrides);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  // ⛔ 只把"本次真的改了的那一半"发上去（接口对没带的字段保持原样），
  //    否则改文字会把上传数量整份清空、反之亦然。
  const save = (payload: { uploadRuleOverrides?: UploadRuleOverrides; promptLengthOverrides?: PromptLengthOverrides }) => {
    setMessage("");
    startTransition(async () => {
      try {
        const response = await fetch("/admin/api/upload-rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const data = (await response.json().catch(() => ({}))) as { error?: string; uploadRuleOverrides?: UploadRuleOverrides; promptLengthOverrides?: PromptLengthOverrides };
        if (!response.ok || !data.uploadRuleOverrides) throw new Error(data.error || "保存失败");
        setDraft(data.uploadRuleOverrides);
        if (data.promptLengthOverrides) setPromptDraft(data.promptLengthOverrides);
        setMessage("已保存");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "保存失败");
      }
    });
  };

  const updateCell = (rowKey: string, kind: UploadKind, patch: { enabled?: boolean; maxCount?: number }, saveNow = false) => {
    const nextDraft: UploadRuleOverrides = {
      ...draft,
      [rowKey]: {
        ...(draft[rowKey] ?? {}),
        [kind]: {
          enabled: patch.enabled ?? draft[rowKey]?.[kind]?.enabled ?? true,
          maxCount: normalizeCount(patch.maxCount ?? draft[rowKey]?.[kind]?.maxCount ?? 0),
        },
      },
    };
    setDraft(nextDraft);
    if (saveNow) save({ uploadRuleOverrides: nextDraft });
  };

  const updatePromptCell = (promptKey: string, patch: { enabled?: boolean; maxLength?: number }, saveNow = false) => {
    const meta = promptRowMeta.find((item) => item.promptKey === promptKey);
    const current = getPromptDraft(promptDraft, promptKey, meta?.defaultMaxLength ?? DEFAULT_PROMPT_MAX_LENGTH);
    const nextPromptDraft: PromptLengthOverrides = {
      ...promptDraft,
      [promptKey]: {
        enabled: patch.enabled ?? current.enabled,
        maxLength: normalizePromptMaxLength(patch.maxLength ?? current.maxLength),
      },
    };
    setPromptDraft(nextPromptDraft);
    if (saveNow) save({ promptLengthOverrides: nextPromptDraft });
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-[24px] font-semibold tracking-[-0.03em]">上传规则</h1>
        <div className="text-[13px] text-[#777777]">对话流生成和资产库生成共用同一套规则</div>
      </div>

      <section className="mb-8 min-w-[1110px] overflow-hidden rounded-[10px] border border-[#eeeeee] bg-white text-[13px] shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between gap-4 border-b border-[#eeeeee] bg-[#fafafa] px-5 py-4">
          <div>
            <div className="text-[15px] font-medium text-[#222222]">模型上传数量 + 提示词字数配置</div>
            <div className="mt-1 text-[12px] leading-5 text-[#888888]">这里优先于下方兜底规则。关闭开关后可修改数值，打开后启用该数值。「文字」= 提示词最多多少字（默认按模型给：Seedance 2.0 系 3500、Seedance 2.5 是 14500、其余 {DEFAULT_PROMPT_MAX_LENGTH}，最大 {PROMPT_MAX_LENGTH_CEILING}），一个模型只有一个，同一模型的多个参考模式共用（后面几行显示「跟随上面」）。</div>
          </div>
          <div className={`text-[12px] ${message.includes("失败") ? "text-red-500" : "text-[#367cee]"}`}>{isPending ? "保存中..." : message}</div>
        </div>
        <div className={`${editableTableGridClass} border-b border-[#eeeeee] bg-[#fafafa] text-[12px] font-medium text-[#777777]`}>
          <div className="px-4 py-3">模型名称</div>
          <div className="px-4 py-3">文字</div>
          {editableUploadKinds.map((kind) => <div key={kind.key} className="px-4 py-3">{kind.label}</div>)}
        </div>
        {rows.map((row, index) => {
          const fallback = getUploadRule(row.context);
          const promptMeta = promptRowMeta[index];
          return (
            <div key={row.key} className={`${editableTableGridClass} border-b border-[#f2f2f2] text-[12px] leading-5 text-[#444444] last:border-b-0`}>
              {/* 供应商靠图标表达（原来那一列文字已按用户要求删掉）。图标映射唯一实现见 @/components/model-icon。
                  ⭐「全部对话模型」那行不是某个具体供应商，用 Agent 图标（和前台"通用模式"同一个图标）。 */}
              <div className="flex items-start gap-2 break-words px-4 py-3 text-[#333333]">
                <span className="mt-[2px] shrink-0">
                  {row.key === "chat" ? <AiAgentLineIcon className="h-4 w-4 shrink-0 text-[#555555]" /> : <ModelIcon modelId={row.context.modelId ?? ""} />}
                </span>
                <span className="min-w-0 break-words">{row.modelName}</span>
              </div>
              <EditablePromptLengthCell promptKey={promptMeta.promptKey} owner={promptMeta.owner} defaultMaxLength={promptMeta.defaultMaxLength} draft={promptDraft} disabled={isPending} ariaPrefix={row.modelName} onChange={updatePromptCell} />
              {editableUploadKinds.map((kind) => <EditableUploadRuleCell key={kind.key} row={row} kind={kind.key} fallback={fallback[kind.key]} draft={draft} disabled={isPending} onChange={updateCell} />)}
            </div>
          );
        })}
      </section>

      <section className="min-w-[1180px] overflow-hidden rounded-[10px] border border-[#eeeeee] bg-white text-[13px] shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
        <div className="border-b border-[#eeeeee] bg-[#fafafa] px-5 py-4">
          <div className="text-[15px] font-medium text-[#222222]">上传规则</div>
          <div className="mt-1 text-[12px] leading-5 text-[#888888]">对话流生成和资产库生成共用同一套规则；上传图片和 @资产引用都会计入参考图数量。</div>
        </div>
        <div className="grid grid-cols-[210px_170px_240px_150px_220px_180px] border-b border-[#eeeeee] bg-[#fafafa] text-[12px] font-medium text-[#777777]">
          <div className="px-4 py-3">使用场景</div>
          <div className="px-4 py-3">模型范围</div>
          <div className="px-4 py-3">图片</div>
          <div className="px-4 py-3">文件</div>
          <div className="px-4 py-3">视频</div>
          <div className="px-4 py-3">音频</div>
        </div>
        {uploadRuleRows.map((row) => (
          <div key={`${row.scene}-${row.model}`} className="grid grid-cols-[210px_170px_240px_150px_220px_180px] border-b border-[#f2f2f2] text-[12px] leading-5 text-[#444444] last:border-b-0">
            <div className="px-4 py-3">
              <div className="font-medium text-[#222222]">{row.scene}</div>
              <div className="mt-1 text-[12px] leading-5 text-[#888888]">{row.note}</div>
            </div>
            <div className="break-words px-4 py-3 text-[#333333]">{row.model}</div>
            <UploadRuleCell rule={row.rule.image} label="张" detail={row.details?.image} incomplete={row.incomplete?.image} />
            <UploadRuleCell rule={row.rule.document} label="个" detail={row.details?.document} incomplete={row.incomplete?.document} />
            <UploadRuleCell rule={row.rule.video} label="个" detail={row.details?.video} incomplete={row.incomplete?.video} />
            <UploadRuleCell rule={row.rule.audio} label="个" detail={row.details?.audio} incomplete={row.incomplete?.audio} />
          </div>
        ))}
      </section>
    </>
  );
}
