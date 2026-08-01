/**
 * 出网抓取防护（SSRF guard）—— 服务端"按用户给的地址去下载东西"之前必须过这一道。
 *
 * ⛔⛔ 为什么必须有（2026-08-02 安全加固，真实可利用）：
 * `POST /api/media-save-status` 原本**不要求登录**，而 `getMediaSaveStatuses()` 对任何
 * 没见过的地址都会 `enqueueRemoteAssetSave()` → `saveRemoteAsset()` → `fetch(url)`，
 * 唯一的过滤是 `media-save-queue.ts` 里的 `isRemoteUrl()`（只判断 `^https?://`）。
 * 下载到的字节会被写进 `public/generated/`，**而且下一次轮询就把 `localUrl` 回给调用方**。
 *
 * 于是任何人（不用账号）发两个请求就能：
 *   ① 让服务器去读云厂商元数据接口 `http://169.254.169.254/...`（能拿到实例凭证）；
 *   ② 扫/读内网，包括同一台腾讯机器上**另外两个项目**的端口；
 *   ③ 把结果存成一个公开可下载的文件，然后直接 GET 走。
 * `.mp4` 结尾会被判成 video、**原字节保存**，所以拿到的是精确副本。
 *
 * ⭐ 拦法（2026-08-02 用户拍板：走"内网黑名单"，不走"域名白名单"）：
 * 白名单更严，但供应商回给我们的媒体域名是**运行时才知道的**（BytePlus 是
 * `ark-*.tos-ap-southeast-1.volces.com`，OpenRouter 那条链路的 host 无法穷举）。
 * 一旦漏了一个域名，那次生成的图就存不下来 = **用户丢图**。
 * 而"拒绝私网地址"覆盖了上面 ① ② 两个真实攻击面，且**不可能误伤任何公网供应商**。
 *
 * ⚠️ 关键点：必须**解析 DNS 之后再判 IP**，不能只看域名字符串 ——
 * 否则攻击者随便拿一个自己的域名解析到 `169.254.169.254` 就绕过了（DNS rebinding 的初级形态）。
 * 本模块用 `dns.lookup(all)` 拿到所有 A/AAAA 记录，**任意一条落在私网就整体拒绝**。
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** 允许的协议。⛔ 不允许 file: / ftp: / gopher: / data: 等。 */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export class BlockedRemoteUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedRemoteUrlError";
  }
}

