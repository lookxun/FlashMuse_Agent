/**
 * 图片模型「参考图尺寸」规则 —— 唯一权威实现。
 *
 * 为什么需要：某些图片模型对参考图有硬性**边长像素**要求，不合规时**不是在上传阶段报错，
 * 而是在生成阶段被上游拒绝**（Recraft 原文 `max image dimension should be no more than 4096` /
 * `min image dimension should be no less than 256`），过去这类失败降级成"服务器繁忙"，
 * 用户完全不知道是自己参考图的边长不对（正式服 2026-09-07 实测 B_488/B_491 就是这个原因）。
 *
 * 所以规则前移到「发送前」拦住并直接告诉用户原因，跟视频那套 `video-reference-image-rules.ts` 完全对称。
 * 对话流 / 工作流 / 服务端三处必须共用这里的常量与函数，禁止各写一套。
 *
 * ⚠️ 往里加模型前必须有依据（官方文档或线上失败原文），别拿某个模型的数去拦没验证过的模型。
 * ⚠️ 这里管的是**边长像素**，跟"体积过大(>2MB)"是两回事（后者是字节体积，我们上传只压体积、不缩像素）。
 */

import { isRecraftModel } from "@/lib/models";

export type ImageReferenceSizeRule = {
  /** 单边最小像素（含） */
  minSide: number;
  /** 单边最大像素（含） */
  maxSide: number;
};

/**
 * ⭐ 哪些图片模型受尺寸规则约束 + 各自的边长区间 —— 唯一权威判定。
 * 返回 undefined = 该模型不受约束、不拦。
 *
 * Recraft V4.1 / V4.1 Pro：上游硬性要求参考图单边 256~4096px（无宽高比限制），
 * 不合规时创建阶段直接被拒（原文见文件头注释）。
 */
export function getImageReferenceSizeRule(modelId?: string): ImageReferenceSizeRule | undefined {
  if (isRecraftModel(modelId)) return { minSide: 256, maxSide: 4096 };
  return undefined;
}

export function imageModelEnforcesReferenceImageSizeRules(modelId?: string) {
  return getImageReferenceSizeRule(modelId) !== undefined;
}

export type ImageReferenceImageItem = {
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
 * 单张参考图的尺寸校验。
 * ⚠️ 量不到尺寸时**不拦**（返回 undefined）：宁可让平台去判，也不能因为读不到宽高把用户挡死。
 */
export function validateImageReferenceImageDimensions(item: ImageReferenceImageItem, rule: ImageReferenceSizeRule, index = 0) {
  const { width, height } = item;
  if (!width || !height || !Number.isFinite(width) || !Number.isFinite(height)) return undefined;
  const name = label(item.name, index);
  if (width < rule.minSide || height < rule.minSide) {
    return `参考图${name}尺寸太小了（${width}×${height}）。当前模型要求参考图的长和宽都不小于 ${rule.minSide} 像素，请换一张尺寸更大的参考图后重试。`;
  }
  if (width > rule.maxSide || height > rule.maxSide) {
    return `参考图${name}尺寸太大了（${width}×${height}）。当前模型要求参考图的长和宽都不超过 ${rule.maxSide} 像素，请换一张尺寸更小的参考图后重试。`;
  }
  return undefined;
}

/** 一批参考图，返回第一条错误（没有问题返回 undefined）。 */
export function validateImageReferenceImages(items: ImageReferenceImageItem[], rule: ImageReferenceSizeRule) {
  for (let index = 0; index < items.length; index += 1) {
    const error = validateImageReferenceImageDimensions(items[index], rule, index);
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
 * 模型不受约束时直接返回 undefined（调用方也应先判 `imageModelEnforcesReferenceImageSizeRules`）。
 */
export async function validateImageReferenceImagesBeforeSend(modelId: string | undefined, items: ImageReferenceImageItem[], resolveSrc?: (url: string) => string) {
  const rule = getImageReferenceSizeRule(modelId);
  if (!rule || items.length === 0) return undefined;
  const measured = await Promise.all(items.map(async (item) => {
    if (item.width && item.height) return item;
    const dimensions = await measureImageDimensions(resolveSrc ? resolveSrc(item.url) : item.url);
    return dimensions ? { ...item, ...dimensions } : item;
  }));
  return validateImageReferenceImages(measured, rule);
}
