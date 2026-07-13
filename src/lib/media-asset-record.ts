import type { Prisma } from "@prisma/client";

/**
 * ============================================================================
 * 资产入库/显示 的唯一权威规范（Single Source of Truth for media assets）
 * ============================================================================
 *
 * 这个文件是"生成/上传的图片、视频、音频、文档"如何存进数据库、如何显示的
 * 唯一入口。所有写入点都必须用 buildMediaAssetRecord() 造记录、用 classifyAsset()
 * 归类；所有显示端都必须用 toAssetView() 取展示字段。
 *
 * 铁律：
 * 1. 一个资产的"原始数据"在出生（生成成功 / 上传落盘）那一刻一次填齐、之后永久冻结。
 * 2. "是生成还是上传"(promptSource) 由代码路径在出生时明确给定，绝不靠 URL 去猜。
 * 3. 之后唯一允许的变化：用户改名/移动分类/删除（只写 UserAssetState）、
 *    视频封面 poster 晚到回填、用户加 reversePrompt、远程URL换本地URL。
 * 4. 显示用的 previewMeta 不再存库，一律由 toAssetView() 现算——数据库里
 *    的列（model/ratio/resolution/width/height/...）是唯一真源。
 *
 * 未来任何新的"生图/生视频/上传"口子，都必须走这里，不允许再另写一套存/读方案。
 */

// —— 基础枚举（都用字符串，保持与历史数据兼容）——

/** 来源：generated=模型生成 / upload=用户上传 */
export type AssetOrigin = "generated" | "upload";
/** 归属流：conversation=对话流 / workflow=工作流 / asset=资产库直接生成 */
export type AssetFlow = "conversation" | "workflow" | "asset";
/** 媒体类型 */
export type AssetMediaType = "image" | "video" | "audio" | "document";
/** 资产库生成图的种类 */
export type AssetGenerationKind = "character" | "scene" | "shot";

/** classifyAsset 的输出：归类三件套 */
export interface AssetClassification {
  /** promptSource（来源标记：generated 生成 / upload 上传）*/
  promptSource: AssetOrigin;
  /** sourceKind（来源细类，如 conversation_generation_image 对话流生成图）*/
  sourceKind: string;
  /** initialCategory（出生分类，如 conversation_images 对话流图片）*/
  initialCategory: string;
}

/**
 * 唯一归类规则。输入代码路径已知的事实，输出 promptSource / sourceKind / initialCategory。
 * 见需求文档 M016 的归类规则表。
 */
export function classifyAsset(input: {
  origin: AssetOrigin;
  flow: AssetFlow;
  mediaType: AssetMediaType;
  assetKind?: AssetGenerationKind; // 仅 flow=asset 且 origin=generated 时用
}): AssetClassification {
  const { origin, flow, mediaType } = input;

  if (origin === "generated") {
    if (flow === "asset") {
      const kind = input.assetKind ?? "character";
      const initialCategory = kind === "scene" ? "scene_image" : kind === "shot" ? "shot_image" : "character_image";
      return { promptSource: "generated", sourceKind: "asset_generation_image", initialCategory };
    }
    if (flow === "workflow") {
      return mediaType === "video"
        ? { promptSource: "generated", sourceKind: "workflow_generation_video", initialCategory: "workflow_videos" }
        : { promptSource: "generated", sourceKind: "workflow_generation_image", initialCategory: "workflow_images" };
    }
    // conversation
    return mediaType === "video"
      ? { promptSource: "generated", sourceKind: "conversation_generation_video", initialCategory: "conversation_videos" }
      : { promptSource: "generated", sourceKind: "conversation_generation_image", initialCategory: "conversation_images" };
  }

  // origin === "upload"
  const flowPrefix = flow === "workflow" ? "workflow" : "conversation";
  const sourceKind = `${flowPrefix}_upload_${mediaType}`;
  const categoryByType: Record<AssetMediaType, string> = {
    image: `${flowPrefix}_upload_images`,
    video: `${flowPrefix}_upload_videos`,
    audio: `${flowPrefix}_upload_audios`,
    document: `${flowPrefix}_upload_documents`,
  };
  // 对话流上传图片的出生分类历史上叫 conversation_uploads（保持一致，避免读取端错乱）
  const initialCategory = flow === "conversation" && mediaType === "image" ? "conversation_uploads" : categoryByType[mediaType];
  return { promptSource: "upload", sourceKind, initialCategory };
}

