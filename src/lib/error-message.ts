export const GENERIC_MEDIA_ERROR_MESSAGE = "服务器繁忙，请稍候再试.....";

// ⭐ 模型「拒绝出图」的唯一权威文案与判定（2026-07-28 新增，07-29 改成"必带上游原文"）。
//
// 背景（两条链路给回来的东西完全不同，但根因是同一个）：
// · GPT版 `openai/gpt-5.4-image-2-agent`（老 /chat/completions 接口）：中间那层语言模型拿到图片模型的
//   拒绝信号后，会翻成一段中文人话还给我们（"抱歉，我不能帮助生成这个人物'没穿衣服'的图像。
//   如果你愿意，我可以改为…"）。⭐ 信息量最大——它往往直接把可用的安全改法列出来了。
// · 直连版 `openai/gpt-5.4-image-2`（新 /api/v1/images 接口）：OpenAI 直接 400，只回
//   `rejected by the safety system`（有时附 `safety_violations=[sexu…]`，有时连这个都没有）。
//
// ⛔ 以前的做法是把上游原话**整段丢掉**换成一句我们自己的统一文案 → 用户看不到模型到底嫌弃哪一点，
// 也拿不到模型给的改法。现在一律：统一文案 + **原样附上模型的拒绝原因**。
// ⛔⭐ 2026-07-29 用户拍板：这一类（模型拒绝 / 平台安全策略 / 版权限制）**全部统一成这一句**，
// 不再分"能不能 AI 改写"两种说法 —— 因为对话流和资产库的 AI 改写已经整体撤掉了（只剩工作流有），
// 而文案是全平台共用的，提"AI改写"会在没有这个入口的地方骗用户。
const MODEL_REFUSED_PREFIX = "模型因色情/暴力/隐私安全等原因拒绝出图";
const MODEL_REFUSED_HINT = "，你可以调整提示词或更换参考图后重试。";
// 拿不到任何上游原文时的兜底 = 统一那句去掉尾巴的原文部分。
export const MODEL_REFUSED_FALLBACK_MESSAGE = `${MODEL_REFUSED_PREFIX}${MODEL_REFUSED_HINT}`;
// ⚠️ 历史文案（v1.0.0.52 及以前产生的数据里还有），**只用于判定与后台归一化，禁止再拿它生成新文案**。
const LEGACY_MODEL_REFUSED_MESSAGES = [
  "模型拒绝了本次生成请求，可能是提示词内容不符合平台安全策略！直接重试有可能会成功，修改提示词后成功率更高。",
  "生成结果可能涉及版权限制，平台拒绝输出。你可以调整提示词、换参考图或重新生成。",
];
// 上游原文最多带这么长（红字要能看完，别糊满整屏）。
const MODEL_REFUSED_DETAIL_MAX_LENGTH = 260;

// ⭐⭐ 平台内容安全检测拒绝「参考素材」的唯一文案（2026-07-29 合并，2026-08-05 改成按素材类型精确对应）。
//
// 为什么要合并：以前这一个根因有两句话 ——
//   ① 精确规则（明确出现 input image/video + real person/copyright/sensitive）说「参考图未能通过平台审核…」
//   ② 宽松兜底（原文里只要有 sensitive/隐私/真人 字样）说「参考图可能包含真人或隐私敏感信息…」
// 但 ② 其实就是 ① 漏掉时的兜底，同一件事裂成两种说法，后台也会裂成两条原因。
//
// ⭐⭐ 2026-08-05 用户拍板：**"是什么没过就显示什么"** —— 上游原文里已经指名是
// `input image` / `input video` / `input audio`（或 `InputVideoSensitiveContentDetected` 这种带类型的错误码），
// 所以红字必须直接说**参考图片 / 参考视频 / 参考音频**，别再笼统说"参考素材"让用户猜该换哪个。
// 只有真的判不出类型时才回落"参考素材"。
//
// ⛔⛔ 三条改这句话时必须一起想到的事：
//   1. **别替平台编原因**（我写过「例如影视剧、动漫、综艺等片段」→ 用户当场否掉：那个被拒的素材实测
//      是 576×1024/10.3 秒的普通竖屏短片，跟影视剧毫无关系）。拿不到证据就只说"平台判定/检测"。
//   2. **"重试可能通过"是用户定的口径**，不是我随便写的：平台这个检测会误判、每次重新送审都是重新过一次审。
//      ⛔ 所以绝不许在链路上做「上次被拒过就不再送审」的缓存优化（我加过、当天撤了，见 video/route.ts 那段注释）。
//   3. ⭐ 一个根因裂成 4 种措辞 → **后台会炸成 4 行**。已在 `admin-failure-triage.ts` 的
//      `FAILURE_REASON_SQL` 里加了归一化把它们收回一条。**改这句的措辞必须同步改那条 SQL。**
export type ReferenceReviewMediaKind = "image" | "video" | "audio" | "unknown";

const REFERENCE_REVIEW_KIND_LABEL: Record<ReferenceReviewMediaKind, string> = {
  image: "图片",
  video: "视频",
  audio: "音频",
  unknown: "素材",
};

function buildReferenceReviewRejectedMessage(kind: ReferenceReviewMediaKind) {
  return `参考${REFERENCE_REVIEW_KIND_LABEL[kind]}没能通过平台的版权检测（可能涉及真人、隐私或版权），重试可能通过，但建议更换参考素材后再重试成功率更高。`;
}

