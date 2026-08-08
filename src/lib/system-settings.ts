import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { UploadKind, UploadRuleOverrides } from "@/lib/upload-rules";
import { PERMANENT_ADMIN_EMAILS } from "@/lib/permanent-admins";

export const BYTEPLUS_CONVERSATION_IMAGE_MODEL_KEYS: Record<string, string> = {
  "byteplus:conversation-image.seedream-4-5": "conversation-image.seedream-4-5",
  "byteplus:conversation-image.seedream-5-0": "conversation-image.seedream-5-0",
  "byteplus:conversation-image.seedream-5-0-pro": "conversation-image.seedream-5-0-pro",
};

export const BYTEPLUS_ASSET_IMAGE_MODEL_KEYS: Record<string, string> = {
  "byteplus:conversation-image.seedream-4-5": "asset-image.seedream-4-5",
  "byteplus:conversation-image.seedream-5-0": "asset-image.seedream-5-0",
  "byteplus:conversation-image.seedream-5-0-pro": "asset-image.seedream-5-0-pro",
};

export const BYTEPLUS_CONVERSATION_VIDEO_MODEL_KEYS: Record<string, string> = {
  "byteplus:video.seedance-2-0-fast": "video.seedance-2-0-fast",
  "byteplus:video.seedance-2-0": "video.seedance-2-0",
  "byteplus:video.seedance-2-0-mini": "video.seedance-2-0-mini",
  "byteplus:video.seedance-2-5": "video.seedance-2-5",
};

export const BYTEPLUS_AGENT_IMAGE_MODEL_KEYS: Record<string, string> = {
  "byteplus:conversation-image.seedream-4-5": "agent-image.seedream-4-5",
};

export const BYTEPLUS_AGENT_VIDEO_MODEL_KEYS: Record<string, string> = {
  "byteplus:video.seedance-2-0-fast": "agent-video.seedance-2-0-fast",
  "byteplus:video.seedance-2-0": "agent-video.seedance-2-0",
  // ⭐ 2026-08-09 补：Agent 自动生视频也给 Seedance 2.5 一个后台开关。
  // ⛔ 故意**不**往 DEFAULT_MODEL_PROVIDER_PREFERENCES 里写 "agent-video.seedance-2-5"
  //    → 缺省值不是 "byteplus" ⇒ isBytePlusPreferenceEnabled 为 false ⇒ 后台开关默认「关」，
  //    Agent 高级档仍旧用 2.0（默认行为一字不变、不会偷偷把用户的钱花在更贵的 2.5 上）；
  //    管理员在后台打开后，`getAgentGenerationModel` 的高级档候选链才会优先取 2.5。
  "byteplus:video.seedance-2-5": "agent-video.seedance-2-5",
  // ⚠️ `agent-video.seedance-2-0-mini` 在偏好表和端点表里都有，但**故意不在这里**
  //    → 它是历史遗留的半份配置（死配置）。往这里加会让 Mini 立刻对 Agent 生效（偏好表里默认是 byteplus），
  //    属于行为变更，要加得先跟用户确认。
};

const ENV_PATH = join(process.cwd(), ".env.local");
const uploadKinds: UploadKind[] = ["document", "image", "video", "audio"];

export type CompressionQuality = "high" | "standard" | "low";

export type AdminSystemSettings = {
  openRouterApiKey: string;
  openRouterApiKeyEnabled: boolean;
  bytePlusApiKey: string;
  bytePlusApiKeyEnabled: boolean;
  bytePlusUnlockLimits: boolean;
  bytePlusRegion: "ap-southeast-1" | "eu-west-1";
  modelProviderPreferences: Record<string, "openrouter" | "byteplus">;
  bytePlusModelSelections: Record<string, string>;
  // 图片编辑类（高清/橡皮）模型候选链开关：key=`${func}:${modelId}`，值=是否启用。
  // 关掉首选自动用下一个启用的模型；全关时前端回落到完整候选链（不至于无法使用）。
  editModelToggles: Record<string, boolean>;
  imageCompressionEnabled: boolean;
  imageCompressionQuality: CompressionQuality;
  videoCompressionEnabled: boolean;
  videoCompressionQuality: CompressionQuality;
};

