import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { getCurrentAdminEmail } from "@/lib/admin-auth";
import { SENSITIVE_POLITICS_CATEGORY } from "@/lib/content-moderation";
import { prisma } from "@/lib/prisma";
import { verifyModerationActionPassword } from "../route";

export const runtime = "nodejs";

// 页面编辑锁的状态存库（全浏览器共享）：解锁需密码，锁定不需要。
async function setUnlocked(value: boolean) {
  await prisma.$executeRaw`
    INSERT INTO "ContentModerationRuleGroup" ("id", "category", "label", "enabled", "editUnlocked", "updatedAt")
    VALUES (${randomUUID()}, ${SENSITIVE_POLITICS_CATEGORY}, ${"敏感政治内容"}, false, ${value}, NOW())
    ON CONFLICT ("category") DO UPDATE SET "editUnlocked" = ${value}, "updatedAt" = NOW()
  `;
}

export async function POST(request: Request) {
  const email = await getCurrentAdminEmail();
  if (!email || !isAdminEmail(email)) return NextResponse.json({ error: "无权限" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  if (body.unlocked === true) {
    if (!await verifyModerationActionPassword(body.password)) return NextResponse.json({ error: "密码错误" }, { status: 403 });
    await setUnlocked(true);
    return NextResponse.json({ ok: true, unlocked: true });
  }
  await setUnlocked(false);
  return NextResponse.json({ ok: true, unlocked: false });
}