/**
 * ⭐⭐ 判定「这条文案已经是我们自己映射好的『参考素材没过审』成品」（2026-08-06 加，修正式服 B_123）。
 *
 * ⛔ 为什么必须有：`toUserErrorMessage` 在「服务端映射一次 → 客户端再映射一次」的链路上会被跑两遍
 * （服务端 route 映射后写进 error message，客户端 `chat/chat-workbench-core.tsx` 又 `toUserErrorMessage`
 * 一次，工作流节点的 catch 还会再来一次）。而这句成品文案里带着「版权」两个字 →
 * 第二遍会命中下面那条**裸 `copyright|版权` 兜底** → 被重新包成
 * 「模型…拒绝出图…以下是模型返回的拒绝原因：“参考视频没能通过平台的版权检测…”」
 * —— **审核视频的问题被拼进了拒绝出图的文案里**，用户被指向完全错误的排查方向（去改提示词）。
 *
 * ⭐ 实测（37 种红字全跑一遍二次映射）：只有**参考视频 / 参考音频**这两条会串。
 * 「参考图片」侥幸没事，是因为精确规则里认「参考图」三个字，而「参考图片」正好含它 —— 纯属巧合。
 *
 * ⚠️ 只认「前缀 + 后缀」两头，中间的素材类型可变；⛔ 别拿整句去比（措辞以后还会调）。
 */
const REFERENCE_REVIEW_REJECTED_PATTERN = /^参考(?:图片|视频|音频|素材)没能通过平台的版权检测/;

export function isReferenceReviewRejectedMessage(value: string) {
  return REFERENCE_REVIEW_REJECTED_PATTERN.test(value);
}

/**
 * 从上游原文里判断「是哪一类参考素材没过审」。
 *
 * ⚠️ 只认 **input/参考** 侧的说法：`output image/video/audio` 那几路在上面已经各自 return 掉了，
 * 但万一以后有人调整规则顺序，这里也不能把成品那一路认成参考素材 → 一律要求带 input/参考/reference 语境。
 * 判不出来就返回 "unknown"（文案回落"参考素材"），⛔ 别瞎猜一个类型，猜错比笼统更糟。
 */
function detectReferenceReviewMediaKind(lower: string, text: string): ReferenceReviewMediaKind {
  // BytePlus 的带类型错误码：InputVideoSensitiveContentDetected / InputImageCopyright 等
  if (/input\s*video|inputvideo/.test(lower) || /参考视频/.test(text)) return "video";
  if (/input\s*audio|inputaudio/.test(lower) || /参考音频/.test(text)) return "audio";
  if (/input\s*image|inputimage/.test(lower) || /参考图片?/.test(text)) return "image";
  return "unknown";
}

// ⭐ 成品**图片**被平台判定含敏感内容（`OutputImageSensitiveContentDetected`）。
// 语义对齐"成品视频/音频被拒交付"那句：问题出在生成结果上，换参考素材没用，重试/改提示词才有用。
const OUTPUT_IMAGE_REJECTED_MESSAGE = "成品图片被平台判定含敏感内容而拒绝交付（不是参考素材的问题，换图没用）。可直接重试或修改提示词后重试。";

// ⭐ 供应商额度/余额相关的唯一文案（2026-07-29 收敛）：402、insufficient credits、
// insufficient_quota、裸 `quota`（配额用尽）全部走这一句 —— 它们都只能靠充值解决，用户重试无意义。
const PROVIDER_INSUFFICIENT_CREDITS_MESSAGE = "提供商余额不足！请联系管理员充值。";

// ⭐ 限流的唯一文案（2026-07-29 收敛）：TPM / rate limit / too many requests / 裸 429 全部走这一句。
// ⛔ 绝不能和上面那句混用 —— 限流时钱是够的，说"请联系管理员充值"会让用户白催一场。
const RATE_LIMITED_MESSAGE = "当前模型繁忙或被限流，请稍候再重试！";



// ⭐ 判定「这条失败文案是不是模型拒绝出图」只认这个前缀（文案后半段是可变的上游原文，不能拿整句去比）。
// 工作流的 gpt-image-safety-retry.ts 靠它决定要不要亮「AI改写重试」，改文案时**必须保持前缀不变**。
// 历史文案也要认，否则老数据在后台会被拆成一堆各 1 条。
export function isModelRefusedMessage(value: string) {
  return value.includes(MODEL_REFUSED_PREFIX) || LEGACY_MODEL_REFUSED_MESSAGES.some((legacy) => value.includes(legacy));
}

