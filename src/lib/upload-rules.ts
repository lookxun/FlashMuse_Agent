import { IMAGE_UPLOAD_ACCEPT, IMAGE_UPLOAD_FORMATS } from "@/lib/image-upload-validation";
import { DOCUMENT_UPLOAD_FORMATS, MEDIA_DURATION_EPSILON_SECONDS } from "@/lib/media-upload-validation";
import { HAILUO3_VIDEO_MODEL_ID, SEEDANCE_25_VIDEO_MODEL_ID } from "@/lib/models";

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

/**
 * 视频「参考模式」的唯一权威类型（对话流 / 工作流 / 服务端共用）。
 * ⛔ 禁止各处再手写这个联合类型 —— 工作流原来那份漏了 `last_frame`，
 *    直接导致 Hailuo 3 的尾帧模式在工作流里表达不出来。
 */
// edit/extend 仅 Seedance 2.5 支持：靠 reference_video + 提示词触发词，强制 ratio=adaptive、duration=-1（见 openrouter-video）。
export type VideoReferenceMode = "reference" | "first_frame" | "last_frame" | "first_last_frame" | "edit" | "extend";

export type UploadRuleContext = {
  mode: UploadRuleMode;
  modelId?: string;
  transportMode?: UploadTransportMode;
  videoReferenceMode?: VideoReferenceMode;
};

export type UploadRuleCountOverride = {
  enabled: boolean;
  maxCount: number;
};

export type UploadRuleOverrides = Record<string, Partial<Record<UploadKind, UploadRuleCountOverride>>>;

// ⭐ 后台「上传规则」面板可配置的 Seedance 参考模式 key。
// ⛔⛔ 2.0 系与 2.5 **必须各用一套 key**（2026-08-09 修）：原来只有下面这一组不带版本号的 key，
//    2.0/Fast/Mini 与 2.5 共用同一条 override → 管理员在后台碰一下开关，
//    就会把 2.5 的「30 图 / 10 视频 / 10 音频」按 2.0 的 fallback 静默砍成 9/3/3，
//    而后台上完全看不出来。⭐ 老 key 保留原样（不带版本号）= 已写进 env 的 2.0 配置不用迁移。
export const BYTEPLUS_SEEDANCE_UPLOAD_RULE_KEYS = {
  reference: "byteplus:video.seedance:reference",
  firstFrame: "byteplus:video.seedance:first_frame",
  firstLastFrame: "byteplus:video.seedance:first_last_frame",
} as const;

/** Seedance 2.5 专属的上传规则 override key（与 2.0 系完全独立）。 */
export const BYTEPLUS_SEEDANCE_25_UPLOAD_RULE_KEYS = {
  reference: "byteplus:video.seedance-2-5:reference",
  firstFrame: "byteplus:video.seedance-2-5:first_frame",
  firstLastFrame: "byteplus:video.seedance-2-5:first_last_frame",
} as const;

/** 按模型取该代 Seedance 的三个参考模式 key —— 唯一权威，后台面板与 getUploadRuleOverrideKey 共用。 */
export function getSeedanceUploadRuleKeys(modelId?: string) {
  return isSeedance25VideoModel(modelId) ? BYTEPLUS_SEEDANCE_25_UPLOAD_RULE_KEYS : BYTEPLUS_SEEDANCE_UPLOAD_RULE_KEYS;
}

// ⭐ 图片格式白名单只有一个来源：image-upload-validation.ts 的 IMAGE_UPLOAD_FORMATS
// （为什么不用 BytePlus 官网那份更宽的列表、以后想放开 heic 要先做什么，见那个文件顶部注释）。
// ⛔ 禁止在这里另写一份图片格式数组 —— 历史上就是因为这里多了一份 bytePlusImageFormats
//    （含 bmp/tiff/gif/heic/heif），导致"对话流传不上去、工作流拖进来能过"的分叉。
const commonImageFormats = [...IMAGE_UPLOAD_FORMATS];
// ⭐ 同理，文档格式白名单只有一个来源：media-upload-validation.ts 的 DOCUMENT_UPLOAD_FORMATS
//    （服务端 `/api/upload-file` 的硬校验用的就是那一份，前后端必须完全一致，
//     否则会出现"前端让你选、传上去被拒"或更糟的"前端拦住了但接口能直传"）。
// ⛔ 禁止在这里另写一份文档格式数组。
const documentFormats: string[] = [...DOCUMENT_UPLOAD_FORMATS];


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

export function isBytePlusVideoModel(modelId?: string) {
  return modelId === "byteplus:video.seedance-2-0-fast" || modelId === "byteplus:video.seedance-2-0" || modelId === "byteplus:video.seedance-2-0-mini" || modelId === "byteplus:video.seedance-2-5";
}

/** BytePlus Seedance **2.0 系**（2.0 / Fast / Mini）—— 同一代、能力一致，后台按一行配置。⛔ 不含 2.5。 */
export function isSeedance20FamilyVideoModel(modelId?: string) {
  return isBytePlusVideoModel(modelId) && !isSeedance25VideoModel(modelId);
}