export function isCompressionQuality(value: unknown): value is CompressionQuality {
  return value === "high" || value === "standard" || value === "low";
}

// 三档对应"相对原图的精确质量百分比"。图片直接作为真实 JPEG 质量(1-100)；
// 视频作为转码目标质量(后续接线时映射到编码参数)。
export const COMPRESSION_QUALITY_PERCENT: Record<CompressionQuality, number> = {
  high: 95,
  standard: 80,
  low: 60,
};

export function getCompressionQualityPercent(quality: CompressionQuality) {
  return COMPRESSION_QUALITY_PERCENT[quality];
}

const DEFAULT_MODEL_PROVIDER_PREFERENCES: Record<string, "openrouter" | "byteplus"> = {
  "general.seed-2-0-lite": "byteplus",
  "general.seed-2-0-pro": "byteplus",
  "chat.seed-2-0-lite": "openrouter",
  "chat.advanced": "openrouter",
  "prompt.priority": "openrouter",
  "prompt.second": "openrouter",
  "prompt.seed-2-0-pro": "byteplus",
  "prompt.seed-2-0-lite": "byteplus",
  "conversation-image.seedream-4-5": "byteplus",
  "conversation-image.seedream-5-0": "byteplus",
  "conversation-image.seedream-5-0-pro": "byteplus",
  "asset-image.seedream-4-5": "openrouter",
  "asset-image.seedream-5-0": "openrouter",
  "asset-image.seedream-5-0-pro": "openrouter",
  "video.seedance-2-0-fast": "byteplus",
  "video.seedance-2-0": "byteplus",
  "video.seedance-2-0-mini": "byteplus",
  "video.seedance-2-5": "byteplus",
  "agent-image.seedream-4-5": "byteplus",
  "agent-image.seedream-5-0": "byteplus",
  "agent-image.seedream-5-0-pro": "byteplus",
  "agent-image.advanced": "openrouter",
  "agent-video.seedance-2-0-fast": "byteplus",
  "agent-video.seedance-2-0": "byteplus",
  "agent-video.seedance-2-0-mini": "byteplus",
  "agent-chat.seed-2-0-pro": "byteplus",
  "agent-chat.advanced": "openrouter",
  // 内容审核语义模型：两个都默认开启，按 GPT-5.6 Terra Pro → Seed 2.0 Pro 顺序兜底。
  "moderation.priority": "openrouter",
  "moderation.seed-2-0-pro": "byteplus",
};

const DEFAULT_BYTEPLUS_MODEL_SELECTIONS: Record<string, string> = {
  "general.seed-2-0-lite": "ep-20260518173102-9mtk6",
  "general.seed-2-0-pro": "ep-20260514173614-jbcb4",
  "chat.seed-2-0-lite": "ep-20260518173102-9mtk6",
  "chat.advanced": "ep-20260514173614-jbcb4",
  "prompt.priority": "ep-20260514173614-jbcb4",
  "prompt.second": "ep-20260514173614-jbcb4",
  "prompt.seed-2-0-pro": "ep-20260514173614-jbcb4",
  "prompt.seed-2-0-lite": "ep-20260518173102-9mtk6",
  "conversation-image.seedream-4-5": "ep-20260514174622-n9qfb",
  "conversation-image.seedream-5-0": "ep-20260514142211-p2wdk",
  "conversation-image.seedream-5-0-pro": "ep-20260713101732-q5zvf",
  "asset-image.seedream-4-5": "ep-20260514174622-n9qfb",
  "asset-image.seedream-5-0": "ep-20260514142211-p2wdk",
  "asset-image.seedream-5-0-pro": "ep-20260713101732-q5zvf",
  "video.seedance-2-0-fast": "ep-20260521134040-vf2jf",
  "video.seedance-2-0": "ep-20260521133841-nn8bg",
  "video.seedance-2-0-mini": "ep-20260713100634-mwp78",
  "video.seedance-2-5": "ep-20260807153703-h48pt",
  "agent-image.seedream-4-5": "ep-20260514174622-n9qfb",
  "agent-image.seedream-5-0": "ep-20260514142211-p2wdk",
  "agent-image.seedream-5-0-pro": "ep-20260713101732-q5zvf",
  "agent-video.seedance-2-0-fast": "ep-20260521134040-vf2jf",
  "agent-video.seedance-2-0": "ep-20260521133841-nn8bg",
  "agent-video.seedance-2-0-mini": "ep-20260713100634-mwp78",
  // ⭐ 2026-08-09 补：Agent 自动生视频的 Seedance 2.5 端点（与对话流那条同一个端点）。
  "agent-video.seedance-2-5": "ep-20260807153703-h48pt",
  "agent-chat.seed-2-0-pro": "ep-20260514173614-jbcb4",
  "moderation.seed-2-0-pro": "ep-20260514173614-jbcb4",
};

