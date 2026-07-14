export const GENERIC_MEDIA_ERROR_MESSAGE = "服务器繁忙，请稍候再试.....";

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
  if (/tokens per min|\btpm\b|request too large for|rate limit|rate_limit|too many requests|请求太频繁/.test(lower)) return withErrorCode("图片服务当前繁忙（限流），请稍后重试。");
  if (/\b413\b|request entity too large|content too large|payload too large|too large/.test(lower)) return withErrorCode("请求内容太大，请减少参考图数量或换用更小的图片后重试。");
  if (/\b401\b|unauthorized|user not found|invalid api key|api key/.test(lower)) return withErrorCode("API Key 无效或已过期，请更新密钥后重试。");
  if (/\b403\b|not available in your region|region/.test(lower)) return withErrorCode("当前模型在你的地区不可用，请换一个模型后重试。");
  if (/\b429\b|rate limit|too many requests|quota/.test(lower)) return withErrorCode("请求太频繁或额度不足，请稍后再试。");
  if (/timeout|timed out|etimedout|aborted/.test(lower)) return withErrorCode("请求超时，请稍后重试。");
  if (/network|fetch failed|econnreset|enotfound|socket|curl|schannel|closed abruptly|close_notify|command failed/.test(lower)) return withErrorCode("网络连接异常，请稍后重试。");
  if (/maximum call stack size exceeded|call stack|rangeerror|typeerror|referenceerror/.test(lower)) return withErrorCode("任务失败，请联系管理员！");
  // 输出审核未过（轮询阶段）：参考图已过审、视频已生成，但成品视频/音频被平台拒绝交付
  if (/output\s+(?:video|audio).*(sensitive|copyright|copyright restrictions|related to copyright)|audio.*sensitive information|输出(?:视频|音频).*(敏感|版权)|参考图已过审|成品(?:视频|音频).*(?:敏感|版权)/.test(lower)) return withErrorCode("参考图已过审、视频也已生成，但成品视频/音频因版权或敏感内容被平台拒绝交付。可直接重试或修改提示词重试；若是音频问题，在提示词中明确“去除背景音乐/不要原声”可提高成功率。");
  // 输入/参考图审核未过（送审被拒或创建阶段直接被拒）
  if (/reference-review-failed/.test(lower) || /input\s+(?:image|video).*(real person|copyright|copyright restrictions|related to copyright|sensitive|privacy|privacyinformation)/.test(lower) || /(input image|reference|asset|素材|参考图|审核).*(copyright|copyright restrictions|related to copyright|版权|真人|隐私|sensitive|privacy)/.test(lower) || /审核图片可能涉及版权限制|参考图.*(版权|真人|隐私)|素材.*(版权|真人|隐私)/.test(text)) return withErrorCode("参考图未能通过平台审核（可能涉及真人、隐私或版权），可以重试，但建议更换参考图后再重试成功率更高。");
  if (/completed with no output|no output|content may have been filtered|content.*filtered|filtered/.test(lower) || /已完成.*没有返回视频|没有返回视频地址/.test(text)) return withErrorCode("输出视频被平台过滤，未返回视频。重新生成有可能会成功。");
  if (/copyright|copyright restrictions|related to copyright|版权/.test(lower)) return withErrorCode("生成结果可能涉及版权限制，平台拒绝输出。你可以调整提示词、换参考图或重新生成。");
  if (/sensitive|privacyinformation|real person|privacy|真人|隐私|敏感/.test(lower)) return withErrorCode("参考图可能包含真人或隐私敏感信息，平台拒绝生成。请换一张参考图后重试。");
  if (/unsupported size|invalid option|invalid parameter|not valid/.test(lower)) return withErrorCode("当前模型不支持这组参数，请换比例、分辨率或模型后重试。");
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