/** 后台面板里代表 2.0 系那一行的模型 id（唯一权威，⛔ 别在别处写这个字符串）。 */
export const SEEDANCE_20_FAMILY_MODEL_ID = "byteplus:video.seedance-2-0";

// Seedance 2.5 参考能力更强（官方文档 + 实测）：融合模式 30 图 / 10 视频 / 10 音频、单条与总时长各 30 秒、音频可单独。
// 其余 BytePlus（2.0 系）仍是 9 图 / 3 视频 / 3 音频、15 秒。唯一权威，禁止各处再写死这些数。
export function isSeedance25VideoModel(modelId?: string) {
  return modelId === SEEDANCE_25_VIDEO_MODEL_ID;
}
export function getSeedanceReferenceLimits(modelId?: string) {
  const is25 = isSeedance25VideoModel(modelId);
  return { image: is25 ? 30 : 9, mediaCount: is25 ? 10 : 3, clipSeconds: is25 ? 30 : 15, totalSeconds: is25 ? 30 : 15 };
}

function isKlingVideoModel(modelId?: string) {
  return modelId === "kwaivgi/kling-v3.0-std" || modelId === "kwaivgi/kling-v3.0-pro" || modelId === "kwaivgi/kling-video-o1";
}

function isVeoVideoModel(modelId?: string) {
  return modelId === "google/veo-3.1";
}

export function isHailuo3VideoModel(modelId?: string) {
  return modelId === HAILUO3_VIDEO_MODEL_ID;
}

/**
 * 该视频模型是否有「参考模式」（融合 / 首帧 / 首尾帧）三选。唯一权威判定，禁止各处自己列 id。
 * - BytePlus Seedance 2.0 三兄弟：融合模式还支持参考视频/音频。
 * - Hailuo 3（OpenRouter）：只支持图片类输入（首帧/尾帧由 `frame_images` 表达），
 *   参考视频/音频**OpenRouter 会静默丢弃**，所以仍由 validateVideoReferenceCombination 拦住。
 */
export function supportsVideoReferenceMode(modelId?: string) {
  return isBytePlusVideoModel(modelId) || isHailuo3VideoModel(modelId);
}

/**
 * 「参考模式」下允许的参考图张数 —— 唯一权威。
 * 首帧 1 张、首尾帧 2 张（两家一致，都是上游硬规则）；
 * 融合/普通参考：BytePlus Seedance 与 Hailuo 3 都是 9 张
 * （Hailuo 3 的 9 张上限 2026-08-03 直打 OpenRouter 实测确认：第 10 张提交即被 400 拒）。
 */
export function getVideoReferenceImageMaxCount(modelId?: string, mode?: UploadRuleContext["videoReferenceMode"]) {
  // ⭐⭐ 视频编辑 / 视频延长（仅 Seedance 2.5）：入参只有**1 个参考视频**，
  // 参考图和参考音频上游压根不用 → 张数 0，配合 getBaseUploadRule 里把 image/audio 整个关掉。
  if (mode === "edit" || mode === "extend") return 0;
  if (mode === "first_last_frame") return 2;
  if (mode === "first_frame" || mode === "last_frame") return 1;
  return getSeedanceReferenceLimits(modelId).image;
}

/** 视频编辑 / 视频延长这两个模式只接受 1 个参考视频（⛔ 别改成多个，上游只吃一个）。 */
export function isSingleVideoInputReferenceMode(mode?: UploadRuleContext["videoReferenceMode"]) {
  return mode === "edit" || mode === "extend";
}

/**
 * 按「参考模式」裁掉多出来的参考图 —— 客户端（对话流）与服务端（/api/video）共用这一份，禁止各写一套。
 * 没有参考模式的模型（Kling / Veo 等）原样返回，张数由 getUploadRule 的 maxCount 校验。
 */
export function getEffectiveVideoReferenceItems<T>(items: T[] | undefined, modelId?: string, mode?: UploadRuleContext["videoReferenceMode"]): T[] {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!supportsVideoReferenceMode(modelId)) return safeItems;
  return safeItems.slice(0, getVideoReferenceImageMaxCount(modelId, mode));
}

/** 参考图被裁掉时给用户看的提示文案（对话流用）。 */
export function getVideoReferenceLimitHint(modelId?: string, mode?: UploadRuleContext["videoReferenceMode"]) {
  if (mode === "first_last_frame") return "首尾帧模式只会使用前两张参考图";
  if (mode === "first_frame") return "首帧模式只会使用第一张参考图";
  if (mode === "last_frame") return "尾帧模式只会使用第一张参考图";
  return `普通参考图模式最多使用${getSeedanceReferenceLimits(modelId).image}张参考图`;
}

