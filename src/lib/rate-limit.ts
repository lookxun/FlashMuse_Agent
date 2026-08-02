// 轻量进程内限流（2026-08-02 审计 2.8c）。
// 单 app 容器部署，进程内 Map 足够；多实例以后不够用再换 Redis。
// 只用于"防滥用"量级（发验证码、密码尝试），不是精确限流器。

type Bucket = number[];
const buckets = new Map<string, Bucket>();
let lastPruneAt = 0;

function prune(now: number) {
  if (now - lastPruneAt < 10 * 60_000) return;
  lastPruneAt = now;
  for (const [key, hits] of buckets) {
    if (hits.length === 0 || now - hits[hits.length - 1] > 24 * 60 * 60_000) buckets.delete(key);
  }
}

/** 记录一次命中；返回 false = 已超限，这次请求应该被拒。 */
export function rateLimitAllow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  prune(now);
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}

/** 从请求头取客户端 IP（nginx 反代会写 X-Forwarded-For；取第一跳）。 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
