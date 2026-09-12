export type ConversationModel = {
  label: string;
  id: string;
};

export type GenerationModel = ConversationModel & {
  durations?: string[];
};

export type ImageResolution = "1K" | "2K" | "3K" | "4K";
export type ImageQuality = "auto" | "low" | "medium" | "high" | "xhigh" | "max";
export const IMAGE_QUALITY_OPTIONS: ImageQuality[] = ["auto", "low", "medium", "high"];
export const GPT_IMAGE_25_QUALITY_OPTIONS: ImageQuality[] = ["auto", "low", "medium", "high", "xhigh", "max"];
export const IMAGE_QUALITY_LABELS: Record<ImageQuality, string> = { auto: "自动", low: "低", medium: "中", high: "高", xhigh: "超高", max: "最高" };
export const DEFAULT_IMAGE_QUALITY: ImageQuality = "high";
// gpt-5.4-image-2 / gpt-image-2.5 走 OpenRouter 新图片接口(/api/v1/images)，支持 quality 画质档。
export const GPT_IMAGE2_MODEL_ID = "openai/gpt-5.4-image-2";
export const GPT_IMAGE_25_FLARE_MODEL_ID = "openai/gpt-image-2.5-flare";
export const GPT_IMAGE_25_SUNBURST_MODEL_ID = "openai/gpt-image-2.5-sunburst";
export const VIDEO_ENHANCE_MODEL_ID = "mediakit:video.enhance-generative";
export const VIDEO_ENHANCE_FAST_MODEL_ID = "mediakit:video.enhance-fast";
export const VIDEO_ENHANCE_STANDARD_MODEL_ID = "mediakit:video.enhance-standard";
export const VIDEO_DEPTH_MODEL_ID = "runninghub:video.depthcrafter";
export function isVideoEnhanceModel(modelId?: string) {
  return modelId === VIDEO_ENHANCE_MODEL_ID || modelId === VIDEO_ENHANCE_FAST_MODEL_ID || modelId === VIDEO_ENHANCE_STANDARD_MODEL_ID;
}
export function isVideoDepthModel(modelId?: string) {
  return modelId === VIDEO_DEPTH_MODEL_ID;
}
export function isBytePlusVideoEnhanceModel(modelId?: string) {
  return modelId === VIDEO_ENHANCE_FAST_MODEL_ID || modelId === VIDEO_ENHANCE_STANDARD_MODEL_ID;
}
export function isGptImage25Model(modelId?: string) {
  return modelId === GPT_IMAGE_25_FLARE_MODEL_ID || modelId === GPT_IMAGE_25_SUNBURST_MODEL_ID;
}
export function isGptImage2Model(modelId?: string) {
  return modelId === GPT_IMAGE2_MODEL_ID || isGptImage25Model(modelId);
}
// Recraft V4.1 / V4.1 Pro 走 OpenRouter 专用图片接口 /api/v1/images（同 gpt-5.4-image-2 那条路，但只传 aspect_ratio）。
export const RECRAFT_V41_MODEL_ID = "recraft/recraft-v4.1";
export const RECRAFT_V41_PRO_MODEL_ID = "recraft/recraft-v4.1-pro";
export function isRecraftModel(modelId?: string) {
  return modelId === RECRAFT_V41_MODEL_ID || modelId === RECRAFT_V41_PRO_MODEL_ID;
}
// gpt-5.4-image-2（GPT版）走 OpenRouter 老接口(/chat/completions + modalities)，即经 GPT 语言模型优化提示词后再生图。
// 内部另起 id，发往 OpenRouter 时映射回真实模型名 GPT_IMAGE2_MODEL_ID。不支持 4K、不支持画质档。
export const GPT_IMAGE2_AGENT_MODEL_ID = "openai/gpt-5.4-image-2-agent";
export function isGptImage2AgentModel(modelId?: string) {
  return modelId === GPT_IMAGE2_AGENT_MODEL_ID;
}
// ⭐ 唯一权威：这个模型的失败卡上会不会出现「AI改写重试」入口。
// 只有 gpt-5.4-image-2 两款（直连版 + GPT版）接了安全改写编排，其它图片模型和**所有视频模型**都没有。
// 用途有两个，必须保持一致：①失败卡按钮显示判定（gpt-image-safety-retry.ts）
// ②红字文案里要不要写"可由AI安全改写后重试"（error-message.ts）——
// 以前文案不看模型，导致视频碰到模型拒绝时也写"可点AI改写重试"，而视频根本没这个按钮。
export function modelSupportsPromptSafetyRewrite(modelId?: string) {
  return modelId === GPT_IMAGE2_MODEL_ID || isGptImage2AgentModel(modelId);
}
// 把 GPT版 内部 id 解析成发往 OpenRouter 的真实模型名。
export function resolveOpenRouterImageModelName(modelId?: string) {
  return isGptImage2AgentModel(modelId) ? GPT_IMAGE2_MODEL_ID : modelId;
}
// 模型选择弹窗里显示在模型名下方的灰字副标题（唯一权威，前台对话流 / 工作流画布共用）。
// 每条 = 「几个字特点 · 约多少积分/张」。
// ⭐ 积分/张 = round(usd/张 × usdToCnyRate × creditsPerCny)。汇率/积分率**存数据库、后台可调**，
//    由调用方从 /api/model-availability 的 creditRate 传进来（不传则用代码默认 7.2 × 10 估算）。
// ⭐ 浮动计费的模型（gemini / gpt 按 token、seedream-5.0-pro 按像素给区间）标「约」；按张固定价的给精确整数。
type ImageModelMenuInfo = {
  desc: string;
  usd: number;
  usdHigh?: number;
  approx?: boolean;
  /**
   * ⭐ **事前预估专用**：按「归一化后的真实分辨率」给的每张美元（唯一权威，只被 `getEstimatedGenerationUsd` 读）。
   *
   * 数值来源 = **正式服 `CreditLedger` 里真实扣费数据的 p99**（2026-09-05 从 5791 条真实扣费统计），
   * ⛔ 不是文档价、不是猜的。取 p99 而不是均值：闸门要判"够不够"，估低了等于没拦。
   * ⚠️ 菜单副标题**不读这张表**（继续读 `usd`），所以调整这里不会改动界面上显示的「X积分/张」。
   * ⭐ 某个档位没有条目时回落到本表的最大值（同一模型内），再没有才用 `usdHigh ?? usd`。
   */
  estUsdByResolution?: Record<string, number>;
  /**
   * ⭐ **事前预估专用**：画质档位相对「默认档（high）」的倍数（唯一权威，只被 `getEstimatedGenerationUsd` 读）。
   *
   * 只有走 `/api/v1/images` 的 GPT Image 2.5 有它 —— 那两个模型的价钱**几乎只由画质决定**
   * （2026-09-12 从本地 57 条真实扣费统计：1K 16:9 medium $0.0075 / high $0.0285 / xhigh $0.0506 / max $0.1137，
   *   最贵档是默认档的 4 倍）。只按分辨率估会「低画质估太高把人拦住、最高画质估太低等于没拦」。
   * ⛔ 表里没有这一项的模型一律按 1 倍处理（= 保持原行为，别给别的模型加）。
   */
  estQualityMultiplier?: Record<string, number>;
};
// GPT Image 2.5 的画质倍数（相对默认档 high = 1）。来源：2026-09-12 本地真实扣费统计，
// 1K 16:9 的 medium/high/xhigh/max = 0.00745 / 0.02848 / 0.05055 / 0.1137 美元。
// `auto` 由模型自己决定档位 → 按默认档 1 倍估（宁可估高一点，别把闸门放空）。
const gptImage25QualityMultiplier: Record<string, number> = { auto: 1, low: 0.05, medium: 0.3, high: 1, xhigh: 1.9, max: 4.1 };
const IMAGE_MODEL_MENU_INFO: Record<string, ImageModelMenuInfo> = {
  "recraft/recraft-v4.1": { desc: "平面设计·高美学·短词出图", usd: 0.035, estUsdByResolution: { "1K": 0.035 } },
  "recraft/recraft-v4.1-pro": { desc: "意料之外的美·2K高清", usd: 0.21, estUsdByResolution: { "2K": 0.21 } },
  // 实测与分辨率无关（1K/2K/4K 都是同一个数）
  "google/gemini-3.1-flash-image-preview": { desc: "均衡·高性价比", usd: 0.11, approx: true, estUsdByResolution: { "1K": 0.104, "2K": 0.104, "4K": 0.153 } },
  "google/gemini-3-pro-image-preview": { desc: "均衡·质感更好", usd: 0.18, approx: true, estUsdByResolution: { "1K": 0.14, "2K": 0.144, "4K": 0.144 } },
  "openai/gpt-5.4-image-2-agent": { desc: "GPT优化提示·适合新手", usd: 0.24, approx: true, estUsdByResolution: { "1K": 0.46, "2K": 0.52, "4K": 0.52 } },
  "openai/gpt-5.4-image-2": { desc: "精准·可4K·多参考图", usd: 0.24, approx: true, estUsdByResolution: { "1K": 0.24, "2K": 0.50, "4K": 0.46 } },
  // GPT Image 2.5（Flare / Sunburst 两个**价钱完全一样**，只差风格）：
  // ⭐ 2026-09-12 真实扣费实测（本地 57 条 + 测试服 6 条，⛔ 不是文档价）。1K + 默认画质 high：
  //    16:9/9:16 1280×720 → $0.0286（2 积分）｜ 4:3/3:4 1152×864 → $0.0390（3 积分）｜ 1:1 1024×1024 → $0.0528（4 积分）
  //    → **比例越方越贵**（按 patch 计费、不是按像素线性），所以菜单给区间「约2-4积分/张」，
  //      ⛔ 别写成单个数（菜单以前写 $0.041 → 显示「约3积分/张」，两头都不对）。
  // ⭐ 画质对价钱的影响比比例更大（1K 16:9：medium 0.0075 / high 0.0285 / xhigh 0.0506 / max 0.1137）
  //    → 预估表用「1K 最贵比例的 high」当基准 + `estQualityMultiplier` 分档，见下。
  "openai/gpt-image-2.5-flare": { desc: "出图快·日常", usd: 0.0286, usdHigh: 0.0528, approx: true, estUsdByResolution: { "1K": 0.053, "2K": 0.11, "4K": 0.16 }, estQualityMultiplier: gptImage25QualityMultiplier },
  "openai/gpt-image-2.5-sunburst": { desc: "精细·改图准", usd: 0.0286, usdHigh: 0.0528, approx: true, estUsdByResolution: { "1K": 0.053, "2K": 0.11, "4K": 0.16 }, estQualityMultiplier: gptImage25QualityMultiplier },
  "byteplus:conversation-image.seedream-4-5": { desc: "中文强·通用", usd: 0.04, estUsdByResolution: { "1K": 0.04, "2K": 0.04, "3K": 0.04, "4K": 0.04 } },
  "bytedance-seed/seedream-4.5": { desc: "中文强·通用", usd: 0.04, estUsdByResolution: { "1K": 0.04, "2K": 0.04, "3K": 0.04, "4K": 0.04 } },
  "byteplus:conversation-image.seedream-5-0": { desc: "新版·高性价比", usd: 0.035, estUsdByResolution: { "1K": 0.035, "2K": 0.035, "3K": 0.035, "4K": 0.035 } },
  "byteplus:conversation-image.seedream-5-0-pro": { desc: "新版·精修可控", usd: 0.045, usdHigh: 0.09, estUsdByResolution: { "1K": 0.09, "2K": 0.105 } },
};
const IMAGE_MENU_HINT_USD_TO_CNY = 7.2;
const IMAGE_MENU_HINT_CREDITS_PER_CNY = 10;
export function getImageModelFallbackUsd(modelId?: string): number | undefined {
  if (!modelId) return undefined;
  const usd = IMAGE_MODEL_MENU_INFO[modelId]?.usd;
  return typeof usd === "number" && usd > 0 ? usd : undefined;
}

