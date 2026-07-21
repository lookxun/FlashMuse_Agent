// 统一的「BytePlus 模型 → 端点配置键」解析。
//
// 铁律：这是全项目唯一权威实现。对话流、工作流、资产库、Agent、通用模式——
// 所有需要把生成模型映射到 BytePlus 端点键的地方，都必须调用这里，禁止再复制一份。
// 历史上这段逻辑被复制到 image/route、video/route、generation-jobs 三处并各自跑偏，
// 导致「对话流能用、Agent/通用不能用」的问题（2026-07-14 修）。以后新增模式/模型只改这一个文件。

const ASSET_IMAGE_CREDIT_SOURCES = new Set([
  "character_image_generation",
  "scene_image_generation",
  "prop_image_generation",
  "shot_image_generation",
]);

function isAssetImageSource(source: string | null | undefined) {
  return !!source && ASSET_IMAGE_CREDIT_SOURCES.has(source);
}

function isAgentImageSource(source: string | null | undefined) {
  return source === "agent_image_generation";
}

function isAgentVideoSource(source: string | null | undefined) {
  return source === "agent_video_generation";
}

/**
 * 把生成模型 id + 计费来源(creditSource) 解析成 BytePlus 端点配置键。
 * 返回 undefined 表示「不是 BytePlus 模型」（走 OpenRouter）。
 *
 * 前缀由模式决定：资产库=asset-image、Agent=agent-image、其余(对话流/工作流/通用)=conversation-image；
 * 视频：Agent=agent-video、其余=video。各前缀在 system-settings 的配置表里都配齐了同一批模型，
 * 所以这里是纯粹的「前缀 + 型号」拼接，不需要任何模式特判。
 */
export function getBytePlusProviderKey(modelId: string | null | undefined, source: string | null | undefined): string | undefined {
  if (!modelId?.startsWith("byteplus:")) return undefined;

  // 视频（byteplus:video.*）
  if (modelId.startsWith("byteplus:video.")) {
    const prefix = isAgentVideoSource(source) ? "agent-video" : "video";
    if (modelId.endsWith("seedance-2-0-fast")) return `${prefix}.seedance-2-0-fast`;
    if (modelId.endsWith("seedance-2-0-mini")) return `${prefix}.seedance-2-0-mini`;
    if (modelId.endsWith("seedance-2-0")) return `${prefix}.seedance-2-0`;
    return undefined;
  }

  // 图片（byteplus:conversation-image.*）
  const prefix = isAssetImageSource(source) ? "asset-image" : isAgentImageSource(source) ? "agent-image" : "conversation-image";
  if (modelId.endsWith("seedream-4-5")) return `${prefix}.seedream-4-5`;
  if (modelId.endsWith("seedream-5-0-pro")) return `${prefix}.seedream-5-0-pro`;
  if (modelId.endsWith("seedream-5-0")) return `${prefix}.seedream-5-0`;
  return undefined;
}
