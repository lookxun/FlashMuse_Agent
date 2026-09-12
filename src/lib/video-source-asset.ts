/**
 * 「用户给的源视频」→ 归属校验 + 真实时长，**唯一权威**（画质增强 / 深度动作捕捉共用）。
 *
 * ⛔⛔ 为什么必须有这个文件（2026-09-12 审计）：
 * `/api/video-enhance` 和 `/api/video-depth` 这两条链路的**扣费依据就是源视频时长**
 * （上游 MediaKit / RunningHub 从来不返回成本，只能按秒数兜底定价）。
 * 而第一版把时长**完全交给客户端传**（`node.data.duration`，还 `Math.floor` 过一次）：
 *  - 客户端报 `1秒` 就只扣 1 秒的钱 → 真金白银的漏收（钱的依据绝不许来自客户端）；
 *  - 老节点 / 上传视频拿不到 `durationSeconds` 时压根不传 → 服务端 usd=0 → **静默白送**；
 *  - 深度捕捉上游只处理前 60 秒（`frame_load_cap`），按完整时长收钱就是**多收**。
 * 同时这两条路原来**一点归属校验都没有**（`/api/video` 早就有 `validateOwnedReferences`），
 * 任何登录用户把 `sourceUrl` 填成别人目录下的视频就能拿到一份增强/深度成品。
 *
 * ⭐ 判据：服务端手上**本来就有那个文件**（两个 provider 都要读本地文件上传给上游），
 *    所以真实时长一律现场 ffmpeg 实测，客户端那个数只在实测失败时当兜底。
 */

import { resolveGeneratedFilePath } from "@/lib/generated-asset-path";
import { normalizeReferenceAssetUrl } from "@/lib/reference-asset-url";
import { getLocalVideoDimensions } from "@/lib/video-poster";

/** 本项目所有用户资产都落在 `/generated/users/<userId>/...` 下面（见 local-assets.ts / video-poster.ts）。 */
const USER_SCOPED_GENERATED_PATH = /^\/generated\/users\/([^/]+)\//;

/**
 * 这个源地址是不是别人的资产。**是就返回给用户看的错误文案**，没问题返回 undefined。
 *
 * ⚠️ 只拦「明确带别人 userId 的路径」：历史上还有 `/generated/videos/...` 这种不带用户段的老资产，
 *    那种一律放行（否则会把老数据全拦死）。
 */
export function getSourceVideoOwnershipError(sourceUrl: unknown, userId?: string) {
  const localUrl = normalizeReferenceAssetUrl(sourceUrl);
  const owner = localUrl.match(USER_SCOPED_GENERATED_PATH)?.[1];
  if (!owner || !userId) return undefined;
  if (owner === userId) return undefined;
  return "源视频必须来自当前账号";
}

function parseSecondsText(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : undefined;
  const matched = String(value ?? "").match(/\d+(?:\.\d+)?/)?.[0];
  const seconds = matched ? Number(matched) : Number.NaN;
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

export type ResolvedSourceVideoDuration = {
  /** 整秒（向上取整、至少 1 秒），可直接写进 `settings.duration`。拿不到就是 undefined。 */
  seconds?: number;
  /** `"秒"` 结尾的字符串，给 `settings.duration` / 预估闸门用（拿不到就是 undefined）。 */
  durationText?: string;
  /** 时长是怎么来的：实测 / 客户端兜底 / 完全不知道。写进诊断日志用。 */
  source: "probed" | "client" | "unknown";
  /** 实测到的原始秒数（带小数），只用于日志。 */
  probedSeconds?: number;
  /** 是否被 `maxSeconds` 截断（上游只处理前 N 秒时必须按截断后的秒数收钱）。 */
  capped: boolean;
};

/**
 * 取「这次实际要按多少秒收钱」。
 *
 * 顺序：① ffmpeg 实测本地源文件 ② 客户端传的值（实测失败才用）③ 都没有 → undefined
 *      （调用方交给 `withVideoUsdFallback`，那里按上游默认 5 秒兜底，⛔ 绝不会变成 0）。
 * ⭐ 向上取整：`getDurationSeconds` 这类解析器只吃整数，向下取整等于每条都少收不到 1 秒。
 */
export async function resolveSourceVideoDuration(input: { sourceUrl: string; clientDuration?: string | number; maxSeconds?: number }): Promise<ResolvedSourceVideoDuration> {
  const localUrl = normalizeReferenceAssetUrl(input.sourceUrl);
  const probed = resolveGeneratedFilePath(localUrl)
    ? await getLocalVideoDimensions(localUrl).catch(() => undefined)
    : undefined;
  const probedSeconds = parseSecondsText(probed?.durationSeconds);
  const clientSeconds = parseSecondsText(input.clientDuration);
  const raw = probedSeconds ?? clientSeconds;
  const source: ResolvedSourceVideoDuration["source"] = probedSeconds ? "probed" : clientSeconds ? "client" : "unknown";
  if (!raw) return { source, capped: false };
  const capped = typeof input.maxSeconds === "number" && input.maxSeconds > 0 && raw > input.maxSeconds;
  const seconds = Math.max(1, Math.ceil(capped ? input.maxSeconds! : raw));
  return { seconds, durationText: `${seconds}秒`, source, probedSeconds, capped };
}