function ipv4ToInt(ip: string) {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return undefined;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

/**
 * 这个 IPv4 是不是"不该让服务器去访问"的地址。
 * 覆盖：本机回环、私有网段、链路本地（含云元数据 169.254.169.254）、CGNAT、
 * 保留段、广播、组播、以及 0.0.0.0/8。
 */
function isBlockedIpv4(ip: string) {
  const value = ipv4ToInt(ip);
  if (value === undefined) return true; // 解析不出来就当危险
  const inRange = (cidr: string) => {
    const [base, bitsText] = cidr.split("/");
    const bits = Number(bitsText);
    const baseValue = ipv4ToInt(base);
    if (baseValue === undefined || !Number.isInteger(bits)) return false;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (value & mask) === (baseValue & mask);
  };
  return [
    "0.0.0.0/8",        // 本网络 / 未指定
    "10.0.0.0/8",       // 私有
    "100.64.0.0/10",    // CGNAT（运营商内网）
    "127.0.0.0/8",      // 回环 —— 能打到本机的 Next / nginx
    "169.254.0.0/16",   // 链路本地 —— 云元数据 169.254.169.254 就在这里
    "172.16.0.0/12",    // 私有 —— Docker 默认网段常在这里，能打到同机别的容器
    "192.0.0.0/24",     // IETF 协议分配
    "192.0.2.0/24",     // 文档示例
    "192.168.0.0/16",   // 私有
    "198.18.0.0/15",    // 基准测试
    "198.51.100.0/24",  // 文档示例
    "203.0.113.0/24",   // 文档示例
    "224.0.0.0/4",      // 组播
    "240.0.0.0/4",      // 保留（含 255.255.255.255 广播）
  ].some(inRange);
}

/** IPv6 版本。覆盖 ::1 回环、::、唯一本地地址 fc00::/7、链路本地 fe80::/10，以及 IPv4 映射地址。 */
function isBlockedIpv6(ip: string) {
  const lower = ip.toLowerCase().split("%")[0]; // 去掉 scope id（fe80::1%eth0）
  if (lower === "::1" || lower === "::") return true;
  // ::ffff:1.2.3.4 / ::ffff:0102:0304 —— IPv4 映射，必须按 IPv4 规则再判一次
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIpv4(mapped[1]);
  if (/^::ffff:/.test(lower)) return true; // 十六进制写法的映射地址，一律拒绝（极少见，宁可误杀）
  const firstGroup = lower.split(":")[0];
  const head = parseInt(firstGroup || "0", 16);
  if (Number.isNaN(head)) return true;
  if ((head & 0xfe00) === 0xfc00) return true; // fc00::/7 唯一本地
  if ((head & 0xffc0) === 0xfe80) return true; // fe80::/10 链路本地
  if ((head & 0xff00) === 0xff00) return true; // ff00::/8 组播
  return false;
}

function isBlockedIp(ip: string) {
  const version = isIP(ip);
  if (version === 4) return isBlockedIpv4(ip);
  if (version === 6) return isBlockedIpv6(ip);
  return true;
}

/**
 * 校验"服务器可以去抓这个地址吗"。**不通过就抛 `BlockedRemoteUrlError`。**
 *
 * 通过条件全部满足：① http/https；② 没有内嵌凭据（`http://user:pass@`）；
 * ③ 主机名能解析；④ **解析出来的每一个 IP 都不在私网/回环/链路本地**。
 */
export async function assertRemoteUrlAllowed(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new BlockedRemoteUrlError("远端地址格式不正确");
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new BlockedRemoteUrlError(`不允许的协议：${parsed.protocol}`);
  }
  // `http://user:pass@host/` 这种内嵌凭据的写法常被用来混淆真实 host，直接拒绝。
  if (parsed.username || parsed.password) {
    throw new BlockedRemoteUrlError("远端地址不允许内嵌账号密码");
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, ""); // IPv6 字面量带方括号
  if (!hostname) throw new BlockedRemoteUrlError("远端地址缺少主机名");

  // 字面量 IP：直接判，不用查 DNS。
  if (isIP(hostname)) {
    if (isBlockedIp(hostname)) throw new BlockedRemoteUrlError("不允许访问内网地址");
    return;
  }

  // `localhost` 之类可能被 hosts 文件指到别处，但语义上就该拒。
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new BlockedRemoteUrlError("不允许访问内网地址");
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new BlockedRemoteUrlError("远端主机无法解析");
  }
  if (addresses.length === 0) throw new BlockedRemoteUrlError("远端主机无法解析");

  // ⭐ 任意一条记录落在私网就整体拒绝：攻击者可以让一个域名同时返回公网和内网 IP。
  for (const item of addresses) {
    if (isBlockedIp(item.address)) throw new BlockedRemoteUrlError("不允许访问内网地址");
  }
}

/** 布尔版（不抛异常）。只在"不想中断流程、只想跳过这一条"的场景用。 */
export async function isRemoteUrlAllowed(rawUrl: string): Promise<boolean> {
  try {
    await assertRemoteUrlAllowed(rawUrl);
    return true;
  } catch {
    return false;
  }
}

const MAX_REDIRECTS = 5;

/**
 * 带 SSRF 防护的 `fetch`：**每一跳都重新校验**。
 *
 * ⛔⛔ 为什么不能直接 `fetch(url, { redirect: "follow" })`：
 * 那样只校验了第一跳。攻击者给一个**正常的公网地址**，让它 302 到
 * `http://169.254.169.254/latest/meta-data/...`，`follow` 会老老实实跟过去 ——
 * 上面那道校验就白做了。同理 `curl -L` 也不能用（已在 `local-assets.ts` 去掉 `-L`）。
 *
 * 做法：`redirect: "manual"`，自己读 `Location`、把相对地址按当前 URL 解析成绝对地址、
 * **再过一次 `assertRemoteUrlAllowed`**，然后才继续下一跳；最多跟 5 跳。
 */
export async function safeFetch(rawUrl: string, init?: RequestInit): Promise<Response> {
  let currentUrl = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertRemoteUrlAllowed(currentUrl);
    const response = await fetch(currentUrl, { ...init, redirect: "manual" });

    const isRedirect = response.status >= 300 && response.status < 400;
    if (!isRedirect) return response;

    const location = response.headers.get("location");
    if (!location) return response; // 3xx 但没给 Location，交给上层按状态码处理

    let nextUrl: string;
    try {
      nextUrl = new URL(location, currentUrl).toString();
    } catch {
      throw new BlockedRemoteUrlError("重定向地址格式不正确");
    }
    currentUrl = nextUrl;
  }

  throw new BlockedRemoteUrlError(`重定向次数超过 ${MAX_REDIRECTS} 次`);
}
