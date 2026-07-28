export const GENERIC_MEDIA_ERROR_MESSAGE = "服务器繁忙，请稍候再试.....";

// ⭐ 模型「明文拒绝」的唯一权威文案与判定（2026-07-28 新增）。
// 场景：gpt-5.4-image-2 这类模型不报错、也不给图，而是直接回一段人话拒绝（中文"抱歉，我无法…"
// 或英文 "I can't help with that"）。以前这类要么落进"服务器繁忙"兜底桶、要么被下面的
// 版权/隐私规则抢走说成"参考图问题"（其实和参考图无关）。现在统一识别成"模型拒绝生成"，
// 并让前端据此把「AI 改写重试」入口亮出来（判定见 src/lib/gpt-image-safety-retry.ts）。
export const MODEL_REFUSED_MESSAGE = "模型拒绝生成本次内容（可能涉及安全、隐私、版权或未成年人等限制）！可点「AI改写重试」让 AI 安全改写后重试，也可自行修改提示词后重试。";

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

export function toUserErrorMessage(value: unknown, fallback = "请求失败，请稍后再试。") {
  const raw = typeof value === "string" ? value : value instanceof Error ? value.message : fallback;
  const errorCodePrefix = raw.match(/^\(B_\d+\)\s*/)?.[0] ?? "";
  const withErrorCode = (message: string) => `${errorCodePrefix}${message}`;
  const text = raw
    .replace(/^\(B_\d+\)\s*/, "")
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, " ")
    .replace(/\b(?:OpenRouter|BytePlus|ModelArk|OpenAI|Gemini|Google)\b\s*/gi, "")
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
  if (/tokens per min|\btpm\b|request too large for|rate limit|rate_limit|too many requests|请求太频繁/.test(lower)) return withErrorCode("图片服务当前繁忙（限流），请稍后重试。");
  if (/\b413\b|request entity too large|content too large|payload too large|too large/.test(lower)) return withErrorCode("请求内容太大，请减少参考图数量或换用更小的图片后重试。");
  if (/\b401\b|unauthorized|user not found|invalid api key|api key/.test(lower)) return withErrorCode("API Key 无效或已过期，请更新密钥后重试。");
  if (/\b403\b|not available in your region|region/.test(lower)) return withErrorCode("当前模型在你的地区不可用，请换一个模型后重试。");
  if (/\b429\b|rate limit|too many requests|quota/.test(lower)) return withErrorCode("请求太频繁或额度不足，请稍后再试。");
  if (/timeout|timed out|etimedout|aborted/.test(lower)) return withErrorCode("请求超时，请稍后重试。");
  if (/network|fetch failed|econnreset|enotfound|socket|curl|schannel|closed abruptly|close_notify|command failed/.test(lower)) return withErrorCode("网络连接异常，请稍后重试。");
  if (/maximum call stack size exceeded|call stack|rangeerror|typeerror|referenceerror/.test(lower)) return withErrorCode("任务失败，请联系管理员！");
  // gpt-image(OpenAI) 提示词被安全系统直接拒绝：请求阶段就被拒、未生成图（同一提示词有概率能过）。
  // OpenAI 只回缩写类别（如 sexu…），拿不到完整精确原因，把原文类别原样放进【】给用户参考。
  if (/rejected by the safety system|safety_violations|safety system/.test(lower)) {
    const violation = raw.match(/safety_violations=\[([^\]"]*)/i)?.[1]?.trim();
    return withErrorCode(
      violation
        ? `模型拒绝了本次生成请求，可能是因为提示词中包含了【${violation}】的原因！直接重试有可能会成功，修改提示词后成功率更高。`
        : "模型拒绝了本次生成请求，可能是提示词内容不符合平台安全策略！直接重试有可能会成功，修改提示词后成功率更高。",
    );
  }
  // ⭐ 模型「明文拒绝」：不报错、不给图，直接回一段人话拒绝（中文"抱歉，我无法…"/英文 "I can't help with…"）。
  // 必须放在下面的版权/隐私/敏感规则之前 —— 那几条会把拒绝原文里的"版权/隐私"字样误判成"参考图有问题"，
  // 而这类拒绝其实是提示词内容被模型自己挡下来了，正确出路是「AI 改写重试」。
  if (isModelRefusalText(text)) return withErrorCode(MODEL_REFUSED_MESSAGE);
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