/**
 * ⭐ 「这次生成大概要花多少美元」—— 事前预估的唯一入口（唯一权威）。
 *
 * 用途只有一个：**开任务之前判断用户积分够不够**（见 lib/generation-quota.ts）。
 * ⛔ 不是用来扣费的 —— 真实扣费永远按上游返回的 usage 走（credits.ts / video-usage-cost.ts）。
 *
 * ⭐⭐ **口径（2026-09-05 用户拍板"要预估的尽量准"后重做）**：
 *   ① 单价一律读**真实扣费数据统计出来的 p99**（`estUsdByResolution` / `estUsdPerSecondByResolution`），
 *      ⛔ 不再用菜单上那个"按 720p / 单张的基准价"当预估价 —— 那个数在 1080p 上估低 3 倍、在 480p 上估高 2 倍。
 *   ② **必须传归一化后的分辨率**（`resolveImageSettingsForModel` / `resolveVideoSettingsForModel` 的结果），
 *      ⛔ 别传用户请求的原值：模型规则表会把不支持的档位抬到自己的默认档（和会员画质校验同一个坑）。
 *   ③ 视频时长走 `getEffectiveVideoDurationSeconds`（= 真正发给上游的秒数），
 *      拿不到时长用**上游默认的 5 秒**，⛔ 不再按该模型最长档估（以前 Seedance 2.5 会按 30 秒估，高 6 倍）。
 *   ④ 图片张数按 `/api/image` 同样的口径 clamp 到 1~4。
 * ⚠️ 取 p99 而不是均值：闸门估低了就等于没拦（用户能把余额刷成负数）；但也别再瞎往高估，那是拦正常用户。
 * ⚠️ 表里查不到的模型返回 0 = 不做限制（不认识的模型不许连带把正常用户拦死）。
 */
export function getEstimatedGenerationUsd(input: { kind: "image" | "video" | "audio"; modelId?: string; count?: number; seconds?: number; chars?: number; resolution?: string; quality?: string }): number {
  const { kind, modelId } = input;
  if (!modelId) return 0;
  if (kind === "image") {
    const info = IMAGE_MODEL_MENU_INFO[modelId];
    if (!info) return 0;
    const unit = pickEstimateUnitPrice(info.estUsdByResolution, input.resolution)
      ?? (typeof info.usdHigh === "number" && info.usdHigh > 0 ? info.usdHigh : info.usd);
    // ⭐ 画质倍数：只有配了 estQualityMultiplier 的模型（GPT Image 2.5）才生效，其余恒 1 倍。
    //   quality 必须过 normalizeImageQuality（按模型给合法档位），⛔ 别直接信请求里的字符串。
    const qualityMultiplier = info.estQualityMultiplier
      ? info.estQualityMultiplier[normalizeImageQuality(input.quality, modelId)] ?? 1
      : 1;
    // 与 /api/image 的 getRequestedImageCount 同口径（1~4 张）。
    const count = Math.min(4, Math.max(1, Math.floor(input.count ?? 1)));
    return Math.max(0, unit) * Math.max(0, qualityMultiplier) * count;
  }
  if (kind === "video") {
    const info = VIDEO_MODEL_MENU_INFO[modelId];
    if (!info) return 0;
    const perSecond = pickEstimateUnitPrice(info.estUsdPerSecondByResolution, input.resolution) ?? info.usdPerSecond;
    if (!perSecond) return 0;
    const seconds = getEffectiveVideoDurationSeconds(modelId, input.seconds);
    return Math.max(0, perSecond) * Math.max(1, seconds);
  }
  const perChar = AUDIO_MODEL_MENU_INFO[modelId]?.usdPerChar;
  if (!perChar) return 0;
  return Math.max(0, perChar) * Math.max(1, Math.floor(input.chars ?? 1));
}

/**
 * 从「按分辨率的实测价表」里取单价：命中就用它；表里有但这一档没有 → 用表里的**最大值**兜底；
 * 压根没有表 → 返回 undefined（调用方回落到基准价）。
 */
function pickEstimateUnitPrice(table: Record<string, number> | undefined, resolution?: string) {
  if (!table) return undefined;
  const hit = resolution ? table[resolution] : undefined;
  if (typeof hit === "number" && hit > 0) return hit;
  const values = Object.values(table).filter((value) => typeof value === "number" && value > 0);
  return values.length > 0 ? Math.max(...values) : undefined;
}

/**
 * ⭐ 「这个模型这次实际会生成几秒」—— 唯一权威。
 *
 * `openrouter-video.ts` 发给上游的时长和事前预估**必须是同一个数**，否则预估必然偏
 * （以前预估按最长档、上游按 5 秒兜底，Seedance 2.5 上差 6 倍）。
 * ⚠️ 改这里等于改真正发给上游的秒数，动之前先看 `openrouter-video.ts` 里那几条实测注释。
 */
export function getEffectiveVideoDurationSeconds(modelId: string | undefined, value?: string | number) {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").match(/\d+/)?.[0]);
  // ⭐ 拿不到时长时用 5 秒 —— 这是上游侧一直在用的兜底值，⛔ 别改成"最长档"。
  const safeSeconds = Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
  if (!modelId) return safeSeconds;
  if (isVideoEnhanceModel(modelId) || isVideoDepthModel(modelId)) return safeSeconds;
  // Seedance 2.5 实测支持 4~30 秒；其余 BytePlus（2.0 系）仍 4~15 秒。
  if (modelId === SEEDANCE_25_VIDEO_MODEL_ID) return Math.min(30, Math.max(4, safeSeconds));
  if (modelId.startsWith("byteplus:video.")) return Math.min(15, Math.max(4, safeSeconds));
  // Hailuo 3：OpenRouter 声明 5~15 整秒（官方 4~15，OpenRouter 从 5 起）→ 4 秒必须就近取到 5，否则上游 400。
  if (modelId === HAILUO3_VIDEO_MODEL_ID) return getClosestSupportedDuration(safeSeconds, HAILUO3_SUPPORTED_DURATION_SECONDS);
  return safeSeconds;
}

export function getClosestSupportedDuration(seconds: number, supported: number[]) {
  return supported.reduce((best, item) => (Math.abs(item - seconds) < Math.abs(best - seconds) ? item : best), supported[0]);
}