// —— 统一入库构造器 ——

/** 上传占位提示词（无真实提示词时的 sourcePrompt）*/
export const UPLOAD_PROMPT_PLACEHOLDER: Record<AssetMediaType, string> = {
  image: "上传图片",
  video: "上传视频",
  audio: "上传音频",
  document: "上传文档",
};

export interface BuildMediaAssetInput {
  userId: string;
  origin: AssetOrigin;
  flow: AssetFlow;
  mediaType: AssetMediaType;
  assetKind?: AssetGenerationKind;
  // URL 三件套（已由 resolvePersistableMediaAssetUrl 规整好）
  url: string;
  normalizedUrl: string;
  originalUrl?: string | null;
  posterUrl?: string | null;
  thumbnailUrl?: string | null;
  // 终生ID（生成=预约名；上传=原文件名）
  name: string;
  // 提示词（生成的干净提示词）
  sourcePrompt?: string | null;
  // 模型与参数（仅生成）
  model?: string | null;
  modelProvider?: string | null;
  ratio?: string | null;
  resolution?: string | null;
  imageSize?: string | null;
  videoDuration?: string | null;
  /** 全量生成参数（generationSettings：原样存下模型调用时的所有设置）*/
  generationSettings?: Prisma.InputJsonValue | null;
  // 尺寸/时长
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  // 上传文件信息
  originalFileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  /** contentHash（内容哈希 SHA-256：用于判定"字节完全一致的同一文件"，仅上传）*/
  contentHash?: string | null;
  // 归属
  conversationId?: string | null;
  messageId?: string | null;
  workflowId?: string | null;
  workflowNodeId?: string | null;
  requestId?: string | null;
  firstSeenAt?: Date;
}

/**
 * 造一条完整的 MediaAsset 记录（create 用）。一次填齐所有该有的列。
 * 注意：previewMeta 故意不写（显示时由 toAssetView 现算）。
 */
export function buildMediaAssetRecord(input: BuildMediaAssetInput): Prisma.MediaAssetUncheckedCreateInput {
  const cls = classifyAsset({ origin: input.origin, flow: input.flow, mediaType: input.mediaType, assetKind: input.assetKind });
  const isWorkflow = input.flow === "workflow";
  const workspaceKind = isWorkflow ? "workflow" : "conversation";
  const workspaceId = isWorkflow ? input.workflowId ?? undefined : input.conversationId ?? undefined;
  const sourcePrompt = input.origin === "upload"
    ? (input.sourcePrompt || UPLOAD_PROMPT_PLACEHOLDER[input.mediaType])
    : (input.sourcePrompt || undefined);

  return {
    userId: input.userId,
    mediaType: input.mediaType,
    url: input.url,
    normalizedUrl: input.normalizedUrl,
    originalUrl: input.originalUrl ?? undefined,
    posterUrl: input.posterUrl ?? undefined,
    thumbnailUrl: input.thumbnailUrl ?? undefined,
    sourceKind: cls.sourceKind,
    sourcePrompt,
    promptSource: cls.promptSource,
    model: input.model ?? undefined,
    modelProvider: input.modelProvider ?? undefined,
    ratio: input.ratio ?? undefined,
    resolution: input.resolution ?? undefined,
    imageSize: input.imageSize ?? undefined,
    videoDuration: input.videoDuration ?? undefined,
    generationSettings: input.generationSettings ?? undefined,
    width: input.width ?? undefined,
    height: input.height ?? undefined,
    durationSeconds: input.durationSeconds ?? undefined,
    originalFileName: input.originalFileName ?? undefined,
    mimeType: input.mimeType ?? undefined,
    fileSize: input.fileSize ?? undefined,
    contentHash: input.contentHash ?? undefined,
    systemName: input.name,
    initialName: input.name,
    initialCategory: cls.initialCategory,
    conversationId: isWorkflow ? undefined : input.conversationId ?? undefined,
    messageId: isWorkflow ? undefined : input.messageId ?? undefined,
    workflowId: isWorkflow ? input.workflowId ?? undefined : undefined,
    workflowNodeId: isWorkflow ? input.workflowNodeId ?? undefined : undefined,
    workspaceKind,
    workspaceId,
    requestId: input.requestId ?? undefined,
    firstSeenAt: input.firstSeenAt ?? new Date(),
  };
}

