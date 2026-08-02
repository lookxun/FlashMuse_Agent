import { createHmac, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { isAdminEmail } from "@/lib/admin";
import { normalizeEmail } from "@/lib/auth";
import { getAuthSecret } from "@/lib/auth-secret";
import { prisma } from "@/lib/prisma";

export const adminCookieName = "flashmuse-admin-session";
const adminSessionMaxAgeSeconds = 24 * 60 * 60;
const authSecret = getAuthSecret();
const forceInsecureAuthCookie = process.env.FORCE_INSECURE_AUTH_COOKIE === "true";
const authCookieDomain = process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined;

function signAdminPayload(payload: string) {
  return createHmac("sha256", `${authSecret}:admin-session`).update(payload).digest("base64url");
}

function safeEqualText(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function getCookieHeaderValues(rawCookieHeader: string, name: string) {
  return rawCookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`))
    .map((part) => part.slice(name.length + 1))
    .filter((value) => value.length > 0);
}

function getAdminCookieCandidates(cookieStore: Awaited<ReturnType<typeof cookies>>, rawCookieHeader: string) {
  const values = cookieStore
    .getAll(adminCookieName)
    .map((cookie) => cookie.value)
    .filter((value) => value.length > 0);

  return Array.from(new Set([...values, ...getCookieHeaderValues(rawCookieHeader, adminCookieName)]));
}

function setAdminCookie(cookieStore: Awaited<ReturnType<typeof cookies>>, token: string, maxAge: number) {
  if (authCookieDomain) {
    cookieStore.set(adminCookieName, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" && !forceInsecureAuthCookie,
      path: "/admin",
      maxAge: 0,
    });
  }

  cookieStore.set(adminCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !forceInsecureAuthCookie,
    path: "/admin",
    maxAge,
    ...(authCookieDomain ? { domain: authCookieDomain } : {}),
  });
}

function readValidAdminEmail(token: string) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqualText(signature, signAdminPayload(payload))) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email?: unknown; expiresAt?: unknown };
    const email = normalizeEmail(parsed.email);
    const expiresAt = typeof parsed.expiresAt === "number" ? parsed.expiresAt : 0;

    if (!email || expiresAt <= Date.now() || !isAdminEmail(email)) return null;
    return email;
  } catch {
    return null;
  }
}

export async function createAdminSession(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const expiresAt = Date.now() + adminSessionMaxAgeSeconds * 1000;
  const payload = Buffer.from(JSON.stringify({ email: normalizedEmail, expiresAt })).toString("base64url");
  const token = `${payload}.${signAdminPayload(payload)}`;
  const cookieStore = await cookies();

  setAdminCookie(cookieStore, token, adminSessionMaxAgeSeconds);
}

export async function refreshCurrentAdminActivity() {
  const cookieStore = await cookies();
  const rawCookieHeader = (await headers()).get("cookie") ?? "";
  const tokens = getAdminCookieCandidates(cookieStore, rawCookieHeader);
  if (tokens.length === 0) return false;

  for (const token of tokens) {
    const email = readValidAdminEmail(token);
    if (!email) continue;

    const expiresAt = Date.now() + adminSessionMaxAgeSeconds * 1000;
    const payload = Buffer.from(JSON.stringify({ email, expiresAt })).toString("base64url");
    setAdminCookie(cookieStore, `${payload}.${signAdminPayload(payload)}`, adminSessionMaxAgeSeconds);
    return true;
  }

  await clearAdminSession();
  return false;
}

export async function getCurrentAdminEmail() {
  const cookieStore = await cookies();
  const rawCookieHeader = (await headers()).get("cookie") ?? "";
  const tokens = getAdminCookieCandidates(cookieStore, rawCookieHeader);
  if (tokens.length === 0) return null;

  for (const token of tokens) {
    const email = readValidAdminEmail(token);
    if (!email) continue;
    // 2026-08-02 审计 2.8e：管理员会话是自签无状态 cookie，原来不查 User.disabled ——
    // 账号被禁用后管理员 cookie 还能用满 24h。这里补上（普通用户路径 auth.ts 本来就有这个检查）。
    const user = await prisma.user.findUnique({ where: { email }, select: { disabled: true } }).catch(() => null);
    if (user?.disabled) continue;
    return email;
  }

  return null;
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(adminCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !forceInsecureAuthCookie,
    path: "/admin",
    maxAge: 0,
  });

  cookieStore.set(adminCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !forceInsecureAuthCookie,
    path: "/admin",
    maxAge: 0,
    ...(authCookieDomain ? { domain: authCookieDomain } : {}),
  });
}
