import { NextResponse } from "next/server";
import { getAdminEmails, isAdminEmail } from "@/lib/admin";
import { getCurrentAdminEmail } from "@/lib/admin-auth";
import { normalizeEmail } from "@/lib/auth";
import { isPermanentAdminEmail } from "@/lib/permanent-admins";
import { prisma } from "@/lib/prisma";
import { updateAdminEmailWhitelist } from "@/lib/system-settings";

export const runtime = "nodejs";

/**
 * 按账号开关「后台白名单」（能不能进 `/admin`）。
 *
 * ⚠️ 与另外两个开关不同：白名单**不存在 User 表上**，而是 `.env.local` 的 `ADMIN_EMAILS`
 * （这是全站唯一的管理员判定来源，`isAdminEmail` 读它）。所以这里的写法是"改邮箱清单"，
 * 不是"改用户的某个布尔字段"。
 *
 * ⛔ 三条护栏：
 *  ① **永久管理员不许关**（`PERMANENT_ADMIN_EMAILS`，见 `lib/permanent-admins.ts`）——
 *     保证后台永远有一个账号能进，不会出现"全世界都被锁在后台外面"的死局。
 *     前端那一行的开关也是置灰的，这里再挡一层是防绕过（直接打接口）。
 *  ② 不允许把**自己**移出白名单 —— 否则点完当场把自己锁在后台外面。
 *  ③ 目标用户必须真实存在，避免把错的/不存在的邮箱写进管理员清单。
 */
export async function POST(request: Request) {
  const email = await getCurrentAdminEmail();
  if (!email || !isAdminEmail(email)) return NextResponse.json({ error: "无权限" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const whitelisted = Boolean(body.whitelisted);

  if (!userId) return NextResponse.json({ error: "缺少用户ID" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } }).catch(() => null);
  if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

  const targetEmail = normalizeEmail(user.email);
  if (!targetEmail) return NextResponse.json({ error: "该用户没有可用邮箱" }, { status: 400 });
  if (!whitelisted && isPermanentAdminEmail(targetEmail)) {
    return NextResponse.json({ error: "该账号是永久管理员，后台白名单不可关闭（保证后台永远有账号能进）" }, { status: 400 });
  }
  if (!whitelisted && targetEmail === normalizeEmail(email)) {
    return NextResponse.json({ error: "不能把自己移出后台白名单" }, { status: 400 });
  }

  const current = getAdminEmails();
  const next = whitelisted ? [...current, targetEmail] : current.filter((item) => item !== targetEmail);
  const saved = await updateAdminEmailWhitelist(next);

  return NextResponse.json({ user: { id: user.id, whitelisted: saved.includes(targetEmail) }, total: saved.length });
}