/**
 * ⭐ 上游拒绝原文的「中文说明」映射表（2026-07-30 加）。
 *
 * 为什么加：模型拒绝那句尾巴上贴的是平台原始报文，常常是一坨英文 JSON，例如
 * `{"error":{"code":"InputTextSensitiveContentDetected","message":"The request failed because
 * the input text may contain sensitive information.","param":"","type":""}}`
 * —— 普通用户完全看不懂，等于噪音。这里把**认识的 code** 翻成一句中文。
 *
 * ⛔ 两条硬规则：
 *  ① **不认识的一律原样保留**（返回原文）—— 宁可英文难看，也绝不能把信息丢掉，
 *     否则以后出新错误码时后台就成了瞎子。
 *  ② 顺序敏感：Output* 必须排在 Input* 之前判断吗？不需要——code 本身互斥，直接按字面匹配即可；
 *     但 `copyright` 这类**泛化关键词**必须放在最后，别把带具体 code 的抢走。
 *
 * ⚠️ 这里只改「”…”」里那段说明，`MODEL_REFUSED_PREFIX` 前缀纹丝不动
 * → 后台 `admin-failure-triage.ts` 的 `FAILURE_REASON_SQL` 不用改（它按前缀归一化）。
 */
const UPSTREAM_REFUSAL_DETAIL_DICTIONARY: Array<{ match: RegExp; text: string }> = [
  // —— 输入侧（我们发过去的东西被判定不合规）——
  { match: /inputtextsensitive/i, text: "输入的提示词文字被平台判定含敏感信息" },
  { match: /inputimagesensitive/i, text: "参考图被平台判定含敏感信息" },
  { match: /inputvideosensitive/i, text: "参考视频被平台判定含敏感信息" },
  { match: /inputaudiosensitive/i, text: "参考音频被平台判定含敏感信息" },
  { match: /inputimagecopyright|inputcopyright/i, text: "参考图被平台判定可能涉及版权限制" },
  // —— 输出侧（生成结果被判定不合规）——
  { match: /outputimagesensitive/i, text: "生成出来的图片被平台判定含敏感信息" },
  { match: /outputvideosensitive/i, text: "生成出来的视频被平台判定含敏感信息" },
  { match: /outputaudiosensitive/i, text: "生成出来的音频被平台判定含敏感信息" },
  // —— OpenAI / 通用安全策略 ——
  { match: /content[_\s-]?policy[_\s-]?violation/i, text: "内容不符合平台的安全策略" },
  { match: /safety\s*system|rejected by the safety/i, text: "被平台安全系统拒绝" },
  { match: /moderation[_\s-]?blocked/i, text: "被平台内容审核拦截" },
  // —— 泛化关键词兜底（必须放最后）——
  { match: /copyright/i, text: "被平台判定可能涉及版权限制" },
];

function describeUpstreamRefusalDetail(detail: string) {
  const matched = UPSTREAM_REFUSAL_DETAIL_DICTIONARY.find((item) => item.match.test(detail));
  // ⛔ 认识就翻成中文；不认识**原样返回**，绝不丢信息。
  return matched ? matched.text : detail;
}

function buildModelRefusedMessage(detail: string) {
  const trimmed = detail
    // 削掉我们自己包在外面的那层壳，只留模型真正说的话。
    .replace(/^(?:图片|视频)?平台没有返回(?:图片|视频)[：:]\s*/, "")
    .replace(/^(?:图片|视频)(?:生成)?失败[：:]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!trimmed) return MODEL_REFUSED_FALLBACK_MESSAGE;
  // 认识的平台错误码翻成中文说明；模型自己说的那段话（"抱歉，我不能…"）不会命中字典，原样保留。
  const described = describeUpstreamRefusalDetail(trimmed);
  const shown = described.length > MODEL_REFUSED_DETAIL_MAX_LENGTH ? `${described.slice(0, MODEL_REFUSED_DETAIL_MAX_LENGTH)}...` : described;
  return `${MODEL_REFUSED_PREFIX}${MODEL_REFUSED_HINT}以下是模型返回的拒绝原因：“${shown}”`;
}

