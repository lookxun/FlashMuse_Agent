import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// 用户点 × 关闭公告时上报（按 userId + version 去重记录），供后台统计关闭人数。
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const version = typeof body.version === "string" ? body.version.slice(0, 64) : "";
  if (!version) return NextResponse.json({ ok: false }, { status: 400 });
  try {
    await prisma.$executeRaw`
      INSERT INTO "AnnouncementDismissal" ("id", "userId", "version")
      VALUES (${randomUUID()}, ${user.id}, ${version})
      ON CONFLICT ("userId", "version") DO NOTHING
    `;
  } catch {
    /* 表未建/写失败都不影响前端关闭体验 */
  }
  return NextResponse.json({ ok: true });
}
