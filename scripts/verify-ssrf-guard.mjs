/**
 * SSRF 防护自验脚本（一次性，不进构建、不影响运行）。
 *
 * 跑法：`node scripts/verify-ssrf-guard.mjs`
 * 目的：证明 `src/lib/ssrf-guard.ts` 的判定**真的**拦住了内网、且**真的**放行了供应商域名。
 * ⛔ 不许联网、不许连数据库、不许改任何东西（纯判定 + 本地 DNS 解析）。
 *
 * ⚠️ 本脚本把 ssrf-guard 的判定逻辑用 JS 重写了一份来测（因为它是 .ts，
 *    直接 import 需要构建）。⭐ 所以**改了 ssrf-guard.ts 的网段表，必须同步改这里**，
 *    否则测的就不是线上那份了。两边的 CIDR 列表必须完全一致。
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_V4 = [
  "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16",
  "172.16.0.0/12", "192.0.0.0/24", "192.0.2.0/24", "192.168.0.0/16",
  "198.18.0.0/15", "198.51.100.0/24", "203.0.113.0/24", "224.0.0.0/4", "240.0.0.0/4",
];

function ipv4ToInt(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return undefined;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function isBlockedIpv4(ip) {
  const value = ipv4ToInt(ip);
  if (value === undefined) return true;
  return BLOCKED_V4.some((cidr) => {
    const [base, bitsText] = cidr.split("/");
    const bits = Number(bitsText);
    const baseValue = ipv4ToInt(base);
    if (baseValue === undefined) return false;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (value & mask) === (baseValue & mask);
  });
}

function isBlockedIpv6(ip) {
  const lower = ip.toLowerCase().split("%")[0];
  if (lower === "::1" || lower === "::") return true;
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIpv4(mapped[1]);
  if (/^::ffff:/.test(lower)) return true;
  const head = parseInt(lower.split(":")[0] || "0", 16);
  if (Number.isNaN(head)) return true;
  if ((head & 0xfe00) === 0xfc00) return true;
  if ((head & 0xffc0) === 0xfe80) return true;
  if ((head & 0xff00) === 0xff00) return true;
  return false;
}

function isBlockedIp(ip) {
  const v = isIP(ip);
  if (v === 4) return isBlockedIpv4(ip);
  if (v === 6) return isBlockedIpv6(ip);
  return true;
}

async function check(rawUrl) {
  let parsed;
  try { parsed = new URL(rawUrl); } catch { return { allowed: false, reason: "地址格式不正确" }; }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return { allowed: false, reason: `协议 ${parsed.protocol}` };
  if (parsed.username || parsed.password) return { allowed: false, reason: "内嵌账号密码" };
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  if (!hostname) return { allowed: false, reason: "缺少主机名" };
  if (isIP(hostname)) {
    return isBlockedIp(hostname) ? { allowed: false, reason: "内网 IP（字面量）" } : { allowed: true, reason: "公网 IP" };
  }
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    return { allowed: false, reason: "内网域名后缀" };
  }
  let addresses;
  try { addresses = await lookup(hostname, { all: true }); } catch { return { allowed: false, reason: "无法解析" }; }
  if (addresses.length === 0) return { allowed: false, reason: "无法解析" };
  for (const a of addresses) {
    if (isBlockedIp(a.address)) return { allowed: false, reason: `解析到内网 ${a.address}` };
  }
  return { allowed: true, reason: `解析到 ${addresses.map((a) => a.address).join(",")}` };
}

// ---------- 用例 ----------
// expect: "block" = 必须拦住；"allow" = 必须放行
const CASES = [
  // ① 真实攻击载荷 —— 云厂商元数据接口，这是这个洞最值钱的目标
  ["http://169.254.169.254/latest/meta-data/iam/security-credentials/", "block"],
  ["http://169.254.169.254/latest/meta-data/x?a=.mp4", "block"],
  ["http://metadata.google.internal/computeMetadata/v1/", "block"],
  // ② 本机 / 回环 —— 能打到我们自己的 Next 和 nginx
  ["http://127.0.0.1:3000/api/auth/me", "block"],
  ["http://localhost:3000/api/auth/me", "block"],
  ["http://[::1]:3000/", "block"],
  ["http://0.0.0.0:3000/", "block"],
  // ③ Docker / 内网网段 —— 同机上还有另外两个项目
  ["http://172.17.0.1:5432/", "block"],
  ["http://172.31.255.254/", "block"],
  ["http://10.0.0.5:5432/", "block"],
  ["http://192.168.1.1/", "block"],
  ["http://100.64.0.1/", "block"],
  // ④ IPv6 内网写法
  ["http://[fe80::1]/", "block"],
  ["http://[fc00::1]/", "block"],
  ["http://[::ffff:127.0.0.1]/", "block"],
  // ⑤ 混淆写法
  ["http://user:pass@169.254.169.254/", "block"],
  ["file:///etc/passwd", "block"],
  ["gopher://127.0.0.1:11211/", "block"],
  ["http://foo.internal/", "block"],
  // ⑥ 必须放行：真实供应商域名（本地队列里实测出现过的就是这两个 host）
  ["https://ark-acg-ap-southeast-1.tos-ap-southeast-1.volces.com/seedream-5-0/x_0.jpeg?X-Tos-Signature=abc", "allow"],
  ["https://ark-content-generation-v2-ap-southeast-1.tos-ap-southeast-1.volces.com/seedream-4-5/y_0.jpeg", "allow"],
  ["https://openrouter.ai/api/v1/x.png", "allow"],
  // ⑦ 必须放行：我们自己的公网地址（正式服回源、阿里镜像都靠它）
  ["https://main.venusface.com/generated/users/ID_1/images/a.jpg", "allow"],
  ["http://119.28.116.16:5000/generated/a.jpg", "allow"],
  ["http://101.37.129.164/generated/a.jpg", "allow"],
];

console.log("SSRF 防护自验（block = 必须拦住，allow = 必须放行）\n");
let pass = 0;
let fail = 0;
const failures = [];

for (const [url, expect] of CASES) {
  const result = await check(url);
  const actual = result.allowed ? "allow" : "block";
  const ok = actual === expect;
  if (ok) pass += 1; else { fail += 1; failures.push({ url, expect, actual, reason: result.reason }); }
  const mark = ok ? "  OK  " : " FAIL ";
  const shown = url.length > 76 ? `${url.slice(0, 73)}...` : url;
  console.log(`${mark} [期望 ${expect.padEnd(5)}] ${shown}`);
  console.log(`       → ${actual}（${result.reason}）`);
}

console.log(`\n结果：通过 ${pass} / 共 ${pass + fail}`);
if (fail > 0) {
  console.log("\n❌ 下面这些不符合预期：");
  for (const f of failures) console.log(`   ${f.url}\n     期望 ${f.expect}，实际 ${f.actual}（${f.reason}）`);
  process.exit(1);
}
console.log("✅ 全部符合预期。");
