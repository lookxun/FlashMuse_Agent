import { NextResponse } from "next/server";
import { getAdminEmails, isAdminEmail } from "@/lib/admin";
import { getCurrentAdminEmail } from "@/lib/admin-auth";
import { normalizeEmail } from "@/lib/auth";
import { PERMANENT_ADMIN_EMAILS } from "@/lib/permanent-admins";
import { prisma } from "@/lib/prisma";
import { updateAdminEmailWhitelist } from "@/lib/system-settings";

export const runtime = "nodejs";

/**
 * 后台「帐号功能管理」标题栏的三个总开关 = **批量操作**（一键把所有账号开/关）。
 *
 * ⭐ 语义（2026-07-30 用户拍板）：总开关**不是全局覆盖**，它只是"一键把当前所有账号设成同一个值"。
 * 真正生效的永远是每个账号自己的开关，批量之后仍可单独调某一个。
 *
 * ⭐ 三个开关共用这一个接口（能统一一律统一），靠 `feature` 区分：
 *  - `generalMode`   → User.generalModeEnabled
 *  - `unlockLimits`  → User.unlockLimitsEnabled
 *  - `adminWhitelist`→ `.env.local` 的 ADMIN_EMAILS（不在 User 表上，见 admin-whitelist/route.ts）
 *
 * ⛔ 白名单批量关闭时会**保留当前操作者自己 + 永久管理员**（`lib/permanent-admins.ts`），
 *    否则一键关掉等于把自己（甚至所有人）锁在后台外面。
 *    ⭐ 其实 `updateAdminEmailWhitelist` 落盘时还会再补一次永久管理员（双保险），这里写明是为了可读。
 */
export async function POST(request: Request) {
  const email = await getCurrentAdminEmail();
  if (!email || !isAdminEmail(email)) return NextResponse.json({ error: "无权限" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const feature = typeof body.feature === "string" ? body.feature : "";
  const enabled = Boolean(body.enabled);

  if (feature === "generalMode") {
    const result = await prisma.user.updateMany({ data: { generalModeEnabled: enabled } });
    return NextResponse.json({ feature, enabled, affected: result.count });
  }

  if (feature === "unlockLimits") {
    const result = await prisma.user.updateMany({ data: { unlockLimitsEnabled: enabled } });
    return NextResponse.json({ feature, enabled, affected: result.count });
  }

  if (feature === "adminWhitelist") {
    const self = normalizeEmail(email);
    if (!enabled) {
      // 全关：只留自己 + 永久管理员，避免把自己或最后一个入口也踢出去。
      const saved = await updateAdminEmailWhitelist([self, ...PERMANENT_ADMIN_EMAILS]);
      return NextResponse.json({ feature, enabled, affected: saved.length });
    }
    const users = await prisma.user.findMany({ select: { email: true } });
    const emails = users.map((item) => normalizeEmail(item.email)).filter(Boolean);
    // 保留原来清单里那些"没有对应用户的邮箱"（比如还没注册的运维账号），不要顺手抹掉。
    const saved = await updateAdminEmailWhitelist([...getAdminEmails(), ...emails, self]);
    return NextResponse.json({ feature, enabled, affected: saved.length });
  }

  return NextResponse.json({ error: "未知的开关类型" }, { status: 400 });
}
