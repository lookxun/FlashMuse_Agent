/**
 * 视频模型「参考图尺寸/比例」规则 —— 唯一权威实现。
 *
 * 为什么需要：BytePlus（Seedance 系列）对参考图有硬性尺寸要求，不合规时**不是在生成阶段报错，
 * 而是在"素材送审"阶段就被平台拒绝**（原文 `Height must be between 300px and 6000px.` /
 * `Aspect ratio must be between 0.4 and 2.5.`），过去这类失败被降级成"服务器繁忙"，
 * 用户完全不知道是自己的参考图尺寸不对（正式服 7 月统计：82 次失败都是这个原因）。
 *
 * 所以规则前移到「发送前」拦住并直接告诉用户原因。
 * 对话流 / 工作流 / 服务端三处必须共用这里的常量与函数，禁止各写一套。
 */

/**
 * ⭐ 哪些视频模型受这套尺寸规则约束 —— 唯一权威判定，三处调用点（对话流 / 工作流 / 服务端）必须用它。
 *
 * 历史教训（2026-07-28 第十一次会话查出）：这道拦截一开始被写死"只对 BytePlus 生效"，
 * 结果 Kling 路径完全裸奔 —— 正式服有一个用户拿 338×191 的截图当参考图，
 * 连续 32 次被 Kling 异步拒绝（上游原文 `Image pixel is invalid`），
 * 因为是**异步**失败，用户等一两分钟才看到一句没用的"服务器繁忙"。
 * 而 Kling 官方规则和 BytePlus 完全一致（≥300×300px、宽高比 1:2.5~2.5:1），
 * 本就该共用同一套数，所以把判定收进这里、按模型集合统一管。
 *
 * ⚠️ 往里加模型前必须有依据（官方文档或线上失败原文），别拿 BytePlus 的数去拦没验证过的模型。
 */
const VIDEO_REFERENCE_IMAGE_RULE_MODELS = new Set([
  // BytePlus Seedance：原文 `Height must be between 300px and 6000px.` / `Aspect ratio must be between 0.4 and 2.5.`
  "byteplus:video.seedance-2-0",
  "byteplus:video.seedance-2-0-fast",
  "byteplus:video.seedance-2-0-mini",
  // 快手 Kling：官方要求图片分辨率不小于 300×300px、宽高比 1:2.5~2.5:1；不合规时原文 `Image pixel is invalid`
  "kwaivgi/kling-v3.0-std",
  "kwaivgi/kling-v3.0-pro",
  "kwaivgi/kling-video-o1",
]);

export function videoModelEnforcesReferenceImageSizeRules(modelId?: string) {
  return Boolean(modelId) && VIDEO_REFERENCE_IMAGE_RULE_MODELS.has(modelId as string);
}

export const VIDEO_REFERENCE_IMAGE_MIN_SIDE = 300;
export const VIDEO_REFERENCE_IMAGE_MAX_SIDE = 6000;
export const VIDEO_REFERENCE_IMAGE_MIN_ASPECT = 0.4;
export const VIDEO_REFERENCE_IMAGE_MAX_ASPECT = 2.5;

export type VideoReferenceImageItem = {
  /** 显示给用户的名字（@名 / 文件名 / 「参考图1」都行） */
  name?: string;
  url: string;
  width?: number;
  height?: number;
};

function label(name: string | undefined, index: number) {
  const trimmed = (name ?? "").trim();
  return trimmed ? `「${trimmed}」` : `第 ${index + 1} 张`;
}

/**
 * 单张参考图的尺寸/比例校验。
 * ⚠️ 量不到尺寸时**不拦**（返回 undefined）：宁可让平台去判，也不能因为读不到宽高把用户挡死。
 */
export function validateVideoReferenceImageDimensions(item: VideoReferenceImageItem, index = 0) {
  const { width, height } = item;
  if (!width || !height || !Number.isFinite(width) || !Number.isFinite(height)) return undefined;
  const name = label(item.name, index);
  if (width < VIDEO_REFERENCE_IMAGE_MIN_SIDE || height < VIDEO_REFERENCE_IMAGE_MIN_SIDE) {
    return `参考图${name}太小了（${width}×${height}）。生视频要求参考图宽和高都不小于 ${VIDEO_REFERENCE_IMAGE_MIN_SIDE} 像素，请换一张更大的图。`;
  }
  if (width > VIDEO_REFERENCE_IMAGE_MAX_SIDE || height > VIDEO_REFERENCE_IMAGE_MAX_SIDE) {
    return `参考图${name}太大了（${width}×${height}）。生视频要求参考图宽和高都不超过 ${VIDEO_REFERENCE_IMAGE_MAX_SIDE} 像素，请换一张更小的图。`;
  }
  const aspect = width / height;
  if (aspect < VIDEO_REFERENCE_IMAGE_MIN_ASPECT || aspect > VIDEO_REFERENCE_IMAGE_MAX_ASPECT) {
    return `参考图${name}太窄或太长了（${width}×${height}，宽高比 ${aspect.toFixed(2)}）。生视频要求宽高比在 ${VIDEO_REFERENCE_IMAGE_MIN_ASPECT}–${VIDEO_REFERENCE_IMAGE_MAX_ASPECT} 之间（如 16:9、9:16、1:1、4:3），请换一张比例更常规的图。`;
  }
  return undefined;
}

/** 一批参考图，返回第一条错误（没有问题返回 undefined）。 */
export function validateVideoReferenceImages(items: VideoReferenceImageItem[]) {
  for (let index = 0; index < items.length; index += 1) {
    const error = validateVideoReferenceImageDimensions(items[index], index);
    if (error) return error;
  }
  return undefined;
}

/** 浏览器端量图片真实宽高（量不到返回 undefined，绝不抛错）。 */
export function measureImageDimensions(src: string) {
  return new Promise<{ width: number; height: number } | undefined>((resolve) => {
    if (typeof window === "undefined" || !src) {
      resolve(undefined);
      return;
    }
    const image = new window.Image();
    const done = (value: { width: number; height: number } | undefined) => resolve(value);
    image.onload = () => done(image.naturalWidth > 0 && image.naturalHeight > 0 ? { width: image.naturalWidth, height: image.naturalHeight } : undefined);
    image.onerror = () => done(undefined);
    image.src = src;
  });
}

/**
 * 发送前校验（对话流 / 工作流共用）：已知宽高的直接判，不知道的现场量一次再判。
 * `resolveSrc` 用来把内部 url 换成浏览器真正能加载的地址（静态镜像/本地地址）。
 */
export async function validateVideoReferenceImagesBeforeSend(items: VideoReferenceImageItem[], resolveSrc?: (url: string) => string) {
  if (items.length === 0) return undefined;
  const measured = await Promise.all(items.map(async (item) => {
    if (item.width && item.height) return item;
    const dimensions = await measureImageDimensions(resolveSrc ? resolveSrc(item.url) : item.url);
    return dimensions ? { ...item, ...dimensions } : item;
  }));
  return validateVideoReferenceImages(measured);
}
