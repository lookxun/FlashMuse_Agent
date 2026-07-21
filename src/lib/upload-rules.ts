import { IMAGE_UPLOAD_ACCEPT } from "@/lib/image-upload-validation";

export type UploadRuleMode = "agent" | "general" | "image" | "video" | "asset-image";
export type UploadTransportMode = "local-base64" | "server-url";

export type UploadKind = "image" | "document" | "video" | "audio";

export type UploadKindRule = {
  enabled: boolean;
  maxCount: number;
  maxSizeMb: number;
  formats: string[];
  minSeconds?: number;
  maxSeconds?: number;
  maxTotalSeconds?: number;
  requiresServerUrl?: boolean;
};

export type UploadRule = {
  image: UploadKindRule;
  document: UploadKindRule;
  video: UploadKindRule;
  audio: UploadKindRule;
};

export type UploadRuleContext = {
  mode: UploadRuleMode;
  modelId?: string;
  transportMode?: UploadTransportMode;
  videoReferenceMode?: "reference" | "first_frame" | "first_last_frame";
};

export type UploadRuleCountOverride = {
  enabled: boolean;
  maxCount: number;
};

export type UploadRuleOverrides = Record<string, Partial<Record<UploadKind, UploadRuleCountOverride>>>;

export const BYTEPLUS_SEEDANCE_UPLOAD_RULE_KEYS = {
  reference: "byteplus:video.seedance:reference",
  firstFrame: "byteplus:video.seedance:first_frame",
  firstLastFrame: "byteplus:video.seedance:first_last_frame",
} as const;

const commonImageFormats = ["jpg", "jpeg", "png", "webp"];
const bytePlusImageFormats = ["jpg", "jpeg", "png", "webp", "bmp", "tiff", "tif", "gif", "heic", "heif"];
const documentFormats = ["pdf", "txt", "csv", "docx", "doc", "xlsx", "xls", "pptx", "ppt", "md"];

const disabledRule: UploadKindRule = { enabled: false, maxCount: 0, maxSizeMb: 0, formats: [] };

function kindRule(rule: Partial<UploadKindRule> & Pick<UploadKindRule, "enabled" | "maxCount" | "maxSizeMb" | "formats">): UploadKindRule {
  return rule;
}

function makeRule(partial: Partial<UploadRule>): UploadRule {
  return {
    image: disabledRule,
    document: disabledRule,
    video: disabledRule,
    audio: disabledRule,
    ...partial,
  };
}

function isBytePlusImageModel(modelId?: string) {
  return modelId === "byteplus:conversation-image.seedream-4-5" || modelId === "byteplus:conversation-image.seedream-5-0" || modelId === "byteplus:conversation-image.seedream-5-0-pro";
}

function isBytePlusVideoModel(modelId?: string) {
  return modelId === "byteplus:video.seedance-2-0-fast" || modelId === "byteplus:video.seedance-2-0" || modelId === "byteplus:video.seedance-2-0-mini";
}

function isKlingVideoModel(modelId?: string) {
  return modelId === "kwaivgi/kling-v3.0-std" || modelId === "kwaivgi/kling-v3.0-pro" || modelId === "kwaivgi/kling-video-o1";
}

function isVeoVideoModel(modelId?: string) {
  return modelId === "google/veo-3.1";
}

export function getUploadRuleOverrideKey(context: UploadRuleContext) {
  if (context.mode === "agent" || context.mode === "general") return "chat";
  if (context.mode === "video" && isBytePlusVideoModel(context.modelId)) {
    if (context.videoReferenceMode === "first_last_frame") return BYTEPLUS_SEEDANCE_UPLOAD_RULE_KEYS.firstLastFrame;
    if (context.videoReferenceMode === "first_frame") return BYTEPLUS_SEEDANCE_UPLOAD_RULE_KEYS.firstFrame;
    return BYTEPLUS_SEEDANCE_UPLOAD_RULE_KEYS.reference;
  }
  return context.modelId || context.mode;
}

function applyUploadRuleOverrides(rule: UploadRule, context: UploadRuleContext, overrides?: UploadRuleOverrides): UploadRule {
  const override = overrides?.[getUploadRuleOverrideKey(context)];
  if (!override) return rule;

  const next: UploadRule = { ...rule };
  for (const kind of ["image", "document", "video", "audio"] as const) {
    const kindOverride = override[kind];
    if (!kindOverride || !rule[kind].enabled) continue;
    const maxCount = Math.max(0, Math.min(99, Math.floor(kindOverride.maxCount)));
    next[kind] = { ...rule[kind], enabled: kindOverride.enabled && maxCount > 0, maxCount: kindOverride.enabled ? maxCount : 0 };
  }
  return next;
}

