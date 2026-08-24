import { createHash, randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { resolve4, resolve6, resolveMx } from "dns/promises";
import { promisify } from "util";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getAuthSecret } from "@/lib/auth-secret";

const scrypt = promisify(scryptCallback);

export const authCookieName = "flashmuse-session";
const sessionMaxAgeSeconds = 24 * 60 * 60;
const authSecret = getAuthSecret();
const forceInsecureAuthCookie = process.env.FORCE_INSECURE_AUTH_COOKIE === "true";
const authCookieDomain = process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined;

/**
 * ⭐⭐ `Session.lastSeenAt` 的写入节流（2026-07-31 用户拍板做 A+B 两条）。
 *
 * 背景：`getCurrentSession()` 是**全站每个登录态接口的第一件事**。它原来干两件事：
 *   ① 查库确认"你是谁"（省不掉）；② `await` 写一次 `lastSeenAt`（纯记录，跟"你是谁"无关）。
 * 数据库在新加坡，国内用户一个来回几百毫秒 → ② 那一下**每次点击都在白等**。
 *
 * 两条优化：
 * - **A：不再 `await` 那次写**（fire-and-forget）。写照样发生，只是不占请求的等待时间 →
 *   全站每个接口立刻省一个 DB 往返。
 * - **B：60 秒内不重复写同一个 session**。用户疯狂点击时一分钟能发几十个请求、
 *   往同一行写几十次同一分钟的时间戳，纯属浪费。
 *
 * ⛔ 影响面（改这里前必读，2026-07-31 已跟用户确认过）：
 * - 后台绿色「在线」胶囊 / 「在线用户」数字用的是 **`activeWorkspaceSeenAt`，不是 `lastSeenAt`**
 *   （唯一口径写在 `online-users.ts` 顶部）→ **完全不受影响**。
 * - 用到 `lastSeenAt` 的是后台「今日活跃 / 7天 / 30天活跃用户」与用户详情页「最后活跃时间」，
 *   都是**按天/按分钟**粒度 → 最多晚 60 秒，看不出差别。
 * - ⛔ 别把节流窗口调大到分钟级以上（会开始影响"今日活跃"的跨零点归属）。
 * - ⛔ 别把 `refreshCurrentSessionActivity()`（`/api/auth/activity` 的续期心跳）也节流掉：
 *   它除了写 `lastSeenAt` 还要**延长 `expiresAt` 并重发 cookie**，漏一次会让用户提前掉线。
 *
 * 进程内内存表，多进程/重启后各自重新计时 —— 无所谓，最坏就是多写一次。
 */
const lastSeenWriteThrottleMs = 60 * 1000;
const lastSeenWriteAt = new Map<string, number>();
const SESSION_IDENTITY_TTL_MS = 10 * 60 * 1000;

type CachedAuthSession = NonNullable<Awaited<ReturnType<typeof readSessionFromDatabase>>>;
const sessionIdentityCache = new Map<string, { session: CachedAuthSession; expiresAtMs: number }>();

function pruneSessionIdentityCache(now: number) {
  if (sessionIdentityCache.size <= 2000) return;
  for (const [key, item] of sessionIdentityCache) {
    if (item.expiresAtMs <= now) sessionIdentityCache.delete(key);
  }
}

function rememberSessionIdentity(hashes: string[], session: CachedAuthSession, now: number) {
  pruneSessionIdentityCache(now);
  const entry = { session, expiresAtMs: now + SESSION_IDENTITY_TTL_MS };
  for (const hash of hashes) sessionIdentityCache.set(hash, entry);
}

function forgetSessionIdentityByHashes(hashes: string[]) {
  for (const hash of hashes) sessionIdentityCache.delete(hash);
}

function forgetSessionIdentityByUserId(userId: string) {
  for (const [key, item] of sessionIdentityCache) {
    if (item.session.userId === userId) sessionIdentityCache.delete(key);
  }
}

async function readSessionFromDatabase(hashes: string[]) {
  const sessions = await prisma.session.findMany({
    where: { tokenHash: { in: hashes } },
    include: { user: true },
  });
  const now = new Date();
  const session = sessions.find((item) => item.expiresAt > now && !item.user.disabled) ?? null;
  const expiredSessionIds = sessions.filter((item) => item.expiresAt <= now).map((item) => item.id);
  if (expiredSessionIds.length > 0) {
    void prisma.session.deleteMany({ where: { id: { in: expiredSessionIds } } }).catch(() => null);
  }
  return session;
}

function shouldWriteLastSeen(sessionId: string, now: number) {
  const previous = lastSeenWriteAt.get(sessionId);
  if (previous !== undefined && now - previous < lastSeenWriteThrottleMs) return false;
  // 防内存无限增长：条目多了先清掉已过期的（登出/换设备的老 session 再也不会来）。
  if (lastSeenWriteAt.size > 5000) {
    for (const [id, at] of lastSeenWriteAt) {
      if (now - at >= lastSeenWriteThrottleMs) lastSeenWriteAt.delete(id);
    }
  }
  lastSeenWriteAt.set(sessionId, now);
  return true;
}

/** 心跳续期走的是另一条路（要改 expiresAt + 重发 cookie），写完把节流计时对齐，避免紧接着又写一次。 */
export function markSessionLastSeenWritten(sessionId: string, now = Date.now()) {
  lastSeenWriteAt.set(sessionId, now);
}

export function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function generateUserId() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const id = `ID_${randomInt(100000, 1000000)}`;
    const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return id;
  }

  throw new Error("无法生成唯一用户ID");
}