export function getImageModelSelectHint(
  modelId?: string,
  usdToCnyRate: number = IMAGE_MENU_HINT_USD_TO_CNY,
  creditsPerCny: number = IMAGE_MENU_HINT_CREDITS_PER_CNY,
): string | null {
  if (!modelId) return null;
  const info = IMAGE_MODEL_MENU_INFO[modelId];
  if (!info) return null;
  const rate = (usdToCnyRate > 0 ? usdToCnyRate : IMAGE_MENU_HINT_USD_TO_CNY) * (creditsPerCny > 0 ? creditsPerCny : IMAGE_MENU_HINT_CREDITS_PER_CNY);
  const toCredits = (usd: number) => Math.max(1, Math.round(usd * rate));
  const credits = info.usdHigh
    ? `约${toCredits(info.usd)}-${toCredits(info.usdHigh)}积分/张`
    : `${info.approx ? "约" : ""}${toCredits(info.usd)}积分/张`;
  return `${info.desc} · ${credits}`;
}

// 视频模型菜单副标题（唯一权威）：几个字特点 · 约多少积分/秒。
// ⭐ 积分/秒 = round(每秒美元 × usdToCnyRate × creditsPerCny)。汇率由调用方从 creditRate 传进来（同图片）。
// ⭐ 每秒美元来源（2026-08 实测 `GET /api/v1/videos/models` 的 pricing_skus + 代码里 getBytePlusVideoPricePerMillionUsd）：
//    - Kling / MiniMax H3 是「按秒固定价」→ 给精确整数；
//    - Seedance(按 token) / Veo(带音频/4K 分档) 随分辨率浮动 → 取常见档(约 720p / 带音频)的代表值并标「约」。
//    BytePlus Seedance 的每秒美元 = 每秒 token(720p≈21600) × 每百万 token 单价 / 1e6。
type VideoModelMenuInfo = {
  desc: string;
  usdPerSecond: number;
  approx?: boolean;
  /**
   * ⭐ **事前预估专用**：按「归一化后的真实分辨率」给的每秒美元（唯一权威，只被 `getEstimatedGenerationUsd` 读）。
   *
   * 数值来源 = **正式服 `CreditLedger` 里真实扣费数据的 p99**（2026-09-05 统计，每档都有实测样本）。
   * ⛔⛔ 视频每秒单价**随分辨率剧烈变化**（Seedance 是按 token 计费，token 数 ∝ 像素）：
   *   实测 Seedance 2.0 → 480p 0.071 / 720p 0.155 / **1080p 0.386**（1080p 是 720p 的 2.5 倍）。
   *   以前只有一个数（720p 基准）→ 1080p 估低 3 倍、480p 估高 2 倍，两头都不准。
   * ⚠️ 菜单副标题**不读这张表**（继续读 `usdPerSecond`），所以调整这里不会改动界面上的「X积分/秒」。
   */
  estUsdPerSecondByResolution?: Record<string, number>;
};
const VIDEO_MODEL_MENU_INFO: Record<string, VideoModelMenuInfo> = {
  "minimax/hailuo-3": { desc: "2K·自带音效", usdPerSecond: 0.13, estUsdPerSecondByResolution: { "2K": 0.13 } },
  "kwaivgi/kling-v3.0-std": { desc: "标准·高性价比", usdPerSecond: 0.084, estUsdPerSecondByResolution: { "720p": 0.126 } },
  "kwaivgi/kling-v3.0-pro": { desc: "高质量", usdPerSecond: 0.112, estUsdPerSecondByResolution: { "720p": 0.168 } },
  "byteplus:video.seedance-2-0-mini": { desc: "出片快·低成本", usdPerSecond: 0.076, approx: true, estUsdPerSecondByResolution: { "480p": 0.036, "720p": 0.118 } },
  "byteplus:video.seedance-2-0-fast": { desc: "出片快·480/720p", usdPerSecond: 0.121, approx: true, estUsdPerSecondByResolution: { "480p": 0.057, "720p": 0.143 } },
  "byteplus:video.seedance-2-0": { desc: "通用·最高4K", usdPerSecond: 0.151, approx: true, estUsdPerSecondByResolution: { "480p": 0.071, "720p": 0.275, "1080p": 0.458, "4K": 0.951 } },
  "byteplus:video.seedance-2-5": { desc: "新版·最长30秒", usdPerSecond: 0.231, approx: true, estUsdPerSecondByResolution: { "480p": 0.104, "720p": 0.277, "1080p": 0.623 } },
  // 火山 MediaKit 画质增强（大模型版）：文档价 2.5 元/分钟 × 分辨率系数（720p×1 / 1080p×2 / 2K×4），≤30fps。
  // 换美元：÷ 7.2。菜单副标题用 1080p 代表档。
  "mediakit:video.enhance-generative": { desc: "成片超分·720p/1080p/2K", usdPerSecond: 0.0116, approx: true, estUsdPerSecondByResolution: { "720p": 0.0058, "1080p": 0.0116, "2K": 0.0231 } },
  "mediakit:video.enhance-fast": { desc: "海外极速超分·最高4K", usdPerSecond: 0.0034, approx: true, estUsdPerSecondByResolution: { "720p": 0.0017, "1080p": 0.0034, "2K": 0.0069, "4K": 0.0138 } },
  "mediakit:video.enhance-standard": { desc: "海外标准超分·最高4K", usdPerSecond: 0.0069, approx: true, estUsdPerSecondByResolution: { "720p": 0.0034, "1080p": 0.0069, "2K": 0.0138, "4K": 0.0275 } },
  // RunningHub DepthCrafter：无真实扣费样本，按 GPU 工作流粗估，待回校。
  "runninghub:video.depthcrafter": { desc: "视频抽深度·灰白深度图", usdPerSecond: 0.02, approx: true, estUsdPerSecondByResolution: { "720p": 0.02 } },
};
export function getVideoModelSelectHint(
  modelId?: string,
  usdToCnyRate: number = IMAGE_MENU_HINT_USD_TO_CNY,
  creditsPerCny: number = IMAGE_MENU_HINT_CREDITS_PER_CNY,
): string | null {
  if (!modelId) return null;
  const info = VIDEO_MODEL_MENU_INFO[modelId];
  if (!info) return null;
  const rate = (usdToCnyRate > 0 ? usdToCnyRate : IMAGE_MENU_HINT_USD_TO_CNY) * (creditsPerCny > 0 ? creditsPerCny : IMAGE_MENU_HINT_CREDITS_PER_CNY);
  const credits = Math.max(1, Math.round(info.usdPerSecond * rate));
  return `${info.desc} · ${info.approx ? "约" : ""}${credits}积分/秒`;
}
// 图片 + 视频通用：菜单副标题（谁能命中用谁）。
export function getGenerationModelSelectHint(
  modelId?: string,
  usdToCnyRate: number = IMAGE_MENU_HINT_USD_TO_CNY,
  creditsPerCny: number = IMAGE_MENU_HINT_CREDITS_PER_CNY,
): string | null {
  return getImageModelSelectHint(modelId, usdToCnyRate, creditsPerCny)
    ?? getVideoModelSelectHint(modelId, usdToCnyRate, creditsPerCny)
    ?? getAudioModelSelectHint(modelId, usdToCnyRate, creditsPerCny);
}

// ⭐ 语音生成（TTS）模型菜单副标题（唯一权威）：几个字特点 · 约多少积分/千字。
// TTS 按「字符数」计费（OpenRouter `/api/v1/audio/speech`，见 openrouter-audio.ts），
// 所以这里按「每千字符」估算：round(每字符美元 × 1000 × usdToCnyRate × creditsPerCny)。
// 每字符美元来源 = OpenRouter endpoints 接口 pricing.prompt（2026-08 实测）。
type AudioModelMenuInfo = { desc: string; usdPerChar: number; defaultVoice?: string; free?: boolean };
const AUDIO_MODEL_MENU_INFO: Record<string, AudioModelMenuInfo> = {
  // MiniMax Speech 2.8 HD：音色最全(332个)、中文强、有机器人音。默认甜美女声。
  "minimax/speech-2.8-hd": { desc: "音色最全·中文强·高保真", usdPerChar: 0.0001, defaultVoice: "female-tianmei" },
  // Qwen-Audio-3.0-TTS Plus：中文/方言强、表现力好。默认龙安灵心(女声)。
  "qwen/qwen-audio-3.0-tts-plus": { desc: "中文方言强·表现力好", usdPerChar: 0.00002, defaultVoice: "longanlingxin" },
  // Fish Audio S2.1 Pro：情绪/克隆强，无固定音色表 → 不传 voice 用供应商默认音色。
  "fish-audio/s2.1-pro": { desc: "情绪表演强·多语言", usdPerChar: 0.000015 },
  // Fish Audio S2.1 Pro 免费版：同模型、免费、无速度/可用性保证（测试用）。
  "fish-audio/s2.1-pro-free": { desc: "S2.1 免费版·测试用", usdPerChar: 0, free: true },
};
export function getAudioModelSelectHint(
  modelId?: string,
  usdToCnyRate: number = IMAGE_MENU_HINT_USD_TO_CNY,
  creditsPerCny: number = IMAGE_MENU_HINT_CREDITS_PER_CNY,
): string | null {
  if (!modelId) return null;
  const info = AUDIO_MODEL_MENU_INFO[modelId];
  if (!info) return null;
  if (info.free || info.usdPerChar <= 0) return `${info.desc} · 免费`;
  const rate = (usdToCnyRate > 0 ? usdToCnyRate : IMAGE_MENU_HINT_USD_TO_CNY) * (creditsPerCny > 0 ? creditsPerCny : IMAGE_MENU_HINT_CREDITS_PER_CNY);
  const credits = Math.max(1, Math.round(info.usdPerChar * 1000 * rate));
  return `${info.desc} · 约${credits}积分/千字`;
}
// 该模型发给 OpenRouter TTS 接口时用的默认音色（没有就返回 undefined = 用供应商默认音色）。
export function getAudioModelDefaultVoice(modelId?: string): string | undefined {
  return modelId ? AUDIO_MODEL_MENU_INFO[modelId]?.defaultVoice : undefined;
}
// 该模型每字符美元单价（用于扣费兜底定价，见 audio-usage-cost.ts）。
export function getAudioModelUsdPerChar(modelId?: string): number {
  return (modelId && AUDIO_MODEL_MENU_INFO[modelId]?.usdPerChar) || 0;
}
export function isAudioModel(modelId?: string): boolean {
  return Boolean(modelId && modelId in AUDIO_MODEL_MENU_INFO);
}

