import { isSeedance20FamilyVideoModel, SEEDANCE_20_FAMILY_MODEL_ID, type UploadRuleMode } from "@/lib/upload-rules";
import { isFishAudioModel, SEEDANCE_25_VIDEO_MODEL_ID } from "@/lib/models";

export const FISH_AUDIO_S21_PROMPT_KEY = "fish-audio:s2.1";

/**
 * 「提示词字数上限」按模型配置 —— 唯一权威。
 *
 * 背景（2026-08-09 用户拍板）：不同模型上游能吃的提示词长度其实不一样，
 * 所以后台「上传规则」页在「文件」列**前面**多一列「文字」，由管理员自己按模型填数字。
 * 默认全部 2000（= 历史上写死的那个值），开关默认**开着**。
 *
 * ⭐⭐ 三条设计约定（改这个文件前先读）：
 * 1. **一个模型只有一个开关**：key **故意不看 `videoReferenceMode`** ——
 *    像 Seedance 2.0 那种有融合 / 首帧 / 首尾帧好几个模式的，后台只在**第一行（融合模式）**露出
 *    「文字」输入框，其余模式行显示「跟随」，运行时自动取同一个值。
 *    ⛔ 别为了"更精细"给每个模式各配一条，提示词长度跟参考模式没关系。
 * 2. **和上传数量是两套 override**（`UPLOAD_RULE_OVERRIDES` vs `PROMPT_LENGTH_OVERRIDES`）：
 *    上传数量的 key 里带模式（融合/首帧各一条），文字长度的 key 只有模型 —— 两者粒度不同，
 *    ⛔ 硬塞进同一个 map 会让「一个模型一个开关」这条要求做不出来。
 * 3. **对话模型统一一条**（key `"chat"`，与上传规则那张表的第一行口径一致）。
 */
export const DEFAULT_PROMPT_MAX_LENGTH = 2000;

/**
 * 「按模型的默认字数」——后台没配过时用它（面板里显示的也是它）。
 * ⭐ 2026-08-10 用户拍板的产品端限制（依据是当天逐个模型实测的上游真实上限，桌面
 *   `模型提示词字数上限.md` 有完整对照表）。key 的算法见 `getPromptLengthOverrideKey`：
 *   对话/Agent/通用 → `"chat"`；BytePlus Seedance 2.0 系 → `SEEDANCE_20_FAMILY_MODEL_ID`；其余 → 模型 id。
 * ⛔ 这里放的是**默认值**，不是硬上限：管理员在后台填的数字优先。
 * ⛔ 加新模型的默认值就改这一张表，别在组件里写死数字。
 * ⚠️ Kling 三个上游硬上限只有 2500，产品端限 2000（= 全局默认），别往上加超过 2500。
 */
const MODEL_DEFAULT_PROMPT_MAX_LENGTH: Record<string, number> = {
  // 对话模型（全部统一一条）
  chat: 20000,
  // 图片模型
  "byteplus:conversation-image.seedream-4-5": 5000, // Seedream 4.5
  "byteplus:conversation-image.seedream-5-0": 5000, // Seedream 5.0 Lite
  "byteplus:conversation-image.seedream-5-0-pro": 5000, // Seedream 5.0 Pro
  "bytedance-seed/seedream-4.5": 5000, // Seedream 4.5（OpenRouter 通道）
  "google/gemini-3.1-flash-image-preview": 8000, // Gemini 3.1 Flash Image
  "google/gemini-3-pro-image-preview": 8000, // Gemini 3 Pro Image
  "openai/gpt-5.4-image-2": 8000, // GPT-5.4 Image 2
  "openai/gpt-5.4-image-2-agent": 8000, // GPT-5.4 Image 2（GPT 版）
  // Recraft V4.1 / Pro：⭐ 2026-08-19 实测上游硬上限 = 10000 字
  //（发 20000 直接 400「prompt length should be in [1, 10000]」，5000 能正常出图）。
  // 产品端沿用全局默认 2000（Recraft 本身主打"短词出图"）；要放宽后台改就行，⛔ 别超过 10000。
  "recraft/recraft-v4.1": 2000,
  "recraft/recraft-v4.1-pro": 2000,
  // 视频模型
  [SEEDANCE_20_FAMILY_MODEL_ID]: 4000, // Seedance 2.0 / Fast / Mini（共用一条 key）
  [SEEDANCE_25_VIDEO_MODEL_ID]: 15000, // Seedance 2.5
  "bytedance/seedance-2.0": 4000, // Seedance 2.0（OpenRouter 通道）
  "bytedance/seedance-2.0-fast": 4000, // Seedance 2.0 Fast（OpenRouter 通道）
  "minimax/hailuo-3": 4000, // MiniMax H3（海螺）
  "kwaivgi/kling-v3.0-std": 2000, // Kling v3.0 Standard（上游硬上限 2500）
  "kwaivgi/kling-v3.0-pro": 2000, // Kling v3.0 Pro（上游硬上限 2500）
  "kwaivgi/kling-video-o1": 2000, // Kling Video O1（上游硬上限 2500）
  "google/veo-3.1": 4000, // Veo 3.1
  // 语音模型：默认 = 文档/官方硬上限的一半（2026-08-24）
  // MiniMax Speech 2.8 HD：T2A v2 官方「Must be less than 10,000 characters」
  "minimax/speech-2.8-hd": 5000,
  // Qwen-Audio-3.0-TTS Plus：DashScope CosyVoice/Qwen-Audio-TTS 单次常见上限 20000 字
  "qwen/qwen-audio-3.0-tts-plus": 10000,
  // Fish S2.1 Pro / 免费：同一代、字数一样，共用一条
  [FISH_AUDIO_S21_PROMPT_KEY]: 5000,
};

