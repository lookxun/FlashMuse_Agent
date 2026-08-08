import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 主工作台顶部公告的公开读取接口。
// version = 本次投放的 runId：开启新一次 → runId 变 → 之前点 × 关过的人会重新看到。
// ⚠️ 本接口**不要求登录**（首页未登录也要显示公告）→ 必须自带短缓存，否则任何人刷首页
//    都会打一次数据库。缓存 5 秒，与 /api/auth/me 里那份口径一致（公告是全局单行、无个性化）。
type AnnouncementPayload = { enabled: boolean; content?: string; version?: string };
let cache: { value: AnnouncementPayload; at: number } | null = null;
const CACHE_MS = 5000;

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return NextResponse.json(cache.value);
  try {
    const rows = await prisma.$queryRaw<Array<{ content: string; enabled: boolean; currentRunId: string | null }>>`
      SELECT "content", "enabled", "currentRunId" FROM "Announcement" WHERE "key" = 'global' LIMIT 1
    `;
    const row = rows[0];
    const content = (row?.content ?? "").trim();
    const version = row?.currentRunId ?? "";
    const enabled = Boolean(row?.enabled) && content.length > 0 && version.length > 0;
    const value: AnnouncementPayload = enabled ? { enabled: true, content, version } : { enabled: false };
    cache = { value, at: now };
    return NextResponse.json(value);
  } catch {
    return NextResponse.json({ enabled: false });
  }
}