export async function canEmailDomainReceiveMail(email: string) {
  const domain = email.split("@")[1];
  if (!domain) return false;

  try {
    const records = await resolveMx(domain);
    return records.length > 0;
  } catch {
    try {
      const addresses = await resolve4(domain);
      if (addresses.length > 0) return true;
    } catch {
      // Ignore and try IPv6 below.
    }

    try {
      const addresses = await resolve6(domain);
      return addresses.length > 0;
    } catch {
      return false;
    }
  }
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function hashVerificationCode(email: string, code: string) {
  return createHash("sha256").update(`${authSecret}:email-code:${email}:${code}`).digest("hex");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(`${authSecret}:session:${token}`).digest("hex");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, hash] = storedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !hash) return false;

  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export async function createUserSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionMaxAgeSeconds * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.session.deleteMany({ where: { userId } });
    await tx.session.create({
      data: {
        userId,
        tokenHash: hashSessionToken(token),
        expiresAt,
      },
    });
  });
  forgetSessionIdentityByUserId(userId);

  const cookieStore = await cookies();
  setAuthCookie(cookieStore, token, sessionMaxAgeSeconds);
}

function getCookieHeaderValues(rawCookieHeader: string, name: string) {
  return rawCookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`))
    .map((part) => part.slice(name.length + 1))
    .filter((value) => value.length > 0);
}

function getAuthCookieCandidates(cookieStore: Awaited<ReturnType<typeof cookies>>, rawCookieHeader: string) {
  const values = cookieStore
    .getAll(authCookieName)
    .map((cookie) => cookie.value)
    .filter((value) => value.length > 0);

  return Array.from(new Set([...values, ...getCookieHeaderValues(rawCookieHeader, authCookieName)]));
}

function setAuthCookie(cookieStore: Awaited<ReturnType<typeof cookies>>, token: string, maxAge: number) {
  if (authCookieDomain) {
    cookieStore.set(authCookieName, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" && !forceInsecureAuthCookie,
      path: "/",
      maxAge: 0,
    });
  }

  cookieStore.set(authCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !forceInsecureAuthCookie,
    path: "/",
    maxAge,
    ...(authCookieDomain ? { domain: authCookieDomain } : {}),
  });
}

async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.set(authCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !forceInsecureAuthCookie,
    path: "/",
    maxAge: 0,
  });

  cookieStore.set(authCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !forceInsecureAuthCookie,
    path: "/",
    maxAge: 0,
    ...(authCookieDomain ? { domain: authCookieDomain } : {}),
  });
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const rawCookieHeader = (await headers()).get("cookie") ?? "";
  const tokens = getAuthCookieCandidates(cookieStore, rawCookieHeader);
  if (tokens.length === 0) return null;

  const hashes = tokens.map((token) => hashSessionToken(token));
  const nowMs = Date.now();
  for (const hash of hashes) {
    const cached = sessionIdentityCache.get(hash);
    if (!cached || cached.expiresAtMs <= nowMs) continue;
    if (cached.session.expiresAt.getTime() <= nowMs || cached.session.user.disabled) {
      sessionIdentityCache.delete(hash);
      continue;
    }
    if (shouldWriteLastSeen(cached.session.id, nowMs)) {
      void prisma.session.update({ where: { id: cached.session.id }, data: { lastSeenAt: new Date() } }).catch(() => null);
    }
    return cached.session;
  }

  const session = await readSessionFromDatabase(hashes);
  if (!session) {
    forgetSessionIdentityByHashes(hashes);
    await clearAuthCookie();
    return null;
  }

  rememberSessionIdentity(hashes, session, nowMs);
  if (shouldWriteLastSeen(session.id, nowMs)) {
    void prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => null);
  }
  return session;
}

export async function refreshCurrentSessionActivity() {
  const cookieStore = await cookies();
  const rawCookieHeader = (await headers()).get("cookie") ?? "";
  const tokens = getAuthCookieCandidates(cookieStore, rawCookieHeader);
  if (tokens.length === 0) return false;

  const tokenByHash = new Map(tokens.map((token) => [hashSessionToken(token), token]));
  const sessions = await prisma.session.findMany({
    where: { tokenHash: { in: Array.from(tokenByHash.keys()) } },
    include: { user: true },
  });
  const now = new Date();
  const session = sessions.find((item) => item.expiresAt > now && !item.user.disabled) ?? null;

  const expiredSessionIds = sessions.filter((item) => item.expiresAt <= now).map((item) => item.id);
  if (expiredSessionIds.length > 0) await prisma.session.deleteMany({ where: { id: { in: expiredSessionIds } } }).catch(() => null);

  if (!session) {
    await clearAuthCookie();
    return false;
  }

  const token = tokenByHash.get(session.tokenHash);
  if (!token) return false;
  // ⛔ 这条**必须 await、必须每次都写**：它同时延长 `expiresAt` 并重发 cookie，
  // 漏一次会让用户提前掉线。只是写完顺手对齐上面那套节流计时，避免紧接着的接口又写一次。
  await prisma.session.update({ where: { id: session.id }, data: { expiresAt: new Date(Date.now() + sessionMaxAgeSeconds * 1000), lastSeenAt: new Date() } }).catch(() => null);
  markSessionLastSeenWritten(session.id, Date.now());
  setAuthCookie(cookieStore, token, sessionMaxAgeSeconds);
  return true;
}

export async function getCurrentUser() {
  const session = await getCurrentSession();
  return session?.user ?? null;
}

export async function clearCurrentSession() {
  const cookieStore = await cookies();
  const rawCookieHeader = (await headers()).get("cookie") ?? "";
  const tokens = getAuthCookieCandidates(cookieStore, rawCookieHeader);

  if (tokens.length > 0) {
    const hashes = tokens.map(hashSessionToken);
    forgetSessionIdentityByHashes(hashes);
    await prisma.session.deleteMany({ where: { tokenHash: { in: hashes } } }).catch(() => null);
  }

  await clearAuthCookie();
}