// 只认"第一人称明确拒绝"这类高辨识度措辞，避免误吞普通报错里的"无法/失败"字样。
const MODEL_REFUSAL_PATTERNS = [
  /(?:很)?抱歉[，,、:：\s]*(?:但)?\s*(?:我|本模型|该模型)?\s*(?:不能|不可以|无法|不便|没办法)/,
  /(?:我|本模型|该模型)\s*(?:不能|不可以|不会|无法|没办法)\s*(?:帮(?:你|您|忙)?|协助|继续)?\s*(?:生成|创建|创作|制作|绘制|提供|完成|处理|画)/,
  /(?:不能|不可以|无法|不便)\s*(?:为(?:你|您)\s*)?(?:生成|创建|创作|制作|绘制|提供)\s*(?:这|该|此|这样|这类|此类|上述)/,
  /(?:该|此|这个|本次)?\s*(?:请求|提示词|内容)\s*(?:不符合|违反|涉及)\s*(?:我的|我们的)?\s*(?:使用政策|内容政策|内容策略|安全政策|安全策略)/,
  /i(?:'m|’m| am)\s+sorry[,.\s]*(?:but\s+)?i\s+(?:can'?t|cannot|won'?t)/i,
  /i\s+(?:can'?t|cannot|won'?t|am\s+unable\s+to|'m\s+unable\s+to|’m\s+unable\s+to)\s+(?:help|assist|create|generate|make|produce|provide|draw)/i,
  /i\s+(?:must|have\s+to|will)\s+decline/i,
  /(?:this|that|the)\s+request\s+(?:violates|doesn'?t\s+comply|does\s+not\s+comply)/i,
  /(?:against|violates)\s+(?:our|my)\s+(?:content\s+)?polic/i,
];

export function isModelRefusalText(value: string) {
  return MODEL_REFUSAL_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * ⭐ 「模型 200 但没出图、只回了一段文字」的唯一文案（2026-07-29 抽出，红字 A2）。
 *
 * 正式服 `image-provider-empty-result` 112 条里 **101 条**是这个形态：模型（GPT 版老
 * `/chat/completions` 接口）不报错也不拒绝，回来一段中文 —— 最常见是把**改写后的提示词**原样复读，
 * 例如「可直接用这版优化后的文生图提示词：**提示词：**…」。
 *
 * ⛔ 以前这段文字会被末尾的兜底透传**原样贴给用户当红字**（最多 500 字），
 * 用户看到的"报错"其实是自己那条提示词的改写版，完全不知道发生了什么；后台也裂成几十条各 1 条。
 *
 * ⚠️ 两个调用点共用这一份（`没有返回图片，模型只回了一段文字：` 的新形态 +
 * `图片平台没有返回图片：<文字>` 的老形态），**别再写第二种说法**。
 */
export function buildModelTextInsteadOfImageMessage(detail: string) {
  const shown = detail.replace(/\s+/g, " ").trim();
  const clipped = shown.length > MODEL_REFUSED_DETAIL_MAX_LENGTH ? `${shown.slice(0, MODEL_REFUSED_DETAIL_MAX_LENGTH)}...` : shown;
  return clipped
    ? `模型这次没有出图，只回了一段文字（不是报错），直接重试有可能会成功。以下是模型返回的内容：“${clipped}”`
    : "模型这次没有出图，只回了一段文字（不是报错），直接重试有可能会成功。";
}

// options.model：保留入参（很多调用点在传，且以后可能按模型分文案），但**当前不再影响文案** ——
// 2026-07-29 起模型拒绝类统一一句话，不再区分"能不能 AI 改写"。
export function toUserErrorMessage(value: unknown, fallback = "请求失败，请稍后再试。", options?: { model?: string }) {
  void options;
  const raw = typeof value === "string" ? value : value instanceof Error ? value.message : fallback;
  const errorCodePrefix = raw.match(/^\(B_\d+\)\s*/)?.[0] ?? "";
  const withErrorCode = (message: string) => `${errorCodePrefix}${message}`;
  const text = raw
    .replace(/^\(B_\d+\)\s*/, "")
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, " ")
    // 脱敏供应商名，但**不能削域名**：以前 \bOpenAI\b 把 `help.openai.com` 削成了 `help..com`。
    .replace(/(?<![.\w])(?:OpenRouter|BytePlus|ModelArk|OpenAI|Gemini|Google)(?![.\w])\s*/gi, "")
    .replace(/^(?:图片|视频)?(?:平台|模型|供应商)?(?:图片|视频)?(?:生成|任务|请求)?失败[：:]\s*/i, "")
    .replace(/\bRequest\s*id\s*:\s*[0-9a-f]+/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\bfinish_reason\s*:\s*\w+/gi, " ")
    .replace(/\bnative_finish_reason\s*:\s*\w+/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^[：:；;，,\s]+|[：:；;，,\s]+$/g, "")
    .trim();
  const lower = text.toLowerCase();

  if (!text) return withErrorCode(fallback);
  // ⭐ 幂等保护：如果传进来的已经是我们自己映射好的成品文案，原样返回。
  // 为什么必须有：这个函数在"服务端映射 → 前端再映射一次"的链路上可能被调用两次，而下面兜底的
  // 透传分支会把文案截到 180 字 → 会把我们刚附上的模型拒绝原文砍掉。（2026-07-29 加）
  // ⚠️ 这里每加一句，都必须是「我们自己映射出来的成品文案」；⛔ 别把上游原文塞进来。
  if (isModelRefusedMessage(text) || /^模型这次没有出图，只回了一段文字/.test(text) || isReferenceReviewRejectedMessage(text)) return withErrorCode(text);
  if (/system-reminder|operational mode|plan to build|read-only mode|file changes|shell commands/i.test(lower)) return withErrorCode(fallback);
  // ⭐ BytePlus「素材送审」阶段最常见的三类真实失败（以前全落到"服务器繁忙"，用户完全看不懂）：
  // 参考图尺寸不合规 / 平台抓不到我们的素材 / 我们记的审核凭证在平台侧已不存在。
  // 放在最前面判定，避免被后面的 timeout/network 等通用规则抢走。
  if (/(?:height|width) must be between \d+px and \d+px|expected the (?:height|width) to be (?:at least|at most|between)\s*\d+px/.test(lower)) return withErrorCode("参考图尺寸不符合平台要求（宽和高都需在 300–6000 像素之间），请换一张尺寸更合规的参考图后重试。");
  if (/failed to download media from the provided url|fetch-object/.test(lower)) return withErrorCode("平台读取参考图失败（素材地址临时不可用），请稍后重试。");
  if (/specified asset .*is not found|asset .* is not found/.test(lower)) return withErrorCode("参考图在平台上的审核凭证已失效，系统已自动清理并重新送审，请再点一次生成。");
  // ⭐ Kling（kwaivgi）参考图尺寸不合规的上游原文就一句 `Image pixel is invalid`，什么数都不给。
  // 它和 BytePlus 是同一个根因（Kling 官方同样要求 ≥300×300px、宽高比 1:2.5~2.5:1），
  // 但它是**异步**失败：任务先被收下、一两分钟后才 failed，以前全落到"服务器繁忙"。
  // （2026-07-28 查出正式服有用户拿 338×191 的截图连续失败 32 次。发送前拦截见 video-reference-image-rules。）
  if (/image pixel is invalid/.test(lower)) return withErrorCode("参考图尺寸不符合平台要求（宽和高都需不小于 300 像素，宽高比需在 0.4–2.5 之间），请换一张尺寸更合规的参考图后重试。");
  // ⭐ 某些模型「带参考图」时支持的时长比纯文生视频更少（如 Veo 3.1 的 reference_to_video 只允许 8 秒）。
  // 上游会明确给出可用时长列表，原样透出给用户，别再落到"服务器繁忙"。
  if (/unsupported output video duration/.test(lower)) {
    const supported = raw.match(/supported durations are \[([^\]]*)\]/i)?.[1]?.replace(/\s+/g, "");
    return withErrorCode(
      supported
        ? `当前模型在使用参考图时只支持 ${supported.split(",").filter(Boolean).join(" / ")} 秒的视频时长，请改成这个时长后重试。`
        : "当前模型不支持你选择的视频时长，请换一个时长后重试。",
    );
  }
  // ⭐ 供应商账户余额不足（OpenRouter 402 `Insufficient credits`、OpenAI `insufficient_quota` 等）：
  // 以前落到"服务器繁忙"，用户以为是我们抖动、会一直重试白花时间。必须说真话让用户来催管理员充值。
  // 放在限流/额度规则之前，避免被 `quota` 那条抢走。
  if (/\b402\b|insufficient credits|insufficient_quota|insufficient balance|requires more credits|more credits, or fewer max_tokens|add more using|billing hard limit|exceeded your current quota|account balance|余额不足/.test(lower)) return withErrorCode(PROVIDER_INSUFFICIENT_CREDITS_MESSAGE);
  // ⭐ 限流：常见原文是 OpenRouter 转来的 `OpenAI was rate limited by Cloudflare (error code: 1015)`
  // —— 限速发生在**上游供应商到模型厂商**那一跳，不是我们的服务忙、也不是用户点太快。
  // 我们已经自动重试过几次才会走到这里（见 transient-error.ts）。
  if (/tokens per min|\btpm\b|request too large for|rate limit|rate_limit|too many requests|请求太频繁/.test(lower)) return withErrorCode(RATE_LIMITED_MESSAGE);
  if (/\b413\b|request entity too large|content too large|payload too large|too large/.test(lower)) return withErrorCode("请求内容太大，请减少参考图数量或换用更小的图片后重试。");
  // ⭐ 2026-07-29 收紧（排 A3 时发现）：原来这条正则里有个**裸的 `api key`**，
  // 只要上游原文任何地方提到 "api key" 就判成「API Key 无效或已过期，请更新密钥后重试」。
  // 两个问题：
  //  ① 误伤面太大 —— 上游任何一句提到 api key 的说明性文字都会被当成"密钥失效"；
  //  ② 我们自己抛的 `缺少 BytePlus API Key` / `缺少 API Key`（= 服务端**根本没配**环境变量）
  //     也命中它，于是文案说"请更新密钥后重试"，而真相是"压根没配"，把人往错方向带。
  // 现在：先单独认出"我们自己没配"，再用精确特征判"平台说密钥无效"。
  if (/缺少\s*(byteplus\s*)?api key|missing api key|api key is not configured/.test(lower)) return withErrorCode("服务端没有配置该模型的接口密钥，请联系管理员处理。");
  if (/\b401\b|unauthorized|user not found|invalid api key|invalid_api_key|incorrect api key|api key expired|无效的?\s*api\s*key/.test(lower)) return withErrorCode("API Key 无效或已过期，请更新密钥后重试。");
  if (/\b403\b|not available in your region|region/.test(lower)) return withErrorCode("当前模型在你的地区不可用，请换一个模型后重试。");
  // ⭐ 2026-07-29 拆掉原来的「请求太频繁或额度不足，请稍后再试。」——那句把两个根本不同的东西糊在一起：
  //   · 裸 `429` / too many requests = **纯限流**，等一会儿就好 → 走上面同一句限流文案（RATE_LIMITED_MESSAGE）
  //   · 裸 `quota` = **配额/额度用尽**，跟"余额不足"是一回事 → 走同一句「联系管理员充值」
  // ⛔ 千万不能把 429 也说成"余额不足、请联系管理员充值"：钱是够的，用户会白催一场。
  // ⚠️ 顺序上 `rate limit / too many requests / tpm` 已被上面那条先吃掉，这里只是兜住漏网的裸码。
  if (/\b429\b|too many requests/.test(lower)) return withErrorCode(RATE_LIMITED_MESSAGE);
  if (/\bquota\b|配额/.test(lower)) return withErrorCode(PROVIDER_INSUFFICIENT_CREDITS_MESSAGE);

  if (/timeout|timed out|etimedout|aborted/.test(lower)) return withErrorCode("请求超时，请稍后重试。");
  // ⭐ 2026-07-29 新增（排 A7 时发现）：**服务端环境/子进程**问题必须单独说清楚，绝不能混进"网络连接异常"。
  //
  // ⛔ 以前 `curl` 和 `command failed` 都塞在下面那条网络正则里，后果是：
  //  · `spawn curl ENOENT`（= 容器里**根本没装 curl**，2026-07-14 真实发生过 4 条）被说成「网络连接异常，请稍后重试」
  //    → 用户白等白重试；我们在后台也只看到"网络问题"，**完全发现不了是部署少装了个程序**。
  //    那个坑一直埋到 2026-07-29 翻日志才发现（curl 后来已装进 Dockerfile，零复发）。
  //  · `Command failed: /app/node_modules/ffmpeg-static/ffmpeg …`（转码失败）同样被说成网络问题。
  //
  // 这类错误的共同点：**是我们自己要修的**（缺二进制/权限/磁盘/转码），跟网络和用户都无关，
  // 所以必须给一句诚实、且**不诱导用户重试**的话，同时保证它在后台是独立可见的一条原因、不被埋进兜底桶。
  //
  // ⚠️ 排除项：`Command failed: curl … curl: (7) Failed to connect` 这种**子进程跑起来了、失败在网络**的，
  // 要放给下面的网络规则，别误报成环境问题 —— 靠 `curl: (数字)` 这个 curl 自己的错误码格式区分。
  const missingBinary = /\bspawn\s+\S+\s+enoent|\benoent\b/.test(lower);
  const subprocessFailed = /command failed/.test(lower) && !/curl:\s*\(\d+\)/.test(lower);
  if (missingBinary || subprocessFailed) return withErrorCode("服务端环境异常，请联系管理员处理。");
  if (/network|fetch failed|econnreset|enotfound|socket|curl|schannel|closed abruptly|close_notify/.test(lower)) return withErrorCode("网络连接异常，请稍后重试。");
  if (/maximum call stack size exceeded|call stack|rangeerror|typeerror|referenceerror/.test(lower)) return withErrorCode("任务失败，请联系管理员！");
  // ⭐ 模型拒绝出图 —— 两条链路合并成同一条规则，都必须把上游原话带给用户（见文件顶部注释）。
  // A) 直连版（新 /images 接口）：OpenAI 直接 400 `rejected by the safety system`。
  //    优先取 `safety_violations=[sexu…]` 里的类别（最精确），没有就取那句英文，
  //    并把 "If you believe this is an error, contact us at …" 这种客服尾巴削掉（对用户没用）。
  if (/rejected by the safety system|safety_violations|safety system/.test(lower)) {
    const violation = raw.match(/safety_violations=\[([^\]"]*)/i)?.[1]?.trim();
    const englishReason = text
      .replace(/if you believe this is an error[\s\S]*$/i, "")
      .replace(/\bcontact us at[\s\S]*$/i, "")
      .trim();
    return withErrorCode(buildModelRefusedMessage(violation || englishReason));
  }
  // B) GPT版（老 /chat/completions 接口）：中间那层语言模型回了一段中文人话拒绝。
  //    必须放在下面的版权/隐私/敏感规则之前 —— 那几条会把拒绝原文里的"版权/隐私"字样误判成
  //    "参考图有问题"，而这类拒绝其实是提示词内容被模型自己挡下来了。
  if (isModelRefusalText(text)) return withErrorCode(buildModelRefusedMessage(text));
  // C) 模型既没报错、也没拒绝，只回了一段文字就是不给图（常见是把提示词原样复读回来，
  //    或说"你的要求前后矛盾"）。⛔ 以前把这段直接当报错贴出去 → 用户看到的红字是自己的提示词。
  if (/没有返回(?:图片|视频)，模型只回了一段文字/.test(text)) {
    return withErrorCode(buildModelTextInsteadOfImageMessage(text.replace(/^[\s\S]*?模型只回了一段文字[：:]\s*/, "")));
  }
  // ⭐ A1（2026-07-29 加）：OpenAI 说我们送去的参考图读不了。
  // 线上真实原文：`Invalid image file or mode for image 1, please check your image file.`
  // ⛔ 以前纯英文 → 直接落兜底桶（「服务器繁忙」/「请求失败」），用户只会一遍遍重试，永远好不了
  //    （正式服那 6 条就是同一个用户在 2 分钟里连点了 6 次，每次都同一句"服务器繁忙"）。
  // ⭐ 真根因已查清并**已修**：那张图**本身完全正常**（baseline JPEG / 8bit / 3 分量 YCbCr / 3072×4096），
  //    问题是 **4.24MB 原图我们该压没压**（`jpegNeedsReencode` 只看格式、不看体积）。
  //    现在上传时超过 2MB 会按 90% 质量原地压一遍（不动像素尺寸），见 `local-assets.ts`
  //    的 `compressOversizedUploadJpeg` + `image-upload-validation.ts` 的两个常量。
  // ⚠️ 这条文案仍然保留：历史已存的大图、以及第三方 https 参考图（不经过我们的上传压缩）还会触发。
  //    句式对齐 B13/B15（都是"参考图不合平台要求 + 怎么换"）。
  if (/invalid image file(?:\s+or\s+mode)?|please check your image file/.test(lower)) return withErrorCode("参考图不符合平台要求，模型读不出这张图。请换一张体积更小的参考图（建议 2MB 以内）后重试。");
  // ⭐ A4（2026-07-29 加）：我们**自己**的数据库连接池被占满。
  // 原文 `Transaction API error: Unable to start a transaction in the given time.`
  // 纯英文 → 以前落兜底桶「服务器繁忙」，跟"上游抖动"混在一起，后台根本看不出是我们自家 DB 的问题。
  // ⚠️ 它已被 `isTransientServerError` 判为可重试（会自动重试），能走到用户面前说明重试也没抢到连接。
  // 现在的池子是 Prisma 默认值（8 核 → connection_limit=17、pool_timeout=10s，DATABASE_URL 没显式配）。
  // 线上最后一次发生 2026-07-17，之后零复发；**若再变多，解法是给 DATABASE_URL 加 connection_limit**。
  if (/unable to start a transaction|transaction api error|transaction already closed/.test(lower)) return withErrorCode("服务端数据库繁忙（连接池已满），请稍后重试。");
  // 输出审核未过（轮询阶段）：参考图已过审、视频已生成，但成品视频/音频被平台拒绝交付
  if (/output\s+(?:video|audio).*(sensitive|copyright|copyright restrictions|related to copyright)|audio.*sensitive information|输出(?:视频|音频).*(敏感|版权)|参考图已过审|成品(?:视频|音频).*(?:敏感|版权)/.test(lower)) return withErrorCode("参考图已过审、视频也已生成，但成品视频/音频因版权或敏感内容被平台拒绝交付。可直接重试或修改提示词重试；若是音频问题，在提示词中明确“去除背景音乐/不要原声”可提高成功率。");
  // ⭐ 成品**图片**被判敏感（`OutputImageSensitiveContentDetected`）：跟参考素材一点关系没有！
  // ⛔ 以前没有这条规则 → 掉进下面那条宽松的 sensitive 兜底 → 红字说"参考图可能包含真人"，
  //    用户去换参考图换一万张都没用（2026-07-29 在正式服捞到真实原文，确认是错怪）。
  //    上面 155 那条只管成品"视频/音频"，图片这一路是漏的。
  if (/output\s*image.*(sensitive|privacy|copyright)|outputimagesensitive/.test(lower) || /(?:成品|输出)图片?.*(敏感|版权)/.test(text)) return withErrorCode(OUTPUT_IMAGE_REJECTED_MESSAGE);
  // ⭐⭐ 输入**提示词文本**被平台判敏感（`InputTextSensitiveContentDetected`）：跟参考素材毫无关系！
  // ⛔ 以前没有这条规则 → 原文里带 `sensitive` → 掉进最下面那条宽松兜底 → 红字说"参考素材未能通过平台审核、
  //    建议更换参考素材"，用户会把参考图换一万张也没用，真正该改的是**提示词**（2026-07-30 本地 workflow_04
  //    实测捞到原文确认：`The request failed because the input text may contain sensitive information`）。
  //    这和上面「成品图片被判敏感」是同一类病：缺精确规则 → 被兜底错怪参考图。
  // ⭐ 归到统一那句「模型拒绝」（AGENTS 铁律：模型拒绝／平台安全策略／版权限制三类合并成唯一一句，
  //    该句already同时提示"调整提示词或更换参考图"，且复用现成文案 → 后台 FAILURE_REASON_SQL 一行都不用改）。
  if (/inputtextsensitive|input text.*(sensitive|敏感)|输入文本.*敏感/.test(lower)) return withErrorCode(buildModelRefusedMessage(text));
  // ⭐⭐ 2026-08-05 起：**这里不再区分"版权"还是"敏感"**，两者共用同一句（用户口径），
  // 唯一的区别是把**素材类型**填准（图片/视频/音频）。所以原来那条单独的"input video 版权"精确规则
  // 已经删掉 —— 它做的事现在由 detectReferenceReviewMediaKind 统一完成，少一条规则少一个抢匹配的坑。
  // 输入/参考素材审核未过（送审被拒或创建阶段直接被拒）。⭐ 与下面那条宽松 sensitive 兜底
  // **共用同一句文案**（2026-07-29 合并）：它们本来就是同一个根因（平台内容安全检测拒绝素材），
  // 只是一条是精确规则、一条是兜底规则，分成两种说法只会让同一件事在后台裂成两条。
  // ⚠️ 这里的 `input` 三类必须写齐 image|video|audio：漏掉 audio 会让「参考音频被版权拒」掉进下面
  // 那条裸 `copyright` 兜底、被说成"模型拒绝"（2026-08-05 v73 部署前的回归用例抓到，当时只写了 image|video）。
  if (/reference-review-failed/.test(lower) || /input\s+(?:image|video|audio).*(real person|copyright|copyright restrictions|related to copyright|sensitive|privacy|privacyinformation)/.test(lower) || /(input image|reference|asset|素材|参考图|审核).*(copyright|copyright restrictions|related to copyright|版权|真人|隐私|sensitive|privacy)/.test(lower) || /审核图片可能涉及版权限制|参考图.*(版权|真人|隐私)|素材.*(版权|真人|隐私)/.test(text)) return withErrorCode(buildReferenceReviewRejectedMessage(detectReferenceReviewMediaKind(lower, text)));
  if (/completed with no output|no output|content may have been filtered|content.*filtered|filtered/.test(lower) || /已完成.*没有返回视频|没有返回视频地址/.test(text)) return withErrorCode("输出视频被平台过滤，未返回视频。重新生成有可能会成功。");
  // ⭐ 2026-07-29：原来这里是「生成结果可能涉及版权限制，平台拒绝输出。…」，与"模型拒绝"是一个意思，
  // 按用户要求**合并进统一那句**（并附上上游原文），不再单独存在。
  if (/copyright|copyright restrictions|related to copyright|版权/.test(lower)) return withErrorCode(buildModelRefusedMessage(text));
  // ⭐ 宽松兜底：原文里只要出现敏感/隐私/真人字样就落这里。与上面那条精确规则**共用同一句**
  // （2026-07-29 合并，见上面注释）。⚠️ 成品图片那一路已在前面单独拦掉，不会再被这条错怪。
  if (/sensitive|privacyinformation|real person|privacy|真人|隐私|敏感/.test(lower)) return withErrorCode(buildReferenceReviewRejectedMessage(detectReferenceReviewMediaKind(lower, text)));
  if (/aspect ratio must be between/.test(lower)) return withErrorCode("参考图太窄或太长了，当前视频模型无法使用。请换一张比例更接近常规尺寸（如 16:9、9:16、1:1、4:3）的参考图后重试。");
  // ⭐ 平台返回的不是 JSON 而是 HTML 错误页/网关页（`Unexpected token '<' … is not valid JSON`）：
  // 这是网关/CDN 抖动，不是参数问题。必须放在下面 `not valid` 规则之前，否则会被误报成
  // "当前模型不支持这组参数，请换比例、分辨率"，用户按提示去改参数完全没用（2026-07-28 实测 2 条）。
  if (/unexpected token '<'|is not valid json|unexpected end of json input|<!doctype html|<html/.test(lower)) return withErrorCode("平台服务临时异常（返回了非预期内容），请稍后重试。");
  if (/unsupported size|invalid option|invalid parameter|not valid/.test(lower)) return withErrorCode("当前模型不支持这组参数，请换比例、分辨率或模型后重试。");

  // 上游因某个参数不被支持而拒绝（如 gpt background:"transparent" 被拒、参考图数量/分辨率超限等）。
  if (/no provider for|not supported\. accepted|unsupported parameter|requested parameter|does not support the requested/.test(lower)) return withErrorCode("当前模型不支持所请求的参数（如透明背景、该分辨率或参考图数量），请更换模型或调整参数后重试。");
  if (/internal server error|server error|\b500\b/.test(lower)) return withErrorCode("平台服务临时异常，请稍后重试。");
  // ⭐ 上游网关/CDN 抖动的两种常见原文（2026-07-28 在正式服实测到）：
  // `error code: 520`（Cloudflare 5xx）、`Provider returned an empty response`（OpenRouter 上游空响应）。
  // 以前这两种被包在"图片平台没有返回图片：xxx"里，用户以为是模型不肯画，其实换一次就好了。
  if (/error code:\s*5\d\d|provider returned an empty response|empty response from provider/.test(lower)) return withErrorCode("平台服务临时异常，请稍后重试。");
  if (/no endpoints found/.test(lower)) return withErrorCode("当前模型不支持这类输出方式，请换一个模型后重试。");
  if (/没有返回图片/.test(text) && /没有返回可用原因|没有返回可用的原因|没有可用原因|没有返回原因|且没有/.test(text)) return withErrorCode(fallback);
  // ⭐⭐ A2（2026-07-29 加）：`图片平台没有返回图片：<一段文字>` 这个**老形态**的收口。
  // 走到这里已经排除掉了：模型明文拒绝（上面 isModelRefusalText）、网关抖动 520/空响应、
  // 以及"连原因都没给"（上一条）→ 剩下的必然是「模型回了文字当结果」，跟上面 C) 是同一件事，
  // 所以复用同一句文案（`buildModelTextInsteadOfImageMessage`）。
  // ⛔ 不加这条的后果（线上正在发生）：落到本函数末尾的兜底透传，把模型那段中文提示词
  //    **原样当红字贴给用户**（最多 500 字）。101 条里绝大多数就是这样。
  const emptyImageDetail = text.match(/没有返回图片[：:]\s*([\s\S]+)$/)?.[1];
  if (emptyImageDetail) return withErrorCode(buildModelTextInsteadOfImageMessage(emptyImageDetail));

  if (/[{}<>]|\bhtml\b|\bbody\b|\bhead\b|\btrace\b|\bstack\b/i.test(text)) return withErrorCode(fallback);
  if (!/[\u4e00-\u9fff]/.test(text)) return withErrorCode(fallback);
  const maxLength = /没有返回图片/.test(text) ? 500 : 180;
  return withErrorCode(text.length > maxLength ? `${text.slice(0, maxLength)}...` : text);
}

export function isGenericMediaErrorMessage(message: string, fallback = GENERIC_MEDIA_ERROR_MESSAGE) {
  return message === fallback || [
    "请求失败，请稍后再试。",
    "图片生成失败，请稍后再试。",
    "视频生成失败，请稍后再试。",
    "请求超时，请稍后重试。",
    "网络连接异常，请稍后重试。",
    "平台服务临时异常，请稍后重试。",
    "任务失败，请联系管理员！",
  ].includes(message);
}