function getBaseUploadRule(context: UploadRuleContext): UploadRule {
  const transportMode = context.transportMode ?? "local-base64";
  const bytePlusLocalImageMax = transportMode === "server-url" ? 14 : 6;

  if (context.mode === "agent" || context.mode === "general") {
    return makeRule({
      image: kindRule({ enabled: true, maxCount: 5, maxSizeMb: 5, formats: commonImageFormats }),
      document: kindRule({ enabled: true, maxCount: 5, maxSizeMb: 10, formats: documentFormats }),
    });
  }

  if (context.mode === "asset-image" || context.mode === "image") {
    if (isBytePlusImageModel(context.modelId)) {
      return makeRule({
        image: kindRule({ enabled: true, maxCount: bytePlusLocalImageMax, maxSizeMb: 30, formats: bytePlusImageFormats }),
      });
    }

    // gpt-5.4-image-2 走新图片接口(/api/v1/images)，参考图最多 16 张、单张 10MB（后台仍可 override）。
    if (context.modelId === "openai/gpt-5.4-image-2") {
      return makeRule({
        image: kindRule({ enabled: true, maxCount: 16, maxSizeMb: 10, formats: commonImageFormats }),
      });
    }

    return makeRule({
      image: kindRule({ enabled: true, maxCount: 3, maxSizeMb: 8, formats: commonImageFormats }),
    });
  }

  if (context.mode === "video") {
    if (isBytePlusVideoModel(context.modelId)) {
      const imageMaxCount = context.videoReferenceMode === "first_last_frame" ? 2 : context.videoReferenceMode === "first_frame" ? 1 : 9;
      const referenceMediaRule = context.videoReferenceMode === "first_frame" || context.videoReferenceMode === "first_last_frame" ? {} : {
        video: kindRule({ enabled: true, maxCount: 3, maxSizeMb: 200, formats: ["mp4", "mov"], minSeconds: 2, maxSeconds: 15, maxTotalSeconds: 15, requiresServerUrl: true }),
        audio: kindRule({ enabled: true, maxCount: 3, maxSizeMb: 15, formats: ["mp3", "wav"], minSeconds: 2, maxSeconds: 15, maxTotalSeconds: 15, requiresServerUrl: true }),
      };
      return makeRule({
        image: kindRule({ enabled: true, maxCount: imageMaxCount, maxSizeMb: 30, formats: bytePlusImageFormats }),
        ...referenceMediaRule,
      });
    }

    return makeRule({
      image: kindRule({ enabled: true, maxCount: isKlingVideoModel(context.modelId) || isVeoVideoModel(context.modelId) ? 2 : 3, maxSizeMb: 8, formats: commonImageFormats }),
    });
  }

  return makeRule({ image: kindRule({ enabled: true, maxCount: 3, maxSizeMb: 8, formats: commonImageFormats }) });
}

export function getUploadRule(context: UploadRuleContext, overrides?: UploadRuleOverrides): UploadRule {
  return applyUploadRuleOverrides(getBaseUploadRule(context), context, overrides);
}

export function getAllowedImageCount(context: UploadRuleContext, overrides?: UploadRuleOverrides) {
  return getUploadRule(context, overrides).image.maxCount;
}

export function getAllowedDocumentCount(context: UploadRuleContext, overrides?: UploadRuleOverrides) {
  return getUploadRule(context, overrides).document.maxCount;
}

export function getUploadAcceptValue(rule: UploadRule) {
  const values: string[] = [];
  if (rule.image.enabled) values.push(IMAGE_UPLOAD_ACCEPT);
  if (rule.document.enabled) values.push(...rule.document.formats.map((format) => `.${format}`));
  if (rule.video.enabled) values.push(...rule.video.formats.map((format) => `.${format}`));
  if (rule.audio.enabled) values.push(...rule.audio.formats.map((format) => `.${format}`));
  return values.join(",") || ".png,.jpg,.jpeg,.webp";
}

export function getSupportedUploadTypeLabel(rule: UploadRule) {
  const labels: string[] = [];
  if (rule.image.enabled) labels.push(`图片（最多${rule.image.maxCount}张）`);
  if (rule.document.enabled) labels.push(`文件（最多${rule.document.maxCount}个）`);
  if (rule.video.enabled) labels.push(`视频（最多${rule.video.maxCount}个）`);
  if (rule.audio.enabled) labels.push(`音频（最多${rule.audio.maxCount}个）`);
  return labels.join("、") || "当前模型不支持上传文件";
}

export function getFileExtension(name: string) {
  const cleanName = name.split("?")[0]?.split("#")[0]?.split(/[\\/]/).pop() ?? "";
  const dotIndex = cleanName.lastIndexOf(".");
  return dotIndex >= 0 && dotIndex < cleanName.length - 1 ? cleanName.slice(dotIndex + 1).toLowerCase() : "";
}