export function isFishAudioModel(modelId?: string) {
  return Boolean(modelId?.startsWith("fish-audio/"));
}
export function getImageQualityOptions(modelId?: string): ImageQuality[] {
  return isGptImage25Model(modelId) ? GPT_IMAGE_25_QUALITY_OPTIONS : IMAGE_QUALITY_OPTIONS;
}

export function normalizeImageQuality(value?: string, modelId?: string): ImageQuality {
  const options = getImageQualityOptions(modelId);
  return options.includes(value as ImageQuality) ? (value as ImageQuality) : DEFAULT_IMAGE_QUALITY;
}
export type ImageRatio = "智能比例" | "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "21:9";
type ConcreteImageRatio = Exclude<ImageRatio, "智能比例">;
type ImageDimensions = { width: number; height: number };
export type VideoResolution = "480p" | "720p" | "1080p" | "2K" | "4K";
export type VideoRatio = "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "21:9";

export type ImageModelRule = {
  resolutions: ImageResolution[];
  defaultResolution: ImageResolution;
  // 该模型在前端下拉里展示（且上游真正支持）的比例。⛔ 别再用全局固定列表 —— Recraft 只支持 5 个（无 21:9）。
  // 「智能比例」由 UI 统一置顶，不写进这里。
  ratios: ConcreteImageRatio[];
  modalities: string[];
  dimensions: Partial<Record<ImageResolution, Partial<Record<ConcreteImageRatio, ImageDimensions>>>>;
};

export type VideoModelRule = {
  resolutions: VideoResolution[];
  ratios: VideoRatio[];
  defaultResolution: VideoResolution;
  defaultRatio: VideoRatio;
  sizes: Partial<Record<VideoResolution, Partial<Record<VideoRatio, ImageDimensions>>>>;
  nonStandardSizes?: Partial<Record<VideoResolution, Partial<Record<VideoRatio, true>>>>;
};

export const models: ConversationModel[] = [
  { label: "Seed 2.0 Lite", id: "bytedance-seed/seed-2.0-lite" },
  { label: "DeepSeek V4 Pro", id: "deepseek/deepseek-v4-pro" },
  { label: "Grok 4.6", id: "x-ai/grok-4.6" },
  { label: "Kimi K3", id: "moonshotai/kimi-k3" },
  { label: "Gemini 3.1 Pro Preview", id: "google/gemini-3.1-pro-preview" },
  { label: "GPT-5.6 Terra", id: "openai/gpt-5.6-terra" },
  { label: "GPT-5.6 Terra Pro", id: "openai/gpt-5.6-terra-pro" },
] as const;

export const bytePlusConversationModels: ConversationModel[] = [
  { label: "Seed 2.0 Pro", id: "byteplus:chat.seed-2-0-pro" },
] as const;

export const frontendConversationModels: ConversationModel[] = [
  models[0],
  ...bytePlusConversationModels,
  ...models.slice(1),
] as const;

export const DEFAULT_CHAT_MODEL = "bytedance-seed/seed-2.0-lite";
export const ADVANCED_CHAT_MODEL = "openai/gpt-5.4";
export const PROMPT_TOOL_MODEL_CHAIN = [
  "openai/gpt-5.6-terra-pro",
  "moonshotai/kimi-k3",
  "x-ai/grok-4.6",
  "byteplus:chat.seed-2-0-pro",
  DEFAULT_CHAT_MODEL,
] as const;
export const imageGenerationModels: GenerationModel[] = [
  { label: "Seedream 4.5", id: "bytedance-seed/seedream-4.5" },
  // ⭐ Recraft V4.1 系（2026-08 接入）：走 OpenRouter 专用图片接口 /api/v1/images（⛔ 不支持 /chat/completions，
  //    实测 404「No endpoints found」）。参数已实测（endpoints 接口 + 真跑 10 张）：
  //    - 只支持 5 个比例：1:1 / 4:3 / 3:4 / 16:9 / 9:16（⛔ 无 21:9）；智能比例 → 上游 aspect_ratio:"auto"。
  //    - 分辨率不可调（上游无 resolution 参数）：V4.1 恒 ~1K、Pro 恒 ~2K（Pro 正好是 V4.1 每边 ×2）。
  //    - 输出 webp；参考图最多 1 张；n 最多 6；价格 V4.1 $0.035/张、Pro $0.21/张。
  //    ⭐ 排在 Gemini 之上。
  { label: "Recraft V4.1", id: "recraft/recraft-v4.1" },
  { label: "Recraft V4.1 Pro", id: "recraft/recraft-v4.1-pro" },
  { label: "Gemini 3.1 Flash Image Preview", id: "google/gemini-3.1-flash-image-preview" },
  { label: "Gemini 3 Pro Image Preview", id: "google/gemini-3-pro-image-preview" },
  { label: "GPT-5.4 Image 2（GPT版）", id: "openai/gpt-5.4-image-2-agent" },
  { label: "GPT-5.4 Image 2", id: "openai/gpt-5.4-image-2" },
  { label: "GPT Image 2.5 Flare", id: "openai/gpt-image-2.5-flare" },
  { label: "GPT Image 2.5 Sunburst", id: "openai/gpt-image-2.5-sunburst" },
] as const;

export const bytePlusImageGenerationModels: GenerationModel[] = [
  { label: "Seedream 4.5", id: "byteplus:conversation-image.seedream-4-5" },
  { label: "Seedream 5.0 Lite", id: "byteplus:conversation-image.seedream-5-0" },
  { label: "Seedream 5.0 Pro", id: "byteplus:conversation-image.seedream-5-0-pro" },
] as const;

export const frontendImageGenerationModels: GenerationModel[] = [
  ...bytePlusImageGenerationModels,
  ...imageGenerationModels,
] as const;

/**
 * MiniMax H3（OpenRouter slug `minimax/hailuo-3`）—— 模型 id 的唯一权威常量。
 *
 * ⚠️ **名字别搞混**：调用要用的 slug 里带 `hailuo`（OpenRouter 沿用了海螺 01/02 的老命名，
 * canonical 是 `minimax/hailuo-03-20260730`），但这一代**对外不叫海螺** ——
 * OpenRouter 页面展示名是 `MiniMax: H3`、MiniMax 官网/官方接口的模型参数都是 `MiniMax-H3`
 * （官方博客明写"抛弃了 Hailuo-02 架构"）。→ **界面一律显示 `MiniMax H3`，只有 id 里保留 hailuo。**
 *
 * ⭐ 接入依据（2026-08-03 查 `GET https://openrouter.ai/api/v1/videos/models`，不是猜的）：
 * - `supported_resolutions: ["2K"]` —— **只有 2K 一档**（MiniMax 官方还有 768P，OpenRouter 没接）。
 * - `supported_aspect_ratios: ["21:9","16:9","4:3","1:1","3:4","9:16"]`。
 * - `supported_durations: [5..15]`（官方是 4~15，OpenRouter 从 5 起）。
 * - `supported_frame_images: ["first_frame","last_frame"]` → 首帧 / 尾帧 / 首尾帧都支持。
 * - `generate_audio: true`、`seed: false`、`supported_sizes: null`（所以不能发 `size`）。
 * - 计费：`duration_seconds 0.13` + `reference_images 0.04`（走 usage.cost，不用配价格表）。
 *
 * ⛔ 参考视频 / 参考音频：OpenRouter 文档明写「audio/video references 只有 BytePlus Seedance 2.0 会被采纳，
 *    其它供应商只用图片、其余**静默忽略**」→ 所以 H3 拿不到官方的 V2V 动作迁移 / 音色参考，
 *    `upload-rules.ts` 里"非 BytePlus 不许传参考视频音频"那条必须保持不动（它正好挡住了这个静默失败）。
 */
export const HAILUO3_VIDEO_MODEL_ID = "minimax/hailuo-3";

