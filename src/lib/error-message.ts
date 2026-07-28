import { modelSupportsPromptSafetyRewrite } from "@/lib/models";

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
const MODEL_REFUSED_PREFIX = "模型因色情/暴力/隐私安全等原因拒绝出图";
const MODEL_REFUSED_REWRITE_HINT = "，你可以调整提示词或由AI安全改写后重试，AI改写会尽量保留原意和参考图，但不保证一定成功。";
const MODEL_REFUSED_PLAIN_HINT = "，你可以调整提示词后重试。";
// 拿不到任何上游原文时的兜底（用户 2026-07-28 指定的唯一一句）。
export const MODEL_REFUSED_FALLBACK_MESSAGE = "模型拒绝了本次生成请求，可能是提示词内容不符合平台安全策略！直接重试有可能会成功，修改提示词后成功率更高。";
// 上游原文最多带这么长（红字要能看完，别糊满整屏）。
const MODEL_REFUSED_DETAIL_MAX_LENGTH = 260;

// ⭐ 判定「这条失败文案是不是模型拒绝出图」只认这个前缀（文案后半段是可变的上游原文，不能拿整句去比）。
// gpt-image-safety-retry.ts 靠它决定要不要亮「AI改写重试」，改文案时**必须保持前缀不变**。
export function isModelRefusedMessage(value: string) {
  return value.includes(MODEL_REFUSED_PREFIX) || value.includes(MODEL_REFUSED_FALLBACK_MESSAGE);
}