/** 对应的 UserAssetState 出生记录（create 用）。 */
export function buildUserAssetStateRecord(input: { userId: string; mediaAssetId: string; name: string; initialCategory: string }): Prisma.UserAssetStateUncheckedCreateInput {
  return {
    userId: input.userId,
    mediaAssetId: input.mediaAssetId,
    currentName: input.name,
    currentCategory: input.initialCategory,
    originalCategory: input.initialCategory,
    lockedCategory: true,
    userRenamed: false,
    userRecategorized: true,
  };
}

// —— 统一显示投影 ——

const MODEL_DISPLAY_LABELS: Record<string, string> = {
  "byteplus:conversation-image.seedream-4-5": "Seedream 4.5",
  "byteplus:conversation-image.seedream-5-0": "Seedream 5.0",
  "byteplus:conversation-image.seedream-5-0-pro": "Seedream 5.0 Pro",
  "byteplus:video.seedance-2-0-fast": "Seedance 2.0 Fast",
  "byteplus:video.seedance-2-0": "Seedance 2.0",
  "byteplus:video.seedance-2-0-mini": "Seedance 2.0 Mini",
  "bytedance-seed/seedream-4.5": "Seedream 4.5",
  "google/gemini-3.1-flash-image-preview": "Gemini 3.1 Flash",
  "google/gemini-3-pro-image-preview": "Gemini 3 Pro",
  "openai/gpt-5.4-image-2": "GPT-5.4 Image 2",
  "bytedance/seedance-2.0-fast": "Seedance 2.0 Fast",
  "bytedance/seedance-2.0": "Seedance 2.0",
  "google/veo-3.1": "Veo 3.1",
  "kwaivgi/kling-v3.0-std": "Kling v3.0 Standard",
  "kwaivgi/kling-v3.0-pro": "Kling v3.0 Pro",
  "kwaivgi/kling-video-o1": "Kling Video O1",
};

/** 把模型 id 变成好看的显示名（modelLabel）。 */
export function getMediaModelDisplayName(model: string | null | undefined): string {
  if (!model) return "-";
  if (MODEL_DISPLAY_LABELS[model]) return MODEL_DISPLAY_LABELS[model];
  return model.replace(/^byteplus:(conversation-image|video)\./, "").replace(/^[^/]+\//, "");
}

/** 由宽高算常见比例标签（getCommonRatioLabel）。 */
export function getCommonRatioLabel(width: number, height: number): string {
  const commonRatios: Array<[string, number]> = [["16:9", 16 / 9], ["21:9", 21 / 9], ["9:16", 9 / 16], ["4:3", 4 / 3], ["3:4", 3 / 4], ["1:1", 1]];
  const ratio = width / height;
  const match = commonRatios.find(([, value]) => Math.abs(ratio - value) / value < 0.025);
  if (match) return match[0];
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height) || 1;
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
}

/** 由宽高反推分辨率档（getImageResolutionFromDimensions）。 */
export function getResolutionFromDimensions(width: number | null | undefined, height: number | null | undefined): string | undefined {
  if (!width || !height) return undefined;
  // 用总像素区分档位（不同模型/比例的最长边会重叠，总像素不会）：1K≈1M、2K≈4M、3K≈9M、4K≈16.7M。
  const totalPixels = width * height;
  if (totalPixels >= 13_000_000) return "4K";
  if (totalPixels >= 6_500_000) return "3K";
  if (totalPixels >= 2_500_000) return "2K";
  return "1K";
}