// 图片编辑类（橡皮）模型候选链：按顺序优先级，前一个失败/关闭自动用下一个。默认全部启用。
// 新增功能/模型只改这里 + 后台表格；前端候选链按此顺序 + 开关过滤。
// ⚠️ 高清已从这条链里拆出去（见下面 HD_FUNCTION_MODEL_CHAIN）：它改成了「用户自己选模型和K数」，
//    不再是失败自动换下一个的候选链，所以两者的开关必须分开，否则关一个会连带影响另一个。
export const EDIT_FUNCTION_MODEL_CHAIN: string[] = [
  "google/gemini-3.1-flash-image-preview",
  "google/gemini-3-pro-image-preview",
  "byteplus:conversation-image.seedream-4-5",
];
export const EDIT_FUNCTION_KEYS = ["eraser"] as const;

// 工作流「高清」可选模型（唯一权威）：快捷菜单里高清是个下拉，每个模型 × 2K/4K 共 4 个选项。
// 开关粒度 = **按模型**（key 仍是 `hd:<modelId>`）：关掉某个模型，它的 2K 和 4K 两个选项一起隐藏。
// 新增高清模型只改这里 + 后台表格 + 前端 HD_MODEL_OPTIONS 三处配置表。
export const HD_FUNCTION_MODEL_CHAIN: string[] = [
  "openai/gpt-5.4-image-2",
  "google/gemini-3.1-flash-image-preview",
];
export const HD_FUNCTION_KEYS = ["hd"] as const;

// 工作流「视频编辑功能」的模型候选链：依次 Mini → Fast → 2.0 → 2.5（前一个失败/关闭自动用下一个）。
// 与前端 workflow-tldraw-canvas-inner 的 WORKFLOW_VIDEO_EDIT_MODEL_CHAIN 保持一致，新增模型只改这两处配置表。
// ⭐ 2.5 放在**最后一位**（2026-08-09 加）：前三个都被后台关掉才会用到它 → 默认行为一字不变，
//    只是给后台多一个可选项（2.5 更贵，⛔ 别把它挪到首位，那等于悄悄涨价）。
export const VIDEO_EDIT_FUNCTION_MODEL_CHAIN: string[] = [
  "byteplus:video.seedance-2-0-mini",
  "byteplus:video.seedance-2-0-fast",
  "byteplus:video.seedance-2-0",
  "byteplus:video.seedance-2-5",
];
export const VIDEO_EDIT_FUNCTION_KEYS = ["video_quick"] as const;

const DEFAULT_EDIT_MODEL_TOGGLES: Record<string, boolean> = Object.fromEntries([
  ...EDIT_FUNCTION_KEYS.flatMap((func) => EDIT_FUNCTION_MODEL_CHAIN.map((modelId) => [`${func}:${modelId}`, true])),
  ...HD_FUNCTION_KEYS.flatMap((func) => HD_FUNCTION_MODEL_CHAIN.map((modelId) => [`${func}:${modelId}`, true])),
  ...VIDEO_EDIT_FUNCTION_KEYS.flatMap((func) => VIDEO_EDIT_FUNCTION_MODEL_CHAIN.map((modelId) => [`${func}:${modelId}`, true])),
]);

