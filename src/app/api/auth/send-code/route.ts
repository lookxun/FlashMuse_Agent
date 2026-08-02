import { randomInt } from "node:crypto";
import { canEmailDomainReceiveMail, hashVerificationCode, isValidEmail, jsonError, normalizeEmail } from "@/lib/auth";
import { isSmtpConfigured, sendLoginCodeEmail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimitAllow } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);

  if (!isValidEmail(email)) {
    return jsonError("请输入完整邮箱");
  }

  // 限流（2026-08-02 审计 2.8c）：原来是匿名无限发真实邮件（邮件轰炸 / 烧 SMTP 配额 / 域名进黑名单）。
  // 同一邮箱 60 秒 1 封；同一 IP 一天 30 封。超限时文案与成功一致-ish，不给探测信号。
  if (!rateLimitAllow(`send-code:email:${email}`, 1, 60_000) || !rateLimitAllow(`send-code:ip:${getClientIp(request)}`, 30, 24 * 60 * 60_000)) {
    return jsonError("验证码发送太频繁，请稍后再试");
  }

  if (!(await canEmailDomainReceiveMail(email))) {
    return jsonError("邮箱或域名不存在，请检查后重新输入");
  }

  // 验证码用 crypto 的 randomInt（原来用 Math.random()，xorshift128+ 可预测）。
  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.emailVerificationCode.updateMany({
    where: { email, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  await prisma.emailVerificationCode.create({
    data: {
      email,
      codeHash: hashVerificationCode(email, code),
      expiresAt,
    },
  });

  if (isSmtpConfigured()) {
    try {
      await sendLoginCodeEmail(email, code);
    } catch (error) {
      console.error("[auth] 验证码邮件发送失败：", error);
      return jsonError("验证码邮件发送失败，请稍后重试", 500);
    }
  } else {
    console.log(`[auth] ${email} 的登录验证码：${code}，10 分钟内有效`);
  }

  return Response.json({ ok: true });
}
