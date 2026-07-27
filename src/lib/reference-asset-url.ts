/**
 * 参考素材 url 归一化（唯一权威，服务端进模型/送审前必须过这一道）。
 *
 * 背景（2026-07-28 排查线上红字第 6 批）：正式服 18 条失败原文是
 * `Timeout/Error while downloading url: http://<ip>/api/media-thumbnail?url=%2Fgenerated%2F...`
 * —— 我们把「给人看的缩略图接口地址」当成参考图发给了平台（BytePlus）。
 * `/api/media-thumbnail` 是**动态接口**：平台每次来拉，我们的 Node 都要现场解析参数 + 用 sharp 现生成缩略图再返回，
 * 图大/并发高/跨境慢时平台等不到就超时 → 整个生成任务失败。
 * 参考图本来就应该给**文件本身的静态直链**（nginx 直出，不经过 Node）。
 *
 * 另外同一批数据里还带着**已退役的马来 IP `101.47.19.109`** 前缀（历史数据/历史 env 留下的绝对地址），
 * 那台机器早就不在链路里，平台拉它必然失败。所以自家主机的绝对地址一律剥成相对路径，
 * 由下游按当前环境重新拼 base（`toPublicAssetUrl` / `toPublicGeneratedImageUrl`）或直接读本地文件。
 *
 * 规则（幂等，可重复调用）：
 *  1. `data:` / `asset://` / 空值 → 原样返回（`asset://` 由 `resolveReferenceUrls` 负责解析）。
 *  2. 自家主机的绝对地址（含端口）→ 剥成相对路径。
 *  3. `/api/media-thumbnail?url=<原图>` → 取出 `url` 参数解码，**换成原图**（递归，防嵌套）。
 *  4. `/generated/...` → 去掉缓存版本号 query（`?v=thumb256-xxx`）和 `#` 片段。
 *  5. 其它（第三方 https 等）→ 原样返回。
 */

// 自家主机白名单（正式/阿里/腾讯/测试服/退役马来，允许带端口）。
const OWN_HOST_ABSOLUTE_RE = /^https?:\/\/(?:101\.47\.19\.109|101\.37\.129\.164|119\.28\.116\.16|main\.venusface\.com|api\.venusface\.com|ali\.venusface\.com|static\.venusface\.com|staging-static\.venusface\.com)(?::\d+)?(\/.*)$/i;

const MAX_UNWRAP_DEPTH = 3;

function stripOwnHost(url: string) {
  const match = url.match(OWN_HOST_ABSOLUTE_RE);
  return match ? match[1] : url;
}

// 从 `/api/media-thumbnail?url=<encoded>&v=xxx` 里取出真实原图路径；不是缩略图接口就返回 undefined。
function unwrapMediaThumbnailUrl(url: string): string | undefined {
  if (!url.startsWith("/api/media-thumbnail")) return undefined;
  const queryIndex = url.indexOf("?");
  if (queryIndex < 0) return undefined;
  try {
    const params = new URLSearchParams(url.slice(queryIndex + 1));
    const inner = params.get("url")?.trim();
    return inner || undefined;
  } catch {
    return undefined;
  }
}

function stripMediaVersionQuery(url: string) {
  if (!url.startsWith("/generated/")) return url;
  return url.split("#")[0].split("?")[0];
}

export function normalizeReferenceAssetUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  let url = value.trim();
  if (!url || url.startsWith("data:") || url.startsWith("asset://")) return url;

  for (let depth = 0; depth < MAX_UNWRAP_DEPTH; depth += 1) {
    const withoutHost = stripOwnHost(url);
    const inner = unwrapMediaThumbnailUrl(withoutHost);
    if (!inner) {
      url = withoutHost;
      break;
    }
    url = inner.trim();
  }

  return stripMediaVersionQuery(url);
}

/** 数组版：逐项归一化并丢掉空值。参考图/参考视频/参考音频统一走它。 */
export function normalizeReferenceAssetUrls(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values.map((value) => normalizeReferenceAssetUrl(value)).filter(Boolean);
}