/** 显示用的参数卡（现算，不存库）。 */
export interface AssetPreviewMeta {
  modelLabel: string; // 模型显示名
  ratio: string; // 比例
  sizeText: string; // 尺寸文本（如 1920 × 1080）
  resolution: string; // 分辨率档（K数）
  duration?: string; // 视频时长
  mode: "image" | "video"; // 类型
}

/** MediaAsset 的展示相关列（toAssetView 需要读的字段） */
export interface MediaAssetDisplayColumns {
  mediaType: string;
  model: string | null;
  ratio: string | null;
  resolution: string | null;
  imageSize: string | null;
  videoDuration: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}

/**
 * 统一显示投影：由数据库列现算出参数卡（modelLabel/比例/尺寸/K数/时长）。
 * 所有显示端都用它，保证同一资产到处显示同一套、永不变。
 */
export function toAssetPreviewMeta(media: MediaAssetDisplayColumns): AssetPreviewMeta | undefined {
  const hasAny = media.model || media.ratio || media.resolution || media.imageSize || media.videoDuration || media.width || media.height || media.durationSeconds;
  if (!hasAny) return undefined;
  const mode = media.mediaType === "video" ? "video" : "image";
  const duration = media.videoDuration || (media.durationSeconds ? `${Math.round(media.durationSeconds)}秒` : undefined);
  return {
    modelLabel: getMediaModelDisplayName(media.model),
    ratio: media.width && media.height ? getCommonRatioLabel(media.width, media.height) : media.ratio || "-",
    sizeText: media.width && media.height ? `${media.width} × ${media.height}` : media.imageSize || "-",
    resolution: media.resolution || media.imageSize || getResolutionFromDimensions(media.width, media.height) || "-",
    duration: mode === "video" ? duration : undefined,
    mode,
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * 显示投影总入口：所有界面都用它取"参数卡"。
 * 规则：数据库里若已存好 previewMeta（老数据）就用它（模型名统一走 getMediaModelDisplayName 规范化）；
 * 否则由列现算（新数据不再存 previewMeta，一律现算）。保证同一资产哪里显示都一致。
 */
export function resolveAssetPreviewMeta(storedPreviewMeta: unknown, media: MediaAssetDisplayColumns): AssetPreviewMeta | undefined {
  if (isPlainRecord(storedPreviewMeta)) {
    const modelLabelRaw = typeof storedPreviewMeta.modelLabel === "string" ? storedPreviewMeta.modelLabel : media.model;
    return {
      modelLabel: getMediaModelDisplayName(modelLabelRaw),
      ratio: typeof storedPreviewMeta.ratio === "string" ? storedPreviewMeta.ratio : "-",
      sizeText: typeof storedPreviewMeta.sizeText === "string" ? storedPreviewMeta.sizeText : "-",
      resolution: typeof storedPreviewMeta.resolution === "string" ? storedPreviewMeta.resolution : "-",
      duration: typeof storedPreviewMeta.duration === "string" ? storedPreviewMeta.duration : undefined,
      mode: storedPreviewMeta.mode === "video" || media.mediaType === "video" ? "video" : "image",
    };
  }
  return toAssetPreviewMeta(media);
}

// —— 老归类叫法的兼容映射（只读用，绝不改库）——

/**
 * 历史数据里工作流生成图/视频都叫 workflow_generation、上传图叫 workflow_uploads 等。
 * 读取端遇到老叫法时用这个映射对齐到新规则，保证老资产显示归类正确。
 */
export function normalizeLegacySourceKind(sourceKind: string | null | undefined, mediaType: string): string {
  if (!sourceKind) return "";
  if (sourceKind === "workflow_generation") return mediaType === "video" ? "workflow_generation_video" : "workflow_generation_image";
  if (sourceKind === "asset_generation" || sourceKind === "asset_generation_video") return "asset_generation_image";
  return sourceKind;
}
