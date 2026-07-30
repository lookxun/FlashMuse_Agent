import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { getCurrentAdminEmail } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * 按账号开关「解除限制」（后台「帐号功能管理」）。
 * 开 = 发给 BytePlus 的 model 用专属 Endpoint ID；关 = 发公开模型名。
 * 生成链路读取入口统一在 `src/lib/account-features.ts` 的 resolveUnlockLimitsForUser。
 * 模板与 `users/general-mode/route.ts` 完全一致。
 */
export async function POST(request: Request) {
  const email = await getCurrentAdminEmail();
  if (!email || !isAdminEmail(email)) return NextResponse.json({ error: "无权限" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const unlockLimitsEnabled = Boolean(body.unlockLimitsEnabled);

  if (!userId) return NextResponse.json({ error: "缺少用户ID" }, { status: 400 });

  const user = await prisma.user
    .update({ where: { id: userId }, data: { unlockLimitsEnabled }, select: { id: true, unlockLimitsEnabled: true } })
    .catch(() => null);
  if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

  return NextResponse.json({ user });
}
