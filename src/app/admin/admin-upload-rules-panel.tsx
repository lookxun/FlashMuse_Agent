"use client";

import { useMemo, useState, useTransition } from "react";
import { ADVANCED_CHAT_MODEL, DEFAULT_CHAT_MODEL, DEFAULT_IMAGE_MODEL, frontendImageGenerationModels, videoGenerationModels, type GenerationModel } from "@/lib/models";
import { BYTEPLUS_SEEDANCE_UPLOAD_RULE_KEYS, getUploadRule, getUploadRuleOverrideKey, type UploadKind, type UploadKindRule, type UploadRule, type UploadRuleOverrides } from "@/lib/upload-rules";

type EditableUploadRuleRow = {
  key: string;
  providerType: string;
  modelName: string;
  context: Parameters<typeof getUploadRule>[0];
};

const editableUploadKinds: Array<{ key: UploadKind; label: string }> = [
  { key: "document", label: "文件" },
  { key: "image", label: "图片" },
  { key: "video", label: "视频" },
  { key: "audio", label: "音频" },
];

function SettingSwitch({ checked, disabled, onChange, ariaLabel }: { checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void; ariaLabel: string }) {
  return (
    <button type="button" aria-label={ariaLabel} aria-pressed={checked} disabled={disabled} onClick={() => onChange(!checked)} className={`relative h-5 w-9 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "bg-[#367cee]" : "bg-[#d8d8d8]"}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${checked ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

function getProviderLabel(modelId: string) {
  if (modelId.startsWith("byteplus:")) return "BytePlus";
  return "OpenRouter";
}

function getEditableUploadRuleRows(): EditableUploadRuleRow[] {
  const openRouterImageRows = frontendImageGenerationModels.filter((model) => !model.id.startsWith("byteplus:")).map((model) => makeModelRow(model, "图片模型", { mode: "image", modelId: model.id, transportMode: "local-base64" }));
  const openRouterVideoRows = videoGenerationModels.map((model) => makeModelRow(model, "视频模型", { mode: "video", modelId: model.id, transportMode: "local-base64" }));
  const bytePlusImageRows = frontendImageGenerationModels.filter((model) => model.id.startsWith("byteplus:")).map((model) => makeModelRow(model, "图片模型", { mode: "image", modelId: model.id, transportMode: "local-base64" }));
  const bytePlusVideoRows: EditableUploadRuleRow[] = [
    { key: BYTEPLUS_SEEDANCE_UPLOAD_RULE_KEYS.reference, providerType: "BytePlus · 视频模型", modelName: "Seedance 2.0 / Fast · 融合模式", context: { mode: "video", modelId: "byteplus:video.seedance-2-0", transportMode: "local-base64", videoReferenceMode: "reference" } },
    { key: BYTEPLUS_SEEDANCE_UPLOAD_RULE_KEYS.firstFrame, providerType: "BytePlus · 视频模型", modelName: "Seedance 2.0 / Fast · 首帧模式", context: { mode: "video", modelId: "byteplus:video.seedance-2-0", transportMode: "local-base64", videoReferenceMode: "first_frame" } },
    { key: BYTEPLUS_SEEDANCE_UPLOAD_RULE_KEYS.firstLastFrame, providerType: "BytePlus · 视频模型", modelName: "Seedance 2.0 / Fast · 首尾帧模式", context: { mode: "video", modelId: "byteplus:video.seedance-2-0", transportMode: "local-base64", videoReferenceMode: "first_last_frame" } },
  ];
  return [
    {
      key: "chat",
      providerType: "统一 · 对话模型",
      modelName: `全部对话模型（${DEFAULT_CHAT_MODEL} / ${ADVANCED_CHAT_MODEL} 等）`,
      context: { mode: "general", modelId: DEFAULT_CHAT_MODEL, transportMode: "local-base64" },
    },
    ...openRouterImageRows,
    ...openRouterVideoRows,
    ...bytePlusImageRows,
    ...bytePlusVideoRows,
  ];
}

function makeModelRow(model: GenerationModel, modelType: "图片模型" | "视频模型", context: EditableUploadRuleRow["context"]): EditableUploadRuleRow {
  return {
    key: getUploadRuleOverrideKey(context),
    providerType: `${getProviderLabel(model.id)} · ${modelType}`,
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

type UploadRuleRow = {
  scene: string;
  model: string;
  rule: UploadRule;
  note: string;
  details?: Partial<Record<"image" | "document" | "video" | "audio", string>>;
  incomplete?: Partial<Record<"image" | "document" | "video" | "audio", string>>;
};

const bytePlusImageReferenceRuleText = "图片参考完整规则：jpg/jpeg/png/webp/bmp/tiff/tif/gif/heic/heif；单张≤30MB；上传图片和 @资产引用合并计数；按用户显式 @ 顺序传入，并去重。";
const bytePlusImageOfficialLimitText = "火山官方 URL 参考图上限为 14 张；当前前端本地 Base64 入口为控制请求体，限制为 6 张。";
const seedanceImageReferenceRuleText = "图片参考完整规则：jpg/jpeg/png/webp/bmp/tiff/tif/gif/heic/heif；融合模式最多 9 张，按 reference_image 传入；首帧模式只用 1 张 first_frame；首尾帧模式用 2 张 first_frame/last_frame；三种模式互斥，只有融合模式支持参考视频/音频。";

const uploadRuleRows: UploadRuleRow[] = [
  {
    scene: "通用模式",
    model: "通用 Agent 规则",
    rule: getUploadRule({ mode: "general", transportMode: "local-base64" }),
    note: "用于通用问答、任务规划、看图理解和后续生图/生视频规划；当前入口允许图片和文档，不开放视频/音频上传。",
  },
  {
    scene: "Agent 模式",
    model: "通用安全规则",
    rule: getUploadRule({ mode: "agent", transportMode: "local-base64" }),
    note: "用于普通对话、规划、理解上传内容。",
  },
  {
    scene: "对话流图片 / 资产库图片",
    model: "OpenRouter 图片模型",
    rule: getUploadRule({ mode: "image", modelId: DEFAULT_IMAGE_MODEL, transportMode: "local-base64" }),
    note: "Seedream / Gemini / GPT 图片模型统一保守限制；图片模型文件输入未做实，文件列按不支持处理。",
  },
  {
    scene: "对话流图片 / 资产库图片",
    model: "BytePlus 图片模型（本地测试）",
    rule: getUploadRule({ mode: "image", modelId: "byteplus:conversation-image.seedream-4-5", transportMode: "local-base64" }),
    note: "当前本地继续 Base64 打包测试，先限制 6 张。",
    details: { image: `${bytePlusImageReferenceRuleText}${bytePlusImageOfficialLimitText}` },
    incomplete: { image: "特殊格式 heic/heif/tiff/bmp/gif 仅规则记录，浏览器预览未完整做实。" },
  },
  {
    scene: "对话流图片 / 资产库图片",
    model: "BytePlus 图片模型（服务器 URL）",
    rule: getUploadRule({ mode: "image", modelId: "byteplus:conversation-image.seedream-4-5", transportMode: "server-url" }),
    note: "部署到公网服务器后，上传文件生成服务器 URL，可按官方 14 张上限。",
    details: { image: `${bytePlusImageReferenceRuleText}服务器 URL 模式按火山官方上限最多 14 张。` },
    incomplete: { image: "服务器 URL 传模型链路未做实。" },
  },
  {
    scene: "对话流视频",
    model: "OpenRouter Seedance 视频",
    rule: getUploadRule({ mode: "video", modelId: "bytedance/seedance-2.0-fast", transportMode: "local-base64" }),
    note: "当前仅开放图片参考。",
  },
  {
    scene: "对话流视频",
    model: "OpenRouter Kling / Veo",
    rule: getUploadRule({ mode: "video", modelId: "kwaivgi/kling-v3.0-std", transportMode: "local-base64" }),
    note: "Kling 和 Veo 统一保守限制，当前仅开放图片参考。",
  },
  {
    scene: "对话流视频",
    model: "BytePlus Seedance 2.0 系列",
    rule: getUploadRule({ mode: "video", modelId: "byteplus:video.seedance-2-0", transportMode: "server-url" }),
    note: "融合模式支持图片、视频、音频参考上传；首帧/首尾帧模式只支持图片。参考视频/音频按服务器公网 URL 传入模型。",
    details: {
      image: seedanceImageReferenceRuleText,
      video: "视频参考完整规则：mp4/mov；最多 3 个；单个 2-15 秒、≤50MB；总时长≤15秒；宽高比 0.4-2.5；宽高 300-6000px；总像素 409600-2086876。",
      audio: "音频参考完整规则：mp3/wav；最多 3 个；单个 2-15 秒、≤15MB；总时长≤15秒；不能单独输入，必须同时有参考图片或参考视频。",
    },
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

export function AdminUploadRulesPanel({ initialUploadRuleOverrides = {} }: { initialUploadRuleOverrides?: UploadRuleOverrides }) {
  const rows = useMemo(() => getEditableUploadRuleRows(), []);
  const [draft, setDraft] = useState<UploadRuleOverrides>(initialUploadRuleOverrides);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const saveRules = (nextDraft: UploadRuleOverrides) => {
    setMessage("");
    startTransition(async () => {
      try {
        const response = await fetch("/admin/api/upload-rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uploadRuleOverrides: nextDraft }) });
        const data = (await response.json().catch(() => ({}))) as { error?: string; uploadRuleOverrides?: UploadRuleOverrides };
        if (!response.ok || !data.uploadRuleOverrides) throw new Error(data.error || "保存失败");
        setDraft(data.uploadRuleOverrides);
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
    if (saveNow) saveRules(nextDraft);
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-[24px] font-semibold tracking-[-0.03em]">上传规则</h1>
        <div className="text-[13px] text-[#777777]">对话流生成和资产库生成共用同一套规则</div>
      </div>

      <section className="mb-8 min-w-[1180px] overflow-hidden rounded-[10px] border border-[#eeeeee] bg-white text-[13px] shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between gap-4 border-b border-[#eeeeee] bg-[#fafafa] px-5 py-4">
          <div>
            <div className="text-[15px] font-medium text-[#222222]">模型上传数量配置</div>
            <div className="mt-1 text-[12px] leading-5 text-[#888888]">这里优先于下方兜底规则。关闭开关后可修改数量，打开后启用该数量。</div>
          </div>
          <div className={`text-[12px] ${message.includes("失败") ? "text-red-500" : "text-[#367cee]"}`}>{isPending ? "保存中..." : message}</div>
        </div>
        <div className="grid grid-cols-[210px_320px_150px_150px_150px_150px] border-b border-[#eeeeee] bg-[#fafafa] text-[12px] font-medium text-[#777777]">
          <div className="px-4 py-3">提供商 + 模型类型</div>
          <div className="px-4 py-3">模型名称</div>
          {editableUploadKinds.map((kind) => <div key={kind.key} className="px-4 py-3">{kind.label}</div>)}
        </div>
        {rows.map((row) => {
          const fallback = getUploadRule(row.context);
          return (
            <div key={row.key} className="grid grid-cols-[210px_320px_150px_150px_150px_150px] border-b border-[#f2f2f2] text-[12px] leading-5 text-[#444444] last:border-b-0">
              <div className="px-4 py-3 font-medium text-[#222222]">{row.providerType}</div>
              <div className="break-words px-4 py-3 text-[#333333]">{row.modelName}</div>
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
