import { createUserSession, isValidEmail, jsonError, normalizeEmail, verifyPassword } from "@/lib/auth";
import { getLoginAuditData } from "@/lib/login-audit";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimitAllow } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";

  if (!isValidEmail(email)) {
    return jsonError("请输入完整邮箱");
  }

  if (!password) {
    return jsonError("请输入密码");
  }

  // 限流（2026-08-02 审计 2.8c）：原来是无限次密码尝试，且 scrypt 是 CPU 放大器。
  // 同一邮箱 10 分钟 10 次、同一 IP 10 分钟 30 次。
  if (!rateLimitAllow(`login-pwd:email:${email}`, 10, 10 * 60_000) || !rateLimitAllow(`login-pwd:ip:${getClientIp(request)}`, 30, 10 * 60_000)) {
    return jsonError("尝试太频繁，请 10 分钟后再试");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user?.disabled) {
    return jsonError("用户名错误！请联系管理员！");
  }

  if (!user || !user.passwordHash) {
    return jsonError("该邮箱还没有设置密码，请使用验证码登录");
  }

  const isValidPassword = await verifyPassword(password, user.passwordHash);
  if (!isValidPassword) {
    return jsonError("密码不正确");
  }

  await prisma.user.update({ where: { id: user.id }, data: await getLoginAuditData(request) });
  await createUserSession(user.id);

  return Response.json({ user: { email: user.email, hasPassword: true } });
}
