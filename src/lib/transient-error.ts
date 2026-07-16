// 统一判定：一个错误是不是"服务端/网络瞬时抖动"（值得服务端自动重试的"断线重连"类），
// 而不是"用户输入导致的永久失败"（真人/版权/参数/审核拒绝——重试没用，必须改输入）。
//
// 设计原则：
// - 只有明确属于"瞬时基础设施/网络/平台临时"的错误才判 true（自动重试）。
// - 未知错误一律判 false（当永久失败），避免把真实 bug 无限重试掩盖掉。
// - 真人/隐私/敏感/版权（moderation）判 false：这类走各自的 Skip 素材送审机制，
//   不属于本"断线重连"范畴；送审仍失败就是永久（用户要换素材）。

function toMessage(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value ?? "");
  } catch {
    return String(value ?? "");
  }
}

/** 永久失败（重试无意义）：审核拒绝、参数错误、鉴权、地区、模型拒绝/无输出等。 */
function isPermanentError(message: string): boolean {
  const lower = message.toLowerCase();
  // 审核 / moderation（真人·隐私·敏感·版权）——走送审机制，不属于断线重连
  if (/real person|privacy|privacyinformation|sensitive|copyright|真人|隐私|敏感|版权/.test(lower)) return true;
  // 参数 / 尺寸 / 比例 / 模型无效
  if (/invalid parameter|invalid option|unsupported size|not a valid model|aspect ratio must be between|not valid/.test(lower)) return true;
  // 鉴权 / 地区
  if (/\b401\b|unauthorized|invalid api key|\bapi key\b|\b403\b|not available in your region/.test(lower)) return true;
  // 模型拒绝生成 / 内容被过滤 / 无输出（GPT 拒绝类）
  if (/content.*filtered|filtered|no output|completed with no output|抱歉，我不能|没有返回图片|没有返回视频/.test(lower)) return true;
  return false;
}

/**
 * 是否为"服务端瞬时可恢复错误"——网络抖动、部署重启导致的短暂 5xx/网关错误、
 * 平台临时性错误（下载我们的素材失败、事务超时、素材尚未同步）、限流等。
 * 这类应由服务端自动退避重试（断线重连），用户无感。
 */
export function isTransientServerError(value: unknown): boolean {
  const message = toMessage(value);
  if (!message) return false;
  if (isPermanentError(message)) return false;
  const lower = message.toLowerCase();

  // 网络层
  if (/fetch failed|econnreset|etimedout|enotfound|eai_again|econnrefused|socket hang up|network|closed abruptly|close_notify/.test(lower)) return true;
  // 超时 / 中断
  if (/timeout|timed out|aborted/.test(lower)) return true;
  // HTTP 5xx / 网关（部署重启窗口的典型表现）
  if (/\b50[0-4]\b|bad gateway|gateway time-?out|service unavailable|internal server error|server error/.test(lower)) return true;
  // 平台临时性：抓不到我们的素材 url、写回客户端错误、事务无法开启、素材尚未同步
  if (/failed to download media|please check if the link is accessible|write to client error|transaction api error|unable to start a transaction|asset .*is not found|not found/.test(lower)) return true;
  // 限流（退避后重试）
  if (/\b429\b|rate limit|rate_limit|too many requests|请求太频繁|限流/.test(lower)) return true;
  // curl 传输层抖动（但 curl 未安装 ENOENT 属配置问题，不算瞬时）
  if (/schannel|command failed/.test(lower) && !/enoent|spawn\s+curl/.test(lower)) return true;

  return false;
}