export function getUploadRuleOverrideKey(context: UploadRuleContext) {
  if (context.mode === "agent" || context.mode === "general") return "chat";
  if (context.mode === "video" && isBytePlusVideoModel(context.modelId)) {
    // ⭐ edit/extend 的「1 个参考视频」是上游硬规则 → 故意给一个后台面板里不存在的 key，
    // 免得后台把「融合模式」的视频数量调成 3 之后，把 edit/extend 也一起放宽（那样必然被上游拒）。
    if (isSingleVideoInputReferenceMode(context.videoReferenceMode)) return `byteplus:video.seedance:${context.videoReferenceMode}`;
    // ⭐ 2.0 系与 2.5 各一套 key（2.5 是 30 图 / 10 视频 / 10 音频，和 2.0 的 9/3/3 差很远，
    //    共用一条 override 会让后台一次点击就把 2.5 砍到 2.0 的量）。
    const keys = getSeedanceUploadRuleKeys(context.modelId);
    if (context.videoReferenceMode === "first_last_frame") return keys.firstLastFrame;
    if (context.videoReferenceMode === "first_frame") return keys.firstFrame;
    return keys.reference;
  }
  // Hailuo 3 的首帧/尾帧/首尾帧是上游硬规则（1 张 / 1 张 / 2 张），故意给一个后台面板里不存在的 key
  // → 后台改的那个数字只作用于**参考图模式**（key 仍是 modelId），改不动帧模式，避免被调成 5 张后必然报错。
  if (context.mode === "video" && isHailuo3VideoModel(context.modelId) && (context.videoReferenceMode === "first_frame" || context.videoReferenceMode === "last_frame" || context.videoReferenceMode === "first_last_frame")) {
    return `${HAILUO3_VIDEO_MODEL_ID}:${context.videoReferenceMode}`;
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
        image: kindRule({ enabled: true, maxCount: bytePlusLocalImageMax, maxSizeMb: 30, formats: commonImageFormats }),
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
      const imageMaxCount = getVideoReferenceImageMaxCount(context.modelId, context.videoReferenceMode);
      const lim = getSeedanceReferenceLimits(context.modelId);
      // ⭐⭐ 视频编辑 / 视频延长：**只开「参考视频」且只允许 1 个**，图片/音频按钮整个隐藏
      // （2026-08-09 用户拍板；上游 edit/extend 只吃一个 reference_video，多传/传图传音都没意义）。
      if (isSingleVideoInputReferenceMode(context.videoReferenceMode)) {
        // ⭐ 被编辑/延长的源视频官方要求 [4,30] 秒（文档原文："The input video to be edited must be
        //   [4, 30] seconds long. Otherwise, an error is returned."）→ 下限 4 不是 2，提前用大白话拦住。
        return makeRule({
          video: kindRule({ enabled: true, maxCount: 1, maxSizeMb: 200, formats: ["mp4", "mov"], minSeconds: 4, maxSeconds: lim.clipSeconds, maxTotalSeconds: lim.totalSeconds, requiresServerUrl: true }),
        });
      }
      const referenceMediaRule = context.videoReferenceMode === "first_frame" || context.videoReferenceMode === "first_last_frame" ? {} : {
        video: kindRule({ enabled: true, maxCount: lim.mediaCount, maxSizeMb: 200, formats: ["mp4", "mov"], minSeconds: 2, maxSeconds: lim.clipSeconds, maxTotalSeconds: lim.totalSeconds, requiresServerUrl: true }),
        audio: kindRule({ enabled: true, maxCount: lim.mediaCount, maxSizeMb: 15, formats: ["mp3", "wav"], minSeconds: 2, maxSeconds: lim.clipSeconds, maxTotalSeconds: lim.totalSeconds, requiresServerUrl: true }),
      };
      return makeRule({
        image: kindRule({ enabled: true, maxCount: imageMaxCount, maxSizeMb: 30, formats: commonImageFormats }),
        ...referenceMediaRule,
      });
    }

    // Hailuo 3：跟 Seedance 一样有参考模式（首帧 1 张 / 首尾帧 2 张 / 融合先按 3 张），
    // 但**不支持参考视频/音频**（OpenRouter 会静默丢弃）→ 只开 image。
    if (isHailuo3VideoModel(context.modelId)) {
      return makeRule({
        image: kindRule({ enabled: true, maxCount: getVideoReferenceImageMaxCount(context.modelId, context.videoReferenceMode), maxSizeMb: 8, formats: commonImageFormats }),
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
  if (input.audioCount > 0 && input.imageCount === 0 && input.videoCount === 0 && !isSeedance25VideoModel(input.modelId)) {
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

export function validateReferenceTotalDuration(kind: "video" | "audio", durations: Array<number | null | undefined>, modelId?: string): string | undefined {
  const total = sumReferenceDurations(durations);
  const limit = getSeedanceReferenceLimits(modelId).totalSeconds;
  // 容差走统一的 MEDIA_DURATION_EPSILON_SECONDS(0.2) → 有效上限 limit+0.2，正好等于实测 BytePlus r2v 的真实硬上限。
  // 必须带容差：我们自己生成的「15秒」视频实际是 15.1 秒，严格 >limit 会把它当参考视频时被自己拦死（历史 bug）。
  if (total > limit + MEDIA_DURATION_EPSILON_SECONDS) {
    const label = kind === "video" ? "视频" : "音频";
    return `当前${label}加起来是 ${formatSecondsOneDecimal(total)} 秒，超过${label}参考总时长上限 ${limit} 秒，请减少数量或更换更短的${label}`;
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