/**
 * BytePlus Seedance 2.5 的模型 id —— 唯一权威。
 * ⛔ 别再在别处手写这个字符串（`upload-rules.ts` 的 `isSeedance25VideoModel`、后台上传规则面板都用它）。
 */
export const SEEDANCE_25_VIDEO_MODEL_ID = "byteplus:video.seedance-2-5";

/**
 * 模型下拉里要标「NEW」小徽标的新模型 —— 唯一权威（对话流 + 工作流画布共用）。
 * 徽标长相见 `src/components/new-badge.tsx`（⛔ 别再各处手写那串 className）。
 */
export function isNewGenerationModel(modelId: string) {
  return isGptImage25Model(modelId);
}

/**
 * 模型下拉里要标金色的模型 —— 唯一权威（对话流 + 工作流画布共用）。
 * 每类菜单只留最好的一个：图片 Sunburst、视频 Seedance 2.5、语音 MiniMax Speech 2.8 HD。
 */
export function isGoldGenerationModel(modelId: string) {
  return modelId === GPT_IMAGE_25_SUNBURST_MODEL_ID
    || modelId === SEEDANCE_25_VIDEO_MODEL_ID
    || modelId === "minimax/speech-2.8-hd";
}

// H3 在 OpenRouter 上支持 5~15 秒（整秒）。
export const HAILUO3_SUPPORTED_DURATION_SECONDS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const hailuo3Durations = HAILUO3_SUPPORTED_DURATION_SECONDS.map((seconds) => `${seconds}秒`);

// ⛔ 2026-08-30 用户拍板下线（别再加回来）：
//   - OpenRouter 版 Seedance 2.0 / 2.0 Fast（只保留 BytePlus 版，早已默认关闭）
//   - Kling Video O1（只有 1080p 一档，和会员画质分档冲突）
//   - Veo 3.1（不再采购）
export const videoGenerationModels: GenerationModel[] = [
  { label: "MiniMax H3", id: HAILUO3_VIDEO_MODEL_ID, durations: hailuo3Durations },
  { label: "Kling v3.0 Standard", id: "kwaivgi/kling-v3.0-std", durations: ["5秒", "10秒", "15秒"] },
  { label: "Kling v3.0 Pro", id: "kwaivgi/kling-v3.0-pro", durations: ["5秒", "10秒", "15秒"] },
] as const;

const bytePlusSeedanceDurations = ["4秒", "5秒", "6秒", "7秒", "8秒", "9秒", "10秒", "11秒", "12秒", "13秒", "14秒", "15秒"];

// Seedance 2.5 实测支持 4~30 秒（整数）。
const bytePlusSeedance25Durations = Array.from({ length: 27 }, (_, i) => `${i + 4}秒`);

/**
 * ⭐ 「带参考图时」被上游收窄的可用时长 —— 唯一权威表。
 *
 * ⚠️ 2026-08-30：唯一一条记录（`google/veo-3.1` 带参考图只允许 8 秒）随 Veo 3.1 下线一起删了，
 * 表先留着（校验函数还在共用），往里加模型必须有依据（官方文档或线上失败原文），不许凭猜。
 */
const VIDEO_REFERENCE_DURATION_LIMITS: Record<string, number[]> = {};

/** 该模型带参考图时允许的时长（秒）；没有限制返回 undefined。 */
export function getVideoReferenceDurationLimit(modelId?: string) {
  if (!modelId) return undefined;
  return VIDEO_REFERENCE_DURATION_LIMITS[modelId];
}

/**
 * 发送前校验「带参考图 + 当前时长」是否被上游允许。不合规返回给用户看的原因，合规返回 undefined。
 * 对话流 / 工作流 / 服务端三处共用，禁止各写一套。
 * ⚠️ 故意**不做静默改写**：时长直接决定计费，悄悄从 4 秒改成 8 秒会让用户多花钱且莫名其妙。
 */
export function validateVideoDurationWithReferences(modelId: string | undefined, duration: string | undefined, referenceCount: number) {
  if (referenceCount <= 0) return undefined;
  const allowed = getVideoReferenceDurationLimit(modelId);
  if (!allowed || allowed.length === 0) return undefined;
  const seconds = Number(String(duration ?? "").match(/\d+/)?.[0]);
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  if (allowed.includes(seconds)) return undefined;
  return `当前模型在使用参考图时只支持 ${allowed.join(" / ")} 秒的视频时长（你选的是 ${seconds} 秒），请把时长改成 ${allowed.join(" 或 ")} 秒后重试。`;
}

export const bytePlusVideoGenerationModels: GenerationModel[] = [
  { label: "Seedance 2.0 Mini", id: "byteplus:video.seedance-2-0-mini", durations: bytePlusSeedanceDurations },
  { label: "Seedance 2.0 Fast", id: "byteplus:video.seedance-2-0-fast", durations: bytePlusSeedanceDurations },
  { label: "Seedance 2.0", id: "byteplus:video.seedance-2-0", durations: bytePlusSeedanceDurations },
  // ⭐ Seedance 2.5（端点 ep-20260807153703-h48pt → dreamina-seedance-2-5-260628）。放最下面 + 金色 + NEW。
  // ✅ 分辨率：2026-09-09 用 duration=1 探上游（必被拒、不建任务）坐实 1080p 已开（报 duration 非法 = 分辨率过了）。
  //    2026-08-08 当时 1080p 还被拒，文档后来才写上。比例 6 种；时长 4~30 秒。
  { label: "Seedance 2.5", id: "byteplus:video.seedance-2-5", durations: bytePlusSeedance25Durations },
] as const;

export const DEFAULT_IMAGE_MODEL = imageGenerationModels[0].id;
// ⭐ 默认视频模型故意用 BytePlus Seedance 2.0 Fast，⛔ 不许写成 `videoGenerationModels[0]`：
// 那个位置现在是 MiniMax H3（只有 2K 一档），当默认值会让基础会员一进来就撞「不支持该画质」，
// 而且 2K 最贵。这个 id 同时也是 `fallbackVideoModelRule`（未知模型的回落规则），必须是最低档那个。
export const DEFAULT_VIDEO_MODEL = "byteplus:video.seedance-2-0-fast";

// ⭐ 语音生成（TTS）模型（2026-08 接入，对话流）——唯一权威列表。
// 都走 OpenRouter `/api/v1/audio/speech`（见 openrouter-audio.ts）。参数/默认音色/单价见 AUDIO_MODEL_MENU_INFO。
export const audioGenerationModels: GenerationModel[] = [
  { label: "Fish Audio S2.1 Pro（免费）", id: "fish-audio/s2.1-pro-free" },
  { label: "Fish Audio S2.1 Pro", id: "fish-audio/s2.1-pro" },
  { label: "Qwen Audio 3.0 TTS Plus", id: "qwen/qwen-audio-3.0-tts-plus" },
  { label: "MiniMax Speech 2.8 HD", id: "minimax/speech-2.8-hd" },
] as const;

export const DEFAULT_AUDIO_MODEL = audioGenerationModels[0].id;

const seedream2KDimensions: Record<ConcreteImageRatio, ImageDimensions> = {
  "1:1": { width: 2048, height: 2048 },
  "16:9": { width: 2560, height: 1440 },
  "9:16": { width: 1440, height: 2560 },
  "21:9": { width: 3024, height: 1296 },
  "4:3": { width: 2304, height: 1728 },
  "3:4": { width: 1728, height: 2304 },
};

const seedream4KDimensions: Record<ConcreteImageRatio, ImageDimensions> = {
  "1:1": { width: 4096, height: 4096 },
  "16:9": { width: 4096, height: 2304 },
  "9:16": { width: 2304, height: 4096 },
  "21:9": { width: 4096, height: 1756 },
  "4:3": { width: 4096, height: 3072 },
  "3:4": { width: 3072, height: 4096 },
};

const bytePlusSeedream2KDimensions: Record<ConcreteImageRatio, ImageDimensions> = {
  "1:1": { width: 2048, height: 2048 },
  "16:9": { width: 2848, height: 1600 },
  "9:16": { width: 1600, height: 2848 },
  "21:9": { width: 3136, height: 1344 },
  "4:3": { width: 2304, height: 1728 },
  "3:4": { width: 1728, height: 2304 },
};

const bytePlusSeedream4KDimensions: Record<ConcreteImageRatio, ImageDimensions> = {
  "1:1": { width: 4096, height: 4096 },
  "16:9": { width: 5504, height: 3040 },
  "9:16": { width: 3040, height: 5504 },
  "21:9": { width: 6240, height: 2656 },
  "4:3": { width: 4704, height: 3520 },
  "3:4": { width: 3520, height: 4704 },
};

// Seedream 5.0 Pro 只支持 1K / 2K（不支持 4K），且 2K 尺寸与 4.5/Lite 不同（官方参考像素表）。
const bytePlusSeedream1KDimensions: Record<ConcreteImageRatio, ImageDimensions> = {
  "1:1": { width: 1024, height: 1024 },
  "16:9": { width: 1424, height: 800 },
  "9:16": { width: 800, height: 1424 },
  "21:9": { width: 1568, height: 672 },
  "4:3": { width: 1152, height: 864 },
  "3:4": { width: 864, height: 1152 },
};

