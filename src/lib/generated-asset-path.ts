/**
 * `/generated/...` 公开地址 → 本地文件路径的**唯一权威解析器**（含目录包含校验）。
 *
 * ⛔⛔ 为什么必须有这个文件（2026-08-02 安全加固）：
 * 历史上有 6 处代码都是这么写的 ——
 *
 *   const localUrl = normalizeReferenceAssetUrl(url);
 *   if (!localUrl.startsWith("/generated/")) return url;          // ← 唯一的校验
 *   const filePath = join(process.cwd(), "public", localUrl.replace(/^\//, ""));
 *   readFileSync(filePath)                                        // ← 直接读
 *
 * 问题：`startsWith("/generated/")` **拦不住 `..`**，而 `normalizeReferenceAssetUrl`
 * 也只剥 query 和 `#`（见 `reference-asset-url.ts:67`），不做路径规范化。
 * 于是任何登录用户把参考图填成 `/generated/../../.env.local`，
 * `join()` 折叠掉 `..` 后就变成了项目根目录下的 `.env.local`，
 * 内容被 base64 塞进发给模型的请求里 —— 等于泄露
 * `OPENROUTER_API_KEY` / `BYTEPLUS_*` / `AUTH_SECRET` / 数据库口令。
 * （`AUTH_SECRET` 一泄，别人能自己签管理员 cookie 登 `/admin`。）
 *
 * ⭐ 正解只有一句：**`resolve()` 之后必须仍在 `public/generated` 里面**。
 * 这个判断对任何编码方式都有效（`..`、`%2e%2e`、绝对路径、符号链接式拼接都一样），
 * 所以比"过滤 `..` 字符串"可靠得多，也不需要维护黑名单。
 *
 * ⛔ 本项目铁律「能统一一律统一」：**禁止再在别处自己写
 * `join(process.cwd(), "public", ...)` + `readFileSync`**。
 * 需要把 `/generated/xxx` 变成本地路径，一律调这里的 `resolveGeneratedFilePath()`。
 * 现成的正确样板原本只有 `api/media-thumbnail/route.ts` 一处（它一直是对的），
 * 现在那一处也改成复用本文件，避免两份判断以后各自漂移。
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { normalizeReferenceAssetUrl } from "@/lib/reference-asset-url";

const PUBLIC_ROOT = join(process.cwd(), "public");
const GENERATED_ROOT = join(PUBLIC_ROOT, "generated");

/**
 * 这个绝对路径是否仍在 `public/generated` 里面（含它自己）。
 * 同时兼容 Windows 反斜杠和 POSIX 斜杠：本地开发是 Windows、线上容器是 Linux。
 */
export function isInsideGeneratedRoot(filePath: string) {
  const generatedRoot = resolve(GENERATED_ROOT);
  const resolvedPath = resolve(filePath);
  return resolvedPath === generatedRoot || resolvedPath.startsWith(`${generatedRoot}\\`) || resolvedPath.startsWith(`${generatedRoot}/`);
}

/**
 * 把 `/generated/...` 公开地址解析成本地绝对路径。
 * **不合法就返回 undefined**（调用方一律按"这不是自家本地资产"处理，绝不要自己再拼一次）。
 *
 * 会拒绝：非 `/generated/` 前缀、含 NUL 等控制字符、`resolve()` 后跑出 generated 目录的。
 * ⚠️ 只做"路径合法且在笼子里"的判断，**不判断文件是否存在** ——
 *    要判断存在性用 `existsSync`，或直接用下面的 `readGeneratedFile()`。
 */
export function resolveGeneratedFilePath(publicUrl: unknown): string | undefined {
  const localUrl = normalizeReferenceAssetUrl(publicUrl);
  if (!localUrl.startsWith("/generated/")) return undefined;
  // NUL 或其它控制字符会让 fs 抛异常，也可能被用来截断路径，直接拒绝。
  if (/[\u0000-\u001f]/.test(localUrl)) return undefined;

  const filePath = join(PUBLIC_ROOT, localUrl.replace(/^\//, ""));
  if (!isInsideGeneratedRoot(filePath)) return undefined;
  return filePath;
}

/** 存在且合法时返回文件字节数，否则 undefined。 */
export function getGeneratedFileSize(publicUrl: unknown): number | undefined {
  try {
    const filePath = resolveGeneratedFilePath(publicUrl);
    if (!filePath || !existsSync(filePath)) return undefined;
    return statSync(filePath).size;
  } catch {
    return undefined;
  }
}

/** 该地址是否指向一个真实存在的自家 `/generated/` 文件。 */
export function generatedAssetExists(publicUrl: unknown): boolean {
  const filePath = resolveGeneratedFilePath(publicUrl);
  return Boolean(filePath && existsSync(filePath));
}

/**
 * 参考图/参考素材的 MIME 猜测（按扩展名）。
 * 三处副本（openrouter / openrouter-video / seedance）原本各写一份且完全一致，这里收成唯一一份。
 */
export function getReferenceAssetMimeType(filePath: string) {
  const extension = extname(filePath).toLowerCase();

  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return "image/png";
}

/**
 * 自家 `/generated/` 资产 → `data:` base64；不是自家资产/文件不存在则原样返回入参。
 *
 * ⭐ 这是原先散落在 `openrouter.ts` / `openrouter-video.ts` / `seedance.ts` 三处的
 * `toDataUrlIfLocalPublicAsset` 的唯一实现（三份原本一字不差，含同样的路径穿越漏洞）。
 * 行为与原来保持一致：
 *  - 归一化后不是 `/generated/` → 原样返回**传进来的原始值**（可能是第三方 https，交给下游）；
 *  - 是 `/generated/` 但文件不存在 → 返回**归一化后的相对路径**（下游会再拼公网 base 去抓）；
 *  - 存在 → 返回 base64 data URL。
 * 唯一的变化是：路径穿越会被当作"不是自家资产"直接拒绝，不再去读那个文件。
 */
export function toDataUrlIfLocalPublicAsset(url: string): string {
  const localUrl = normalizeReferenceAssetUrl(url);
  if (!localUrl.startsWith("/generated/")) return url;

  const filePath = resolveGeneratedFilePath(localUrl);
  // 路径不合法（穿越）也走这条：当成"本地没有这个文件"，交给下游按公网地址处理。
  if (!filePath || !existsSync(filePath)) return localUrl;

  const data = readFileSync(filePath);
  return `data:${getReferenceAssetMimeType(filePath)};base64,${data.toString("base64")}`;
}