/** 后台可填的绝对上限（防手滑输入天文数字把浏览器/上游打挂）。 */
export const PROMPT_MAX_LENGTH_CEILING = 99999;

export type PromptLengthOverride = {
  enabled: boolean;
  maxLength: number;
};

export type PromptLengthOverrides = Record<string, PromptLengthOverride>;

export type PromptLengthContext = {
  mode: UploadRuleMode;
  modelId?: string;
};

/**
 * override key = **模型粒度**（⛔ 不含参考模式）。
 * - 对话/通用模式统一成 `"chat"`，与 `getUploadRuleOverrideKey` 对齐。
 * - ⭐ BytePlus Seedance **2.0 / Fast / Mini 共用一条**（同一代、能力一致，后台面板本来就是一行）；
 *   ⛔ **2.5 必须独立**（它是新一代，共用会让新模型被老模型的配置暗中支配 —— 见 `AGENTS.md` 那条铁律）。
 */
export function getPromptLengthOverrideKey(context: PromptLengthContext): string {
  if (context.mode === "agent" || context.mode === "general") return "chat";
  if (context.mode === "video" && isSeedance20FamilyVideoModel(context.modelId)) return SEEDANCE_20_FAMILY_MODEL_ID;
  if (isFishAudioModel(context.modelId)) return FISH_AUDIO_S21_PROMPT_KEY;
  return context.modelId || context.mode;
}

export function normalizePromptMaxLength(value: unknown): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return DEFAULT_PROMPT_MAX_LENGTH;
  return Math.max(1, Math.min(PROMPT_MAX_LENGTH_CEILING, parsed));
}

/**
 * 该模型「没配过」时的默认字数（唯一权威）。
 * ⭐ 后台面板显示的默认值必须走它，⛔ 别在面板里另写一份，否则面板显示 2000、
 *   实际生效 14500，管理员一保存就把 2.5 静默砍到 2000（就是那条"共用 key"铁律的同款伤害）。
 */
export function getDefaultPromptMaxLength(context: PromptLengthContext): number {
  return MODEL_DEFAULT_PROMPT_MAX_LENGTH[getPromptLengthOverrideKey(context)] ?? DEFAULT_PROMPT_MAX_LENGTH;
}

/**
 * 取该模型当前生效的提示词字数上限。
 * 开关关掉 = 用该模型的默认值（和"没配过"完全一样），⛔ 不代表"不限字数"。
 */
export function getPromptMaxLength(context: PromptLengthContext, overrides?: PromptLengthOverrides): number {
  const override = overrides?.[getPromptLengthOverrideKey(context)];
  if (!override || !override.enabled) return getDefaultPromptMaxLength(context);
  return normalizePromptMaxLength(override.maxLength);
}

/**
 * ⭐⭐ 2026-08-09 用户拍板的口径：**超限不删字**（学即梦）。
 * 用户打字/粘贴都允许超出上限，字**全留在框里**让他自己删；超了只做三件事：
 * ① 输入框内右上角的计数器变红 ② 发送/生成按钮灰掉 + hover 说明原因 ③ 真按下去时红字提示并拦住。
 * ⛔ 别再在任何输入路径上 `slice(0, maxLength)` —— 静默删用户的字是最糟的体验。
 * ⛔ 老的「最多输入 N 字」两句文案（getPromptLengthTipText / getWorkflowPromptLengthTipText）
 *    已随之删除 —— 它们是"已被截断"的口吻，现在压根不会截断了。
 * ⭐ 只保留一个 `PROMPT_MAX_LENGTH_CEILING` 的**安全网**（防粘 50 万字把 contenteditable 和草稿存库搞崩）。
 */

/** 字数口径（唯一实现）：按 Unicode 码点数，emoji 算 1 个字。 */
export function countPromptLength(text: string): number {
  return Array.from(text).length;
}

/** 正好等于上限 = 不算超限。 */
export function isPromptOverLimit(text: string, maxLength: number): boolean {
  return countPromptLength(text) > maxLength;
}

/** 计数器文案（输入框内右上角那一行）。 */
export function formatPromptCounter(used: number, maxLength: number): string {
  return `${used} / ${maxLength}`;
}

/** 对话流 / 资产库：超限时的红字 + 发送按钮 hover 说明。 */
export function getPromptOverLimitTipText(used: number, maxLength: number): string {
  return `提示词已超过 ${maxLength} 字（当前 ${used} 字），请删减后再发送`;
}

/** 工作流：限制本身是「输入框 + 连接文本」合计，所以文案也要说清。 */
export function getWorkflowPromptOverLimitTipText(used: number, maxLength: number): string {
  return `输入框和连接文本合计已超过 ${maxLength} 字（当前 ${used} 字），请删减后再生成`;
}

/**
 * 发送/生成按钮被超字数灰掉时，鼠标悬浮显示的那句（**通用黑底提示框** `BlackHoverTooltip`）。
 * ⭐ 2026-08-09 用户拍板的措辞，⛔ 别改：只说"这个模型支持多少字"，不报当前字数（计数器上已经有了）。
 */
export function getPromptLimitTooltipText(maxLength: number): string {
  return `当前模型提示词只支持${maxLength}字！`;
}

/** 安全网被触发时的提示（正常用户永远看不到这一句）。 */
export function getPromptCeilingTipText(): string {
  return `提示词已达到系统上限 ${PROMPT_MAX_LENGTH_CEILING} 字，多余内容未被保留`;
}
