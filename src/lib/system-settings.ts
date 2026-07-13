import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { UploadKind, UploadRuleOverrides } from "@/lib/upload-rules";

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
};

export const BYTEPLUS_AGENT_IMAGE_MODEL_KEYS: Record<string, string> = {
  "byteplus:conversation-image.seedream-4-5": "agent-image.seedream-4-5",
};

export const BYTEPLUS_AGENT_VIDEO_MODEL_KEYS: Record<string, string> = {
  "byteplus:video.seedance-2-0-fast": "agent-video.seedance-2-0-fast",
  "byteplus:video.seedance-2-0": "agent-video.seedance-2-0",
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
  "agent-image.seedream-4-5": "byteplus",
  "agent-image.advanced": "openrouter",
  "agent-video.seedance-2-0-fast": "byteplus",
  "agent-video.seedance-2-0": "byteplus",
  "agent-chat.seed-2-0-pro": "byteplus",
  "agent-chat.advanced": "openrouter",
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
  "agent-image.seedream-4-5": "ep-20260514174622-n9qfb",
  "agent-video.seedance-2-0-fast": "ep-20260521134040-vf2jf",
  "agent-video.seedance-2-0": "ep-20260521133841-nn8bg",
  "agent-chat.seed-2-0-pro": "ep-20260514173614-jbcb4",
};

const BYTEPLUS_ENDPOINT_MODEL_NAMES: Record<string, string> = {
  "ep-20260521133841-nn8bg": "dreamina-seedance-2-0-260128",
  "ep-20260521134040-vf2jf": "dreamina-seedance-2-0-fast-260128",
  "ep-20260713100634-mwp78": "dreamina-seedance-2-0-mini-260615",
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

export function getBytePlusModelForRequest(key: string) {
  const endpointId = getBytePlusModelSelection(key);
  if (getAdminSystemSettings().bytePlusUnlockLimits) return endpointId;
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
    ["IMAGE_COMPRESSION_ENABLED", settings.imageCompressionEnabled ? "true" : "false"],
    ["IMAGE_COMPRESSION_QUALITY", settings.imageCompressionQuality],
    ["VIDEO_COMPRESSION_ENABLED", settings.videoCompressionEnabled ? "true" : "false"],
    ["VIDEO_COMPRESSION_QUALITY", settings.videoCompressionQuality],
  ]);
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

  process.env.OPENROUTER_API_KEY = settings.openRouterApiKey.trim();
  process.env.OPENROUTER_API_KEY_ENABLED = settings.openRouterApiKeyEnabled ? "true" : "false";
  process.env.BYTEPLUS_API_KEY = settings.bytePlusApiKey.trim();
  process.env.ARK_API_KEY = settings.bytePlusApiKey.trim();
  process.env.BYTEPLUS_API_KEY_ENABLED = settings.bytePlusApiKeyEnabled ? "true" : "false";
  process.env.BYTEPLUS_UNLOCK_LIMITS = settings.bytePlusUnlockLimits ? "true" : "false";
  process.env.BYTEPLUS_REGION = settings.bytePlusRegion;
  process.env.MODEL_PROVIDER_PREFERENCES = JSON.stringify(settings.modelProviderPreferences);
  process.env.BYTEPLUS_MODEL_SELECTIONS = JSON.stringify(settings.bytePlusModelSelections);
  process.env.IMAGE_COMPRESSION_ENABLED = settings.imageCompressionEnabled ? "true" : "false";
  process.env.IMAGE_COMPRESSION_QUALITY = settings.imageCompressionQuality;
  process.env.VIDEO_COMPRESSION_ENABLED = settings.videoCompressionEnabled ? "true" : "false";
  process.env.VIDEO_COMPRESSION_QUALITY = settings.videoCompressionQuality;

  return getAdminSystemSettings();
}