const BYTEPLUS_ENDPOINT_MODEL_NAMES: Record<string, string> = {
  "ep-20260521133841-nn8bg": "dreamina-seedance-2-0-260128",
  "ep-20260521134040-vf2jf": "dreamina-seedance-2-0-fast-260128",
  "ep-20260713100634-mwp78": "dreamina-seedance-2-0-mini-260615",
  "ep-20260807153703-h48pt": "dreamina-seedance-2-5-260628",
  "ep-20260514175234-9ssvl": "glm-4-7-251222",
  "ep-20260514175425-cd8jn": "seed-1-8-251228",
  "ep-20260518173102-9mtk6": "seed-2-0-lite-260428",
  "ep-20260514175015-ptwrh": "seed-2-0-mini-260215",
  "ep-20260514173614-jbcb4": "seed-2-0-pro-260328",
  "ep-20260518173019-br5vg": "seed-sc-260215",
  "ep-20260515121509-mvr84": "seedream-4-0-250828",
  "ep-20260514174622-n9qfb": "seedream-4-5-251128",
  "ep-20260514142211-p2wdk": "seedream-5-0-260128",
  "ep-20260713101732-q5zvf": "dola-seedream-5-0-pro-260628",
};

function parseEnvValue(value: string | undefined) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "string") return parsed;
    } catch {}
    return trimmed.slice(1, -1);
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1);
  return trimmed;
}

function getLocalEnvLines() {
  if (!existsSync(ENV_PATH)) return [];
  return readFileSync(ENV_PATH, "utf8").split(/\r?\n/);
}

export function getLocalEnvValue(name: string) {
  const line = getLocalEnvLines().find((item) => item.startsWith(`${name}=`));
  return parseEnvValue(line?.split("=").slice(1).join("="));
}

function getBooleanEnvValue(name: string, fallback: boolean) {
  const value = getLocalEnvValue(name) ?? process.env[name];
  if (value === undefined) return fallback;
  return !/^(false|0|off|no)$/i.test(value.trim());
}