export function getUploadKindFromFileName(name: string): UploadKind | "unsupported" {
  const extension = getFileExtension(name);
  if (["jpg", "jpeg", "png", "webp", "bmp", "tiff", "tif", "gif", "heic", "heif"].includes(extension)) return "image";
  if (documentFormats.includes(extension)) return "document";
  if (["mp4", "mov"].includes(extension)) return "video";
  if (["mp3", "wav"].includes(extension)) return "audio";
  return "unsupported";
}

export function validateReferenceImageCount(context: UploadRuleContext, count: number, overrides?: UploadRuleOverrides) {
  const maxCount = getAllowedImageCount(context, overrides);
  if (count > maxCount) return `当前模型最多支持 ${maxCount} 张参考图，不能上传更多图片`;
  return undefined;
}

// 视频参考素材组合校验的统一文案（对话流客户端 / 工作流客户端 / 服务端共用同一份，禁止各写各的）。
export const VIDEO_REFERENCE_MESSAGES = {
  modelNoVideoAudio: "当前模型不支持上传视频或音频",
  onlyFusionSupportsVideoAudio: "只有融合模式才支持上传视频和音频",
  audioNeedsImageOrVideo: "音频不能单独上传，必须带图片或视频",
} as const;

// 视频参考素材"组合规则"的唯一权威校验：
// - 非 BytePlus Seedance 视频模型：不支持视频/音频。
// - Seedance 首帧/首尾帧模式：只支持参考图，带视频或音频一律拦。
// - Seedance 融合模式：音频不能单独上传，必须同时带图片或视频。
// 返回错误文案（应拦截）或 undefined（放行）。客户端与服务端都调用它，保证判定与文案完全一致。
export function validateVideoReferenceCombination(input: {
  modelId?: string;
  referenceMode?: "reference" | "first_frame" | "first_last_frame" | string | null;
  imageCount: number;
  videoCount: number;
  audioCount: number;
}): string | undefined {
  const hasVideoOrAudio = input.videoCount > 0 || input.audioCount > 0;
  if (!isBytePlusVideoModel(input.modelId)) {
    return hasVideoOrAudio ? VIDEO_REFERENCE_MESSAGES.modelNoVideoAudio : undefined;
  }
  const isFusionMode = input.referenceMode !== "first_frame" && input.referenceMode !== "first_last_frame";
  if (!isFusionMode) {
    return hasVideoOrAudio ? VIDEO_REFERENCE_MESSAGES.onlyFusionSupportsVideoAudio : undefined;
  }
  if (input.audioCount > 0 && input.imageCount === 0 && input.videoCount === 0) {
    return VIDEO_REFERENCE_MESSAGES.audioNeedsImageOrVideo;
  }
  return undefined;
}

// 参考视频/音频"总时长"的唯一权威校验（对话流客户端 / 工作流客户端 / 服务端共用同一份）。
// 平台（BytePlus r2v）规定所有参考视频/音频总时长约 15 秒；这里按精确到 0.1 秒求和，
// 四舍五入后 > 15.0 秒即拦，文案带上实际总秒数（保留 1 位小数），因为用户在界面上看不到小数。
export const REFERENCE_TOTAL_SECONDS_LIMIT = 15;

export function formatSecondsOneDecimal(seconds: number): string {
  return (Math.round((Number.isFinite(seconds) ? seconds : 0) * 10) / 10).toFixed(1);
}

export function sumReferenceDurations(durations: Array<number | null | undefined>): number {
  const total = durations.reduce<number>((sum, value) => sum + (typeof value === "number" && Number.isFinite(value) ? value : 0), 0);
  return Math.round(total * 10) / 10;
}

export function validateReferenceTotalDuration(kind: "video" | "audio", durations: Array<number | null | undefined>): string | undefined {
  const total = sumReferenceDurations(durations);
  if (total > REFERENCE_TOTAL_SECONDS_LIMIT) {
    const label = kind === "video" ? "视频" : "音频";
    return `当前${label}加起来是 ${formatSecondsOneDecimal(total)} 秒，超过${label}参考总时长上限 ${REFERENCE_TOTAL_SECONDS_LIMIT} 秒，请减少数量或更换更短的${label}`;
  }
  return undefined;
}

// 上传/附加视频·音频被拒时的统一文案：
// - Seedance 首帧/首尾帧模式（非融合）→「只有融合模式才支持上传视频和音频」。
// - 其它（非视频模型/非 Seedance 等本就不支持）→「当前模型不支持上传视频或音频」。
export function getVideoAudioUploadDisabledMessage(input: {
  modelId?: string;
  videoReferenceMode?: "reference" | "first_frame" | "first_last_frame" | string | null;
}): string {
  if (isBytePlusVideoModel(input.modelId) && (input.videoReferenceMode === "first_frame" || input.videoReferenceMode === "first_last_frame")) {
    return VIDEO_REFERENCE_MESSAGES.onlyFusionSupportsVideoAudio;
  }
  return VIDEO_REFERENCE_MESSAGES.modelNoVideoAudio;
}