const bytePlusSeedreamPro2KDimensions: Record<ConcreteImageRatio, ImageDimensions> = {
  "1:1": { width: 2048, height: 2048 },
  "16:9": { width: 2816, height: 1584 },
  "9:16": { width: 1584, height: 2816 },
  "21:9": { width: 3136, height: 1344 },
  "4:3": { width: 2368, height: 1776 },
  "3:4": { width: 1776, height: 2368 },
};

// Seedream 5.0 Lite 3K（官方参考像素表）。
const bytePlusSeedream3KDimensions: Record<ConcreteImageRatio, ImageDimensions> = {
  "1:1": { width: 3072, height: 3072 },
  "16:9": { width: 4096, height: 2304 },
  "9:16": { width: 2304, height: 4096 },
  "21:9": { width: 4704, height: 2016 },
  "4:3": { width: 3456, height: 2592 },
  "3:4": { width: 2592, height: 3456 },
};

const gemini1KDimensions: Record<ConcreteImageRatio, ImageDimensions> = {
  "1:1": { width: 1024, height: 1024 },
  "16:9": { width: 1376, height: 768 },
  "9:16": { width: 768, height: 1376 },
  "21:9": { width: 1584, height: 672 },
  "4:3": { width: 1200, height: 896 },
  "3:4": { width: 896, height: 1200 },
};

const gemini2KDimensions: Record<ConcreteImageRatio, ImageDimensions> = {
  "1:1": { width: 2048, height: 2048 },
  "16:9": { width: 2752, height: 1536 },
  "9:16": { width: 1536, height: 2752 },
  "21:9": { width: 3168, height: 1344 },
  "4:3": { width: 2400, height: 1792 },
  "3:4": { width: 1792, height: 2400 },
};

const gemini4KDimensions: Record<ConcreteImageRatio, ImageDimensions> = {
  "1:1": { width: 4096, height: 4096 },
  "16:9": { width: 5504, height: 3072 },
  "9:16": { width: 3072, height: 5504 },
  "21:9": { width: 6336, height: 2688 },
  "4:3": { width: 4800, height: 3584 },
  "3:4": { width: 3584, height: 4800 },
};

const gpt541KDimensions: Record<ConcreteImageRatio, ImageDimensions> = {
  "1:1": { width: 1024, height: 1024 },
  "16:9": { width: 1280, height: 720 },
  "9:16": { width: 720, height: 1280 },
  "21:9": { width: 1568, height: 672 },
  "4:3": { width: 1152, height: 864 },
  "3:4": { width: 864, height: 1152 },
};

const gpt542KDimensions: Record<ConcreteImageRatio, ImageDimensions> = {
  "1:1": { width: 2048, height: 2048 },
  "16:9": { width: 2560, height: 1440 },
  "9:16": { width: 1440, height: 2560 },
  "21:9": { width: 3024, height: 1296 },
  "4:3": { width: 2304, height: 1728 },
  "3:4": { width: 1728, height: 2304 },
};

// gpt-5.4-image-2 新接口(/api/v1/images)硬约束：宽高都被 16 整除、最长边 ≤ 3840、总像素 ≤ 8,294,400。
// 以下 4K 尺寸均已按约束取到该比例下的最大可用值（已实测通过）。
const gpt544KDimensions: Record<ConcreteImageRatio, ImageDimensions> = {
  "1:1": { width: 2880, height: 2880 },
  "16:9": { width: 3840, height: 2160 },
  "9:16": { width: 2160, height: 3840 },
  "21:9": { width: 3808, height: 1632 },
  "4:3": { width: 3264, height: 2448 },
  "3:4": { width: 2448, height: 3264 },
};

// Recraft V4.1（~1K，实测 endpoints + 真跑）；Pro（~2K）正好每边 ×2。仅 5 个比例，无 21:9。
const recraftV41Dimensions: Partial<Record<ConcreteImageRatio, ImageDimensions>> = {
  "1:1": { width: 1024, height: 1024 },
  "4:3": { width: 1216, height: 896 },
  "3:4": { width: 896, height: 1216 },
  "16:9": { width: 1344, height: 768 },
  "9:16": { width: 768, height: 1344 },
};

const recraftV41ProDimensions: Partial<Record<ConcreteImageRatio, ImageDimensions>> = {
  "1:1": { width: 2048, height: 2048 },
  "4:3": { width: 2432, height: 1792 },
  "3:4": { width: 1792, height: 2432 },
  "16:9": { width: 2688, height: 1536 },
  "9:16": { width: 1536, height: 2688 },
};

// 现有图片模型（Seedream / Gemini / GPT）都支持全部 6 个具体比例。Recraft 只支持其中 5 个（无 21:9）。
const standardImageRatios: ConcreteImageRatio[] = ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"];
const recraftImageRatios: ConcreteImageRatio[] = ["16:9", "4:3", "1:1", "3:4", "9:16"];

export const imageModelRules: Record<string, ImageModelRule> = {
  "bytedance-seed/seedream-4.5": {
    resolutions: ["2K", "4K"],
    defaultResolution: "2K",
    ratios: standardImageRatios,
    modalities: ["image"],
    dimensions: {
      "2K": seedream2KDimensions,
      "4K": seedream4KDimensions,
    },
  },
  "byteplus:conversation-image.seedream-4-5": {
    resolutions: ["2K", "4K"],
    defaultResolution: "2K",
    ratios: standardImageRatios,
    modalities: ["image"],
    dimensions: {
      "2K": bytePlusSeedream2KDimensions,
      "4K": bytePlusSeedream4KDimensions,
    },
  },
  "byteplus:conversation-image.seedream-5-0": {
    resolutions: ["2K", "3K", "4K"],
    defaultResolution: "2K",
    ratios: standardImageRatios,
    modalities: ["image"],
    dimensions: {
      "2K": bytePlusSeedream2KDimensions,
      "3K": bytePlusSeedream3KDimensions,
      "4K": bytePlusSeedream4KDimensions,
    },
  },
  "byteplus:conversation-image.seedream-5-0-pro": {
    resolutions: ["1K", "2K"],
    defaultResolution: "2K",
    ratios: standardImageRatios,
    modalities: ["image"],
    dimensions: {
      "1K": bytePlusSeedream1KDimensions,
      "2K": bytePlusSeedreamPro2KDimensions,
    },
  },
  "google/gemini-3.1-flash-image-preview": {
    resolutions: ["1K", "2K", "4K"],
    defaultResolution: "1K",
    ratios: standardImageRatios,
    modalities: ["image", "text"],
    dimensions: {
      "1K": gemini1KDimensions,
      "2K": gemini2KDimensions,
      "4K": gemini4KDimensions,
    },
  },
  "google/gemini-3-pro-image-preview": {
    resolutions: ["1K", "2K", "4K"],
    defaultResolution: "1K",
    ratios: standardImageRatios,
    modalities: ["image", "text"],
    dimensions: {
      "1K": gemini1KDimensions,
      "2K": gemini2KDimensions,
      "4K": gemini4KDimensions,
    },
  },
  "openai/gpt-5.4-image-2": {
    resolutions: ["1K", "2K", "4K"],
    defaultResolution: "1K",
    ratios: standardImageRatios,
    modalities: ["image", "text"],
    dimensions: {
      "1K": gpt541KDimensions,
      "2K": gpt542KDimensions,
      "4K": gpt544KDimensions,
    },
  },
  // GPT Image 2.5：2026-09-11 真出图坐实，size 精确像素与 5.4 Image 2 同一张表；resolution 档无效。
  "openai/gpt-image-2.5-flare": {
    resolutions: ["1K", "2K", "4K"],
    defaultResolution: "1K",
    ratios: standardImageRatios,
    modalities: ["image"],
    dimensions: {
      "1K": gpt541KDimensions,
      "2K": gpt542KDimensions,
      "4K": gpt544KDimensions,
    },
  },
  "openai/gpt-image-2.5-sunburst": {
    resolutions: ["1K", "2K", "4K"],
    defaultResolution: "1K",
    ratios: standardImageRatios,
    modalities: ["image"],
    dimensions: {
      "1K": gpt541KDimensions,
      "2K": gpt542KDimensions,
      "4K": gpt544KDimensions,
    },
  },
  "openai/gpt-5.4-image-2-agent": {
    resolutions: ["1K", "2K"],
    defaultResolution: "1K",
    ratios: standardImageRatios,
    modalities: ["image", "text"],
    dimensions: {
      "1K": gpt541KDimensions,
      "2K": gpt542KDimensions,
    },
  },
  // Recraft V4.1：只有 1K 一档（上游无 resolution 参数），5 个比例。modalities 不用（走 /api/v1/images）。
  "recraft/recraft-v4.1": {
    resolutions: ["1K"],
    defaultResolution: "1K",
    ratios: recraftImageRatios,
    modalities: ["image"],
    dimensions: {
      "1K": recraftV41Dimensions,
    },
  },
  // Recraft V4.1 Pro：只有 2K 一档，5 个比例。
  "recraft/recraft-v4.1-pro": {
    resolutions: ["2K"],
    defaultResolution: "2K",
    ratios: recraftImageRatios,
    modalities: ["image"],
    dimensions: {
      "2K": recraftV41ProDimensions,
    },
  },
};