function buildModelRefusedMessage(detail: string, canRewrite: boolean) {
  const trimmed = detail
    // 削掉我们自己包在外面的那层壳，只留模型真正说的话。
    .replace(/^(?:图片|视频)?平台没有返回(?:图片|视频)[：:]\s*/, "")
    .replace(/^(?:图片|视频)(?:生成)?失败[：:]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!trimmed) return MODEL_REFUSED_FALLBACK_MESSAGE;
  const shown = trimmed.length > MODEL_REFUSED_DETAIL_MAX_LENGTH ? `${trimmed.slice(0, MODEL_REFUSED_DETAIL_MAX_LENGTH)}...` : trimmed;
  return `${MODEL_REFUSED_PREFIX}${canRewrite ? MODEL_REFUSED_REWRITE_HINT : MODEL_REFUSED_PLAIN_HINT}以下是模型返回的拒绝原因：“${shown}”`;
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

export function toUserErrorMessage(value: unknown, fallback = "请求失败，请稍后再试。", options?: { model?: string }) {
  const raw = typeof value === "string" ? value : value instanceof Error ? value.message : fallback;
  const errorCodePrefix = raw.match(/^\(B_\d+\)\s*/)?.[0] ?? "";
  const withErrorCode = (message: string) => `${errorCodePrefix}${message}`;
  // ⭐ 只有 gpt-5.4-image-2 两款接了「AI改写重试」，其它模型（含全部视频模型）不能在文案里承诺这个入口。
  const canRewrite = modelSupportsPromptSafetyRewrite(options?.model);
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
  if (isModelRefusedMessage(text) || /^模型这次没有出图，只回了一段文字/.test(text)) return withErrorCode(text);
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
  if (/\b402\b|insufficient credits|insufficient_quota|insufficient balance|requires more credits|more credits, or fewer max_tokens|add more using|billing hard limit|exceeded your current quota|account balance|余额不足/.test(lower)) return withErrorCode("提供商余额不足！请联系管理员充值。");
  // ⭐ 限流：常见原文是 OpenRouter 转来的 `OpenAI was rate limited by Cloudflare (error code: 1015)`
  // —— 限速发生在**上游供应商到模型厂商**那一跳，不是我们的服务忙、也不是用户点太快。
  // 我们已经自动重试过几次才会走到这里（见 transient-error.ts）。
  if (/tokens per min|\btpm\b|request too large for|rate limit|rate_limit|too many requests|请求太频繁/.test(lower)) return withErrorCode("当前模型繁忙或被限流，请稍候再重试！");
  if (/\b413\b|request entity too large|content too large|payload too large|too large/.test(lower)) return withErrorCode("请求内容太大，请减少参考图数量或换用更小的图片后重试。");
  if (/\b401\b|unauthorized|user not found|invalid api key|api key/.test(lower)) return withErrorCode("API Key 无效或已过期，请更新密钥后重试。");
  if (/\b403\b|not available in your region|region/.test(lower)) return withErrorCode("当前模型在你的地区不可用，请换一个模型后重试。");
  if (/\b429\b|rate limit|too many requests|quota/.test(lower)) return withErrorCode("请求太频繁或额度不足，请稍后再试。");
  if (/timeout|timed out|etimedout|aborted/.test(lower)) return withErrorCode("请求超时，请稍后重试。");
  if (/network|fetch failed|econnreset|enotfound|socket|curl|schannel|closed abruptly|close_notify|command failed/.test(lower)) return withErrorCode("网络连接异常，请稍后重试。");
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
    return withErrorCode(buildModelRefusedMessage(violation || englishReason, canRewrite));
  }
  // B) GPT版（老 /chat/completions 接口）：中间那层语言模型回了一段中文人话拒绝。
  //    必须放在下面的版权/隐私/敏感规则之前 —— 那几条会把拒绝原文里的"版权/隐私"字样误判成
  //    "参考图有问题"，而这类拒绝其实是提示词内容被模型自己挡下来了，正确出路是「AI 改写重试」。
  if (isModelRefusalText(text)) return withErrorCode(buildModelRefusedMessage(text, canRewrite));
  // C) 模型既没报错、也没拒绝，只回了一段文字就是不给图（常见是把提示词原样复读回来，
  //    或说"你的要求前后矛盾"）。⛔ 以前把这段直接当报错贴出去 → 用户看到的红字是自己的提示词。
  if (/没有返回(?:图片|视频)，模型只回了一段文字/.test(text)) {
    const detail = text.replace(/^[\s\S]*?模型只回了一段文字[：:]\s*/, "").replace(/\s+/g, " ").trim();
    const shown = detail.length > MODEL_REFUSED_DETAIL_MAX_LENGTH ? `${detail.slice(0, MODEL_REFUSED_DETAIL_MAX_LENGTH)}...` : detail;
    return withErrorCode(shown
      ? `模型这次没有出图，只回了一段文字（不是报错），直接重试有可能会成功。以下是模型返回的内容：“${shown}”`
      : "模型这次没有出图，只回了一段文字（不是报错），直接重试有可能会成功。");
  }
  // 输出审核未过（轮询阶段）：参考图已过审、视频已生成，但成品视频/音频被平台拒绝交付
  if (/output\s+(?:video|audio).*(sensitive|copyright|copyright restrictions|related to copyright)|audio.*sensitive information|输出(?:视频|音频).*(敏感|版权)|参考图已过审|成品(?:视频|音频).*(?:敏感|版权)/.test(lower)) return withErrorCode("参考图已过审、视频也已生成，但成品视频/音频因版权或敏感内容被平台拒绝交付。可直接重试或修改提示词重试；若是音频问题，在提示词中明确“去除背景音乐/不要原声”可提高成功率。");
  // 输入/参考图审核未过（送审被拒或创建阶段直接被拒）
  if (/reference-review-failed/.test(lower) || /input\s+(?:image|video).*(real person|copyright|copyright restrictions|related to copyright|sensitive|privacy|privacyinformation)/.test(lower) || /(input image|reference|asset|素材|参考图|审核).*(copyright|copyright restrictions|related to copyright|版权|真人|隐私|sensitive|privacy)/.test(lower) || /审核图片可能涉及版权限制|参考图.*(版权|真人|隐私)|素材.*(版权|真人|隐私)/.test(text)) return withErrorCode("参考图未能通过平台审核（可能涉及真人、隐私或版权），可以重试，但建议更换参考图后再重试成功率更高。");
  if (/completed with no output|no output|content may have been filtered|content.*filtered|filtered/.test(lower) || /已完成.*没有返回视频|没有返回视频地址/.test(text)) return withErrorCode("输出视频被平台过滤，未返回视频。重新生成有可能会成功。");
  if (/copyright|copyright restrictions|related to copyright|版权/.test(lower)) return withErrorCode("生成结果可能涉及版权限制，平台拒绝输出。你可以调整提示词、换参考图或重新生成。");
  if (/sensitive|privacyinformation|real person|privacy|真人|隐私|敏感/.test(lower)) return withErrorCode("参考图可能包含真人或隐私敏感信息，平台拒绝生成。请换一张参考图后重试。");
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
