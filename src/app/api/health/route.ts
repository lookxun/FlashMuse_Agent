import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { APP_VERSION } from "@/lib/app-version";

// 健康检查（2026-08-02 审计 2.5 新增）：不要登录、不记任何日志。
// 供 docker compose healthcheck / 外部拨测用。db 挂了就 503。
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, version: APP_VERSION });
  } catch {
    return NextResponse.json({ ok: false, version: APP_VERSION }, { status: 503 });
  }
}