export const fallbackImageModelRule: ImageModelRule = {
  resolutions: ["1K", "2K"],
  defaultResolution: "1K",
  ratios: standardImageRatios,
  modalities: ["image", "text"],
  dimensions: {
    "1K": gemini1KDimensions,
    "2K": gemini2KDimensions,
  },
};

const seedanceFastVideoSizes: VideoModelRule["sizes"] = {
  "480p": {
    "21:9": { width: 992, height: 432 },
    "16:9": { width: 864, height: 496 },
    "4:3": { width: 752, height: 560 },
    "1:1": { width: 640, height: 640 },
    "3:4": { width: 560, height: 752 },
    "9:16": { width: 496, height: 864 },
  },
  "720p": {
    "21:9": { width: 1470, height: 630 },
    "16:9": { width: 1280, height: 720 },
    "4:3": { width: 1112, height: 834 },
    "1:1": { width: 960, height: 960 },
    "3:4": { width: 834, height: 1112 },
    "9:16": { width: 720, height: 1280 },
  },
};

const seedanceFastNonStandardVideoSizes: VideoModelRule["nonStandardSizes"] = {
  "480p": { "21:9": true, "16:9": true, "4:3": true, "1:1": true, "3:4": true, "9:16": true },
  "720p": { "21:9": true, "4:3": true, "1:1": true, "3:4": true },
};

const seedance1080pVideoSizes = {
  "21:9": { width: 2206, height: 946 },
  "16:9": { width: 1920, height: 1080 },
  "4:3": { width: 1664, height: 1248 },
  "1:1": { width: 1440, height: 1440 },
  "3:4": { width: 1248, height: 1664 },
  "9:16": { width: 1080, height: 1920 },
} as const;

const seedanceVideoSizes: VideoModelRule["sizes"] = {
  ...seedanceFastVideoSizes,
  "1080p": seedance1080pVideoSizes,
  "4K": {
    "21:9": { width: 4398, height: 1886 },
    "16:9": { width: 3840, height: 2160 },
    "4:3": { width: 3326, height: 2494 },
    "1:1": { width: 2880, height: 2880 },
    "3:4": { width: 2494, height: 3326 },
    "9:16": { width: 2160, height: 3840 },
  },
};

const seedanceNonStandardVideoSizes: VideoModelRule["nonStandardSizes"] = {
  ...seedanceFastNonStandardVideoSizes,
  "1080p": { "21:9": true, "4:3": true, "1:1": true, "3:4": true },
  "4K": { "21:9": true, "4:3": true, "1:1": true, "3:4": true },
};

// ⭐ Seedance 2.5 官方精确像素表（480p/720p 与直打接口实测一致；1080p 与 2.0 官方表相同）。
const seedance25VideoSizes: VideoModelRule["sizes"] = {
  "480p": {
    "21:9": { width: 992, height: 432 },
    "16:9": { width: 854, height: 480 },
    "4:3": { width: 752, height: 560 },
    "1:1": { width: 640, height: 640 },
    "3:4": { width: 560, height: 752 },
    "9:16": { width: 480, height: 854 },
  },
  "720p": {
    "21:9": { width: 1470, height: 630 },
    "16:9": { width: 1280, height: 720 },
    "4:3": { width: 1112, height: 834 },
    "1:1": { width: 960, height: 960 },
    "3:4": { width: 834, height: 1112 },
    "9:16": { width: 720, height: 1280 },
  },
  "1080p": seedance1080pVideoSizes,
};

const klingVideoSizes: VideoModelRule["sizes"] = {
  "720p": {
    "16:9": { width: 1280, height: 720 },
    "9:16": { width: 720, height: 1280 },
    "1:1": { width: 960, height: 960 },
  },
};

const klingNonStandardVideoSizes: VideoModelRule["nonStandardSizes"] = {
  "720p": { "1:1": true },
};


// ⭐ Hailuo 3 的 2K 各比例**实际输出尺寸**（2026-08-03 直打 OpenRouter 实测，见桌面 minimax-h3-test）：
// 标准比例短边固定 1440；21:9 例外，实测 2944×1248（约分 92:39，比正 21:9=2.333 略宽 → 标 nonStandard）。
// 我们只把这张表用于界面显示"预计尺寸"，不发 size 给上游。
const hailuo3VideoSizes: VideoModelRule["sizes"] = {
  "2K": {
    "21:9": { width: 2944, height: 1248 },
    "16:9": { width: 2560, height: 1440 },
    "4:3": { width: 1920, height: 1440 },
    "1:1": { width: 1440, height: 1440 },
    "3:4": { width: 1440, height: 1920 },
    "9:16": { width: 1440, height: 2560 },
  },
};

const hailuo3NonStandardVideoSizes: VideoModelRule["nonStandardSizes"] = {
  "2K": { "21:9": true },
};

export const videoModelRules: Record<string, VideoModelRule> = {
  "byteplus:video.seedance-2-0-fast": {
    resolutions: ["480p", "720p"],
    ratios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
    defaultResolution: "720p",
    defaultRatio: "16:9",
    sizes: seedanceFastVideoSizes,
    nonStandardSizes: seedanceFastNonStandardVideoSizes,
  },
  "byteplus:video.seedance-2-0": {
    resolutions: ["480p", "720p", "1080p", "4K"],
    ratios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
    defaultResolution: "720p",
    defaultRatio: "16:9",
    sizes: seedanceVideoSizes,
    nonStandardSizes: seedanceNonStandardVideoSizes,
  },
  // ⭐ Seedance 2.5：480p/720p/1080p、6 种比例、4~30 秒。
  // 1080p 像素与 2.0 官方表相同。⛔ 故意**不配 nonStandardSizes**（2026-08-09 用户拍板）：
  //    官方精确像素表全都是官方标准尺寸 → 一个都不该标「（非标）」。
  "byteplus:video.seedance-2-5": {
    resolutions: ["480p", "720p", "1080p"],
    ratios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
    defaultResolution: "720p",
    defaultRatio: "16:9",
    sizes: seedance25VideoSizes,
  },
  "byteplus:video.seedance-2-0-mini": {
    resolutions: ["480p", "720p"],
    ratios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
    defaultResolution: "720p",
    defaultRatio: "16:9",
    sizes: seedanceFastVideoSizes,
    nonStandardSizes: seedanceFastNonStandardVideoSizes,
  },
  "kwaivgi/kling-v3.0-std": {
    resolutions: ["720p"],
    ratios: ["16:9", "1:1", "9:16"],
    defaultResolution: "720p",
    defaultRatio: "16:9",
    sizes: klingVideoSizes,
    nonStandardSizes: klingNonStandardVideoSizes,
  },
  "kwaivgi/kling-v3.0-pro": {
    resolutions: ["720p"],
    ratios: ["16:9", "1:1", "9:16"],
    defaultResolution: "720p",
    defaultRatio: "16:9",
    sizes: klingVideoSizes,
    nonStandardSizes: klingNonStandardVideoSizes,
  },
  [HAILUO3_VIDEO_MODEL_ID]: {
    resolutions: ["2K"],
    ratios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
    defaultResolution: "2K",
    defaultRatio: "16:9",
    sizes: hailuo3VideoSizes,
    nonStandardSizes: hailuo3NonStandardVideoSizes,
  },
  [VIDEO_ENHANCE_MODEL_ID]: {
    resolutions: ["720p", "1080p", "2K"],
    ratios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
    defaultResolution: "1080p",
    defaultRatio: "16:9",
    sizes: {
      "720p": seedanceFastVideoSizes["720p"],
      "1080p": seedance1080pVideoSizes,
      "2K": hailuo3VideoSizes["2K"],
    },
  },
  [VIDEO_ENHANCE_FAST_MODEL_ID]: {
    resolutions: ["720p", "1080p", "2K", "4K"],
    ratios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
    defaultResolution: "1080p",
    defaultRatio: "16:9",
    sizes: {
      "720p": seedanceFastVideoSizes["720p"],
      "1080p": seedance1080pVideoSizes,
      "2K": hailuo3VideoSizes["2K"],
      "4K": seedanceVideoSizes["4K"],
    },
  },
  [VIDEO_ENHANCE_STANDARD_MODEL_ID]: {
    resolutions: ["720p", "1080p", "2K", "4K"],
    ratios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
    defaultResolution: "1080p",
    defaultRatio: "16:9",
    sizes: {
      "720p": seedanceFastVideoSizes["720p"],
      "1080p": seedance1080pVideoSizes,
      "2K": hailuo3VideoSizes["2K"],
      "4K": seedanceVideoSizes["4K"],
    },
  },
  [VIDEO_DEPTH_MODEL_ID]: {
    resolutions: ["720p"],
    ratios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
    defaultResolution: "720p",
    defaultRatio: "16:9",
    sizes: {
      "720p": seedanceFastVideoSizes["720p"],
    },
  },
};

export const fallbackVideoModelRule: VideoModelRule = videoModelRules[DEFAULT_VIDEO_MODEL];