function getJsonEnvValue<T>(name: string, fallback: T): T {
  const value = getLocalEnvValue(name) ?? process.env[name];
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as T;
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function getBytePlusRegion() {
  const value = getLocalEnvValue("BYTEPLUS_REGION") ?? process.env.BYTEPLUS_REGION;
  return value === "eu-west-1" ? "eu-west-1" : "ap-southeast-1";
}

function getCompressionQualityEnvValue(name: string, fallback: CompressionQuality): CompressionQuality {
  const value = getLocalEnvValue(name) ?? process.env[name];
  return isCompressionQuality(value) ? value : fallback;
}

export function getAdminSystemSettings(): AdminSystemSettings {
  return {
    openRouterApiKey: getLocalEnvValue("OPENROUTER_API_KEY") ?? process.env.OPENROUTER_API_KEY ?? "",
    openRouterApiKeyEnabled: getBooleanEnvValue("OPENROUTER_API_KEY_ENABLED", true),
    bytePlusApiKey: getLocalEnvValue("BYTEPLUS_API_KEY") ?? process.env.BYTEPLUS_API_KEY ?? getLocalEnvValue("ARK_API_KEY") ?? process.env.ARK_API_KEY ?? "",
    bytePlusApiKeyEnabled: getBooleanEnvValue("BYTEPLUS_API_KEY_ENABLED", true),
    bytePlusUnlockLimits: getBooleanEnvValue("BYTEPLUS_UNLOCK_LIMITS", false),
    bytePlusRegion: getBytePlusRegion(),
    modelProviderPreferences: { ...DEFAULT_MODEL_PROVIDER_PREFERENCES, ...getJsonEnvValue<Record<string, "openrouter" | "byteplus">>("MODEL_PROVIDER_PREFERENCES", {}) },
    bytePlusModelSelections: { ...DEFAULT_BYTEPLUS_MODEL_SELECTIONS, ...getJsonEnvValue<Record<string, string>>("BYTEPLUS_MODEL_SELECTIONS", {}) },
    editModelToggles: { ...DEFAULT_EDIT_MODEL_TOGGLES, ...getJsonEnvValue<Record<string, boolean>>("EDIT_MODEL_TOGGLES", {}) },
    imageCompressionEnabled: getBooleanEnvValue("IMAGE_COMPRESSION_ENABLED", true),
    imageCompressionQuality: getCompressionQualityEnvValue("IMAGE_COMPRESSION_QUALITY", "standard"),
    videoCompressionEnabled: getBooleanEnvValue("VIDEO_COMPRESSION_ENABLED", true),
    videoCompressionQuality: getCompressionQualityEnvValue("VIDEO_COMPRESSION_QUALITY", "standard"),
  };
}

export function getGenerationCompressionSettings() {
  const settings = getAdminSystemSettings();
  return {
    image: { enabled: settings.imageCompressionEnabled, quality: settings.imageCompressionQuality },
    video: { enabled: settings.videoCompressionEnabled, quality: settings.videoCompressionQuality },
  };
}

export function getConfiguredOpenRouterApiKey() {
  const settings = getAdminSystemSettings();
  return settings.openRouterApiKeyEnabled ? settings.openRouterApiKey.trim() : undefined;
}

export function getConfiguredBytePlusApiKey() {
  const settings = getAdminSystemSettings();
  return settings.bytePlusApiKeyEnabled ? settings.bytePlusApiKey.trim() : undefined;
}

export function getBytePlusBaseUrl(region = getAdminSystemSettings().bytePlusRegion) {
  return region === "eu-west-1" ? "https://ark.eu-west.bytepluses.com/api/v3" : "https://ark.ap-southeast.bytepluses.com/api/v3";
}

export function getModelProviderPreference(key: string) {
  const settings = getAdminSystemSettings();
  return settings.modelProviderPreferences[key] === "byteplus" ? "byteplus" : "openrouter";
}

export function getBytePlusModelSelection(key: string) {
  const settings = getAdminSystemSettings();
  return settings.bytePlusModelSelections[key] || DEFAULT_BYTEPLUS_MODEL_SELECTIONS[key];
}

/**
 * 决定发给 BytePlus 的 `model` 字段值。
 *
 * - 「解除限制」开 → 发我们的专属 Endpoint ID（`ep-2026...`），平台策略更宽；
 * - 关 → 发公开模型名（`seedream-4-5-251128`）。
 *   ⚠️ 它只改这一个字符串，**不跳过任何我们自己的校验/送审**。
 *
 * ⭐ 2026-07-30：从"全局一个开关"改成"按账号"。
 * `unlock` 由调用方（route / job 层，那里有 userId 且已是 async）先查好用户的
 * `unlockLimitsEnabled` 再传进来；传 `undefined` 时回落到全局 env（向后兼容，
 * 也兜住那些确实拿不到 userId 的调用点）。
 * ⛔ 故意保持**同步**：一旦在这里查 DB，会把 getBytePlusImageModelName /
 * getTextProviderConfig / getBytePlusVideoModelName 全部染成 async。
 */
export function getBytePlusModelForRequest(key: string, unlock?: boolean) {
  const endpointId = getBytePlusModelSelection(key);
  const unlockEnabled = unlock ?? getAdminSystemSettings().bytePlusUnlockLimits;
  if (unlockEnabled) return endpointId;
  return BYTEPLUS_ENDPOINT_MODEL_NAMES[endpointId] ?? endpointId;
}

export function isOpenRouterPreferenceEnabled(key: string) {
  return getModelProviderPreference(key) === "openrouter";
}

export function isBytePlusPreferenceEnabled(key: string) {
  const settings = getAdminSystemSettings();
  return settings.bytePlusApiKeyEnabled && settings.modelProviderPreferences[key] === "byteplus";
}

function isOpenRouterOnlyDisabled(groupTitle: string, badge: string, modelId: string) {
  const settings = getAdminSystemSettings();
  return settings.modelProviderPreferences[`openrouter-only:${groupTitle}:${badge}:${modelId}`] === "byteplus";
}

export function isConversationImageModelEnabled(modelId: string) {
  const bytePlusKey = BYTEPLUS_CONVERSATION_IMAGE_MODEL_KEYS[modelId];
  if (bytePlusKey) return isBytePlusPreferenceEnabled(bytePlusKey);
  // 图片生成模块已去掉 OpenRouter 版 Seedream 4.5（只保留 BytePlus 版，真人审核等功能只在 BytePlus）。
  if (modelId === "bytedance-seed/seedream-4.5") return false;
  return !isOpenRouterOnlyDisabled("对话流图片生成", "", modelId);
}

// 资产库图片与对话流/工作流图片共用同一套开关（2026-07-13 统一：一个开关控三处）。
export function isAssetImageModelEnabled(modelId: string) {
  return isConversationImageModelEnabled(modelId);
}

export function isConversationVideoModelEnabled(modelId: string) {
  const bytePlusKey = BYTEPLUS_CONVERSATION_VIDEO_MODEL_KEYS[modelId];
  if (bytePlusKey) return isBytePlusPreferenceEnabled(bytePlusKey);
  // 视频生成模块已去掉 OpenRouter 版 Seedance（只保留 BytePlus 版）。
  if (modelId === "bytedance/seedance-2.0-fast") return false;
  if (modelId === "bytedance/seedance-2.0") return false;
  return !isOpenRouterOnlyDisabled("对话流视频生成", "", modelId);
}

export function isAgentImageModelEnabled(modelId: string) {
  const bytePlusKey = BYTEPLUS_AGENT_IMAGE_MODEL_KEYS[modelId];
  if (bytePlusKey) return isBytePlusPreferenceEnabled(bytePlusKey);
  // Agent 自动生图只保留：普通=BytePlus Seedream 4.5、高级=OpenRouter GPT-5.4 Image 2（备选已去掉）。
  if (modelId === "openai/gpt-5.4-image-2") return getModelProviderPreference("agent-image.advanced") !== "byteplus";
  return false;
}

export function isAgentVideoModelEnabled(modelId: string) {
  const bytePlusKey = BYTEPLUS_AGENT_VIDEO_MODEL_KEYS[modelId];
  if (bytePlusKey) return isBytePlusPreferenceEnabled(bytePlusKey);
  // Agent 自动生视频只保留：普通=BytePlus Seedance 2.0 Fast、高级=BytePlus Seedance 2.0（备选已去掉）。
  return false;
}

export function isGeneralTextModelEnabled(modelId: string) {
  // 通用模式已去掉 OpenRouter 版 Seed 2.0 Lite（只保留 BytePlus 版）。
  if (modelId === "bytedance-seed/seed-2.0-lite") return isBytePlusPreferenceEnabled("general.seed-2-0-lite");
  if (modelId === "byteplus:chat.seed-2-0-pro") return isBytePlusPreferenceEnabled("general.seed-2-0-pro");
  return !isOpenRouterOnlyDisabled("通用模式 / Agent 规划 / 意图识别", "", modelId);
}

export function isTextModelEnabled(modelId: string, source: "chat" | "prompt" = "chat") {
  // 反推/优化提示词：additive，OpenRouter 只留 GPT-5.5/GPT-5.4，BytePlus 留 Seed 2.0 Pro/Lite；各自独立开关。
  if (source === "prompt") {
    if (modelId === "openai/gpt-5.5") return getModelProviderPreference("prompt.priority") !== "byteplus";
    if (modelId === "openai/gpt-5.4") return getModelProviderPreference("prompt.second") !== "byteplus";
    if (modelId === "byteplus:chat.seed-2-0-pro") return isBytePlusPreferenceEnabled("prompt.seed-2-0-pro");
    if (modelId === "bytedance-seed/seed-2.0-lite") return isBytePlusPreferenceEnabled("prompt.seed-2-0-lite");
    return true;
  }
  if (modelId === "bytedance-seed/seed-2.0-lite") return getModelProviderPreference("chat.seed-2-0-lite") === "openrouter" || isBytePlusPreferenceEnabled("chat.seed-2-0-lite");
  if (modelId === "openai/gpt-5.4") return getModelProviderPreference("chat.advanced") === "openrouter" || isBytePlusPreferenceEnabled("chat.advanced");
  if (modelId === "openai/gpt-5.5") return getModelProviderPreference("prompt.priority") === "openrouter" || isBytePlusPreferenceEnabled("prompt.priority");
  // Agent 规划对话模型：普通=BytePlus Seed 2.0 Pro、高级=OpenRouter GPT-5.6 Terra Pro。
  if (modelId === "byteplus:chat.seed-2-0-pro") return isBytePlusPreferenceEnabled("agent-chat.seed-2-0-pro");
  if (modelId === "openai/gpt-5.6-terra-pro") return getModelProviderPreference("agent-chat.advanced") !== "byteplus";
  return true;
}

function formatEnvValue(value: string) {
  if (!value) return "";
  if (/\s|#|"|'/.test(value)) return JSON.stringify(value);
  return value;
}

function sanitizeUploadRuleOverrides(value: unknown): UploadRuleOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: UploadRuleOverrides = {};
  for (const [modelKey, rawRule] of Object.entries(value as Record<string, unknown>)) {
    if (!modelKey || !rawRule || typeof rawRule !== "object" || Array.isArray(rawRule)) continue;
    const nextRule: Partial<Record<UploadKind, { enabled: boolean; maxCount: number }>> = {};
    for (const kind of uploadKinds) {
      const rawKindRule = (rawRule as Record<string, unknown>)[kind];
      if (!rawKindRule || typeof rawKindRule !== "object" || Array.isArray(rawKindRule)) continue;
      const rawMaxCount = Number((rawKindRule as Record<string, unknown>).maxCount);
      const maxCount = Number.isFinite(rawMaxCount) ? Math.max(0, Math.min(99, Math.floor(rawMaxCount))) : 0;
      nextRule[kind] = { enabled: Boolean((rawKindRule as Record<string, unknown>).enabled), maxCount };
    }
    if (Object.keys(nextRule).length > 0) result[modelKey] = nextRule;
  }
  return result;
}

export function getUploadRuleOverrides() {
  return sanitizeUploadRuleOverrides(getJsonEnvValue<UploadRuleOverrides>("UPLOAD_RULE_OVERRIDES", {}));
}

export async function updateUploadRuleOverrides(overrides: UploadRuleOverrides) {
  const sanitized = sanitizeUploadRuleOverrides(overrides);
  const nextValue = formatEnvValue(JSON.stringify(sanitized));
  let seen = false;
  const nextLines = getLocalEnvLines().map((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (match?.[1] !== "UPLOAD_RULE_OVERRIDES") return line;
    seen = true;
    return `UPLOAD_RULE_OVERRIDES=${nextValue}`;
  });
  if (!seen) nextLines.push(`UPLOAD_RULE_OVERRIDES=${nextValue}`);

  await mkdir(dirname(ENV_PATH), { recursive: true });
  await writeFile(ENV_PATH, `${nextLines.join("\n").replace(/\n+$/, "")}\n`, "utf8");
  process.env.UPLOAD_RULE_OVERRIDES = JSON.stringify(sanitized);
  return sanitized;
}

/**
 * 把一批 key=value 合并写回 `.env.local`（已存在的原地替换、不存在的追加）。
 * ⭐ 唯一实现：`updateAdminSystemSettings` 与「后台白名单」共用，禁止再复制第二份合并逻辑。
 */
async function writeLocalEnvValues(nextValues: Map<string, string>) {
  const seen = new Set<string>();
  const nextLines = getLocalEnvLines().map((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    const key = match?.[1];
    if (!key || !nextValues.has(key)) return line;
    seen.add(key);
    return `${key}=${nextValues.get(key) ?? ""}`;
  });

  for (const [key, value] of nextValues) {
    if (!seen.has(key)) nextLines.push(`${key}=${value}`);
  }

  await mkdir(dirname(ENV_PATH), { recursive: true });
  await writeFile(ENV_PATH, `${nextLines.join("\n").replace(/\n+$/, "")}\n`, "utf8");
}

/**
 * 「后台白名单」= 允许进入 `/admin` 的邮箱清单（`ADMIN_EMAILS`）。
 * 后台「帐号功能管理」页按账号开关它，落到 `.env.local`（服务器上那份是挂载的持久文件）。
 * 写完同步 `process.env`，当前进程立即生效、不用重启。
 *
 * ⭐⭐ **落盘时强制补回 `PERMANENT_ADMIN_EMAILS`**（`lib/admin.ts` 的唯一来源）——
 * 这是"后台永远有人能进"的最后一道保险：不管调用方传进来的清单少了谁，永久账号都写得回去。
 */
export async function updateAdminEmailWhitelist(emails: string[]) {
  const normalized = [...new Set([...PERMANENT_ADMIN_EMAILS, ...emails].map((item) => item.trim().toLowerCase()).filter(Boolean))];
  const value = normalized.join(",");
  await writeLocalEnvValues(new Map([["ADMIN_EMAILS", formatEnvValue(value)]]));
  process.env.ADMIN_EMAILS = value;
  return normalized;
}

export async function updateAdminSystemSettings(settings: AdminSystemSettings) {
  const nextValues = new Map<string, string>([
    ["OPENROUTER_API_KEY", formatEnvValue(settings.openRouterApiKey.trim())],
    ["OPENROUTER_API_KEY_ENABLED", settings.openRouterApiKeyEnabled ? "true" : "false"],
    ["BYTEPLUS_API_KEY", formatEnvValue(settings.bytePlusApiKey.trim())],
    ["BYTEPLUS_API_KEY_ENABLED", settings.bytePlusApiKeyEnabled ? "true" : "false"],
    ["BYTEPLUS_UNLOCK_LIMITS", settings.bytePlusUnlockLimits ? "true" : "false"],
    ["BYTEPLUS_REGION", settings.bytePlusRegion],
    ["MODEL_PROVIDER_PREFERENCES", formatEnvValue(JSON.stringify(settings.modelProviderPreferences))],
    ["BYTEPLUS_MODEL_SELECTIONS", formatEnvValue(JSON.stringify(settings.bytePlusModelSelections))],
    ["EDIT_MODEL_TOGGLES", formatEnvValue(JSON.stringify(settings.editModelToggles))],
    ["IMAGE_COMPRESSION_ENABLED", settings.imageCompressionEnabled ? "true" : "false"],
    ["IMAGE_COMPRESSION_QUALITY", settings.imageCompressionQuality],
    ["VIDEO_COMPRESSION_ENABLED", settings.videoCompressionEnabled ? "true" : "false"],
    ["VIDEO_COMPRESSION_QUALITY", settings.videoCompressionQuality],
  ]);
  await writeLocalEnvValues(nextValues);

  process.env.OPENROUTER_API_KEY = settings.openRouterApiKey.trim();
  process.env.OPENROUTER_API_KEY_ENABLED = settings.openRouterApiKeyEnabled ? "true" : "false";
  process.env.BYTEPLUS_API_KEY = settings.bytePlusApiKey.trim();
  process.env.ARK_API_KEY = settings.bytePlusApiKey.trim();
  process.env.BYTEPLUS_API_KEY_ENABLED = settings.bytePlusApiKeyEnabled ? "true" : "false";
  process.env.BYTEPLUS_UNLOCK_LIMITS = settings.bytePlusUnlockLimits ? "true" : "false";
  process.env.BYTEPLUS_REGION = settings.bytePlusRegion;
  process.env.MODEL_PROVIDER_PREFERENCES = JSON.stringify(settings.modelProviderPreferences);
  process.env.BYTEPLUS_MODEL_SELECTIONS = JSON.stringify(settings.bytePlusModelSelections);
  process.env.EDIT_MODEL_TOGGLES = JSON.stringify(settings.editModelToggles);
  process.env.IMAGE_COMPRESSION_ENABLED = settings.imageCompressionEnabled ? "true" : "false";
  process.env.IMAGE_COMPRESSION_QUALITY = settings.imageCompressionQuality;
  process.env.VIDEO_COMPRESSION_ENABLED = settings.videoCompressionEnabled ? "true" : "false";
  process.env.VIDEO_COMPRESSION_QUALITY = settings.videoCompressionQuality;

  return getAdminSystemSettings();
}