// BytePlus 视频单价（USD / 百万 token），按 官网价：随「输出分辨率」+「是否带视频输入」变化。
// 费用 = 该单价 × API 返回的 completion_tokens / 1_000_000。
export function getBytePlusVideoPricePerMillionUsd(modelId: string | null | undefined, resolution: string | undefined, hasVideoInput: boolean) {
  if (modelId === "byteplus:video.seedance-2-0-fast") return hasVideoInput ? 3.3 : 5.6;
  if (modelId === "byteplus:video.seedance-2-0-mini") return hasVideoInput ? 2.1 : 3.5;
  // Seedance 2.5：火山官网 2026-08 定价页实测确认，无参考视频 $10.70/M、有参考视频 $6.40/M。
  // 实测反验：720p/5秒=108900 token × 10.70/1e6 = $1.165，与官网定价示例「720p 5秒=1.156/视频」吻合。
  // 1080p 同一套单价（token ∝ 像素，分辨率越高 token 越多）。
  if (modelId === "byteplus:video.seedance-2-5") return hasVideoInput ? 6.40 : 10.70;
  // Seedance 2.0（完整版）：480p/720p 与 1080p / 4K 分档。
  if (resolution === "4K") return hasVideoInput ? 2.4 : 4.0;
  if (resolution === "1080p") return hasVideoInput ? 4.7 : 7.7;
  return hasVideoInput ? 4.3 : 7.0;
}

export const imageRatioMap: Record<ConcreteImageRatio, [number, number]> = {
  "16:9": [16, 9],
  "9:16": [9, 16],
  "1:1": [1, 1],
  "4:3": [4, 3],
  "3:4": [3, 4],
  "21:9": [21, 9],
};

export function getVideoModelRule(modelId?: string) {
  return modelId ? videoModelRules[modelId] ?? fallbackVideoModelRule : fallbackVideoModelRule;
}

export function getSupportedVideoResolutions(modelId?: string) {
  return getVideoModelRule(modelId).resolutions;
}

export function getSupportedVideoRatios(modelId?: string, resolution?: string) {
  const rule = getVideoModelRule(modelId);
  const ratiosForResolution = resolution ? rule.sizes[normalizeVideoResolutionForModel(modelId, resolution)] : undefined;
  return ratiosForResolution ? rule.ratios.filter((ratio) => Boolean(ratiosForResolution[ratio])) : rule.ratios;
}

export function normalizeVideoResolutionForModel(modelId: string | undefined, resolution?: string) {
  const rule = getVideoModelRule(modelId);
  return rule.resolutions.includes(resolution as VideoResolution) ? resolution as VideoResolution : rule.defaultResolution;
}

export function normalizeVideoRatioForModel(modelId: string | undefined, ratio?: string, resolution?: string) {
  const rule = getVideoModelRule(modelId);
  const ratios = getSupportedVideoRatios(modelId, resolution);
  if (ratios.includes(ratio as VideoRatio)) return ratio as VideoRatio;
  return ratios.includes(rule.defaultRatio) ? rule.defaultRatio : ratios[0] ?? rule.defaultRatio;
}

export function resolveVideoSettingsForModel(modelId: string | undefined, settings?: { ratio?: string; resolution?: string }) {
  const rule = getVideoModelRule(modelId);
  if (settings?.ratio === "智能比例") {
    // ⭐ 「智能比例」原本写死 720p / 16:9，但那是**只对支持 720p 的模型才成立**的假设：
    // Hailuo 3 只有 2K 一档，写死 720p 会把上游不认识的分辨率发上去（Kling Video O1 同理，只有 1080p）。
    // 所以这里改成「支持 720p 就还是 720p（行为不变），不支持就回落到该模型的默认档」。
    const resolution = rule.resolutions.includes("720p") ? "720p" : rule.defaultResolution;
    const ratio = rule.ratios.includes("16:9") ? "16:9" : rule.defaultRatio;
    const size = rule.sizes[resolution]?.[ratio] ?? { width: 1280, height: 720 };
    return { ratio, resolution, size };
  }

  const resolution = normalizeVideoResolutionForModel(modelId, settings?.resolution);
  const ratio = normalizeVideoRatioForModel(modelId, settings?.ratio, resolution);
  const size = rule.sizes[resolution]?.[ratio] ?? rule.sizes[rule.defaultResolution]?.[rule.defaultRatio] ?? { width: 1280, height: 720 };

  return { ratio, resolution, size };
}

export function getExpectedVideoDimensions(modelId: string | undefined, resolution: string | undefined, ratio: string | undefined) {
  return resolveVideoSettingsForModel(modelId, { ratio, resolution }).size;
}

/**
 * 「智能比例」下该模型实际会用的分辨率档。
 * ⛔ 前端不许再写死 "720p" —— Hailuo 3 只有 2K、Kling Video O1 只有 1080p，写死会显示/记录成错误的档位。
 */
export function getSmartVideoResolutionForModel(modelId: string | undefined): VideoResolution {
  return resolveVideoSettingsForModel(modelId, { ratio: "智能比例" }).resolution;
}

export function isNonStandardVideoSize(modelId: string | undefined, resolution: string | undefined, ratio: string | undefined) {
  const rule = getVideoModelRule(modelId);
  const resolved = resolveVideoSettingsForModel(modelId, { ratio, resolution });
  return Boolean(rule.nonStandardSizes?.[resolved.resolution]?.[resolved.ratio]);
}

export function getImageModelRule(modelId?: string) {
  return modelId ? imageModelRules[modelId] ?? fallbackImageModelRule : fallbackImageModelRule;
}

// 按模型的尺寸表把实际输出尺寸归到最接近的分辨率档（按总像素最近匹配）。
// 用于展示实际分辨率：gpt-5.4-image-2 的 4K 只有 8.29MP，通用阈值会误判成 3K，用模型表可正确显示 4K。
export function classifyImageResolutionByModel(modelId: string | undefined, dimensions?: { width: number; height: number }): ImageResolution | undefined {
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) return undefined;
  const rule = getImageModelRule(modelId);
  const total = dimensions.width * dimensions.height;
  let best: ImageResolution | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const resolution of rule.resolutions) {
    const ratios = rule.dimensions[resolution];
    if (!ratios) continue;
    for (const dim of Object.values(ratios)) {
      if (!dim) continue;
      const score = Math.abs(dim.width * dim.height - total);
      if (score < bestScore) {
        bestScore = score;
        best = resolution;
      }
    }
  }
  return best;
}

export function getSupportedImageResolutions(modelId?: string) {
  return getImageModelRule(modelId).resolutions;
}

// 该模型在前端下拉里可选的「具体比例」（不含智能比例，智能比例由 UI 统一置顶）。
export function getSupportedImageRatios(modelId?: string): ConcreteImageRatio[] {
  return getImageModelRule(modelId).ratios;
}

// 切模型时把当前比例归一化：智能比例保留；该模型支持就保留；否则回落到「智能比例」（各模型都支持智能比例）。
export function normalizeImageRatioForModel(modelId: string | undefined, ratio?: string): string {
  if (!ratio || ratio === "智能比例") return "智能比例";
  return getSupportedImageRatios(modelId).includes(ratio as ConcreteImageRatio) ? ratio : "智能比例";
}

export function normalizeImageResolutionForModel(modelId: string | undefined, resolution?: string) {
  const rule = getImageModelRule(modelId);
  if (resolution === "智能比例") return rule.defaultResolution;
  return rule.resolutions.includes(resolution as ImageResolution) ? resolution as ImageResolution : rule.defaultResolution;
}

export function resolveImageSettingsForModel(modelId: string | undefined, settings?: { ratio?: string; resolution?: string }) {
  const rule = getImageModelRule(modelId);
  const isSmartRatio = !settings?.ratio || settings.ratio === "智能比例";
  const ratio = isSmartRatio ? "16:9" as const : normalizeImageRatio(settings?.ratio);

  return {
    ratio,
    resolution: isSmartRatio ? rule.defaultResolution : normalizeImageResolutionForModel(modelId, settings?.resolution),
  };
}

export function normalizeImageRatio(ratio?: string): ConcreteImageRatio {
  return ratio && ratio !== "智能比例" && ratio in imageRatioMap ? ratio as ConcreteImageRatio : "16:9";
}

export function getExpectedImageDimensions(modelId: string | undefined, resolution: string | undefined, ratio: string | undefined) {
  const rule = getImageModelRule(modelId);
  const resolvedSettings = resolveImageSettingsForModel(modelId, { ratio, resolution });
  const safeResolution = resolvedSettings.resolution;
  const safeRatio = resolvedSettings.ratio;

  return rule.dimensions[safeResolution]?.[safeRatio] ?? { width: 0, height: 0 };
}

export function getImageQualityBadgeLabel(resolution?: string) {
  return resolution === "4K" ? "超清4K" : "";
}

export function getImageResolutionLabel(resolution: string) {
  return getImageQualityBadgeLabel(resolution) || `高清${resolution}`;
}

export type ModelName = string;

export function isModelName(value: unknown): value is ModelName {
  return typeof value === "string" && value.length > 0 && value.length < 120 && /^[a-zA-Z0-9~._:/-]+$/.test(value);
}
