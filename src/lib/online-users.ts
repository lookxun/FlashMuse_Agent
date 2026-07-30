import { prisma } from "@/lib/prisma";

/**
 * 「当前在线用户」的**唯一判定口径**（2026-07-30 从后台概览页抽出，供概览页和用户管理页共用）。
 *
 * 判定 = 满足以下三条的 Session 所属用户：
 *  ① `activeWorkspaceSeenAt` 在 1 分钟内 —— ⭐ 用的是它、**不是 `lastSeenAt`**：
 *     `lastSeenAt` 任何带登录态的请求都会刷新（哪怕只是后台某个接口），
 *     而 `activeWorkspaceSeenAt` 只由前台工作台的心跳更新（`/api/auth/workspace-instance`，
 *     `chat-workbench.tsx` 每 2 秒打一次）→ 才真正代表"人正开着页面在用"。
 *  ② session 没过期（`expiresAt > now`）；
 *  ③ 用户没被禁用。
 *
 * 为什么窗口取 1 分钟：心跳 2 秒一次，但浏览器对**后台标签页**会把定时器节流到约 1 分钟一次，
 * 取 1 分钟刚好容得下被节流的后台标签，又不会让关掉页面的人长时间"假在线"。
 *
 * ⛔ 禁止在别处另写一套在线判定（例如改用 `lastSeenAt` 或换个窗口），否则概览页和用户管理页
 *    会显示两个互相矛盾的"在线人数"。
 */
export const ONLINE_WINDOW_MS = 60_000;

export function getOnlineSessionWhere(now = new Date()) {
  return {
    activeWorkspaceSeenAt: { gte: new Date(now.getTime() - ONLINE_WINDOW_MS) },
    expiresAt: { gt: now },
    user: { is: { disabled: false } },
  };
}

/** 当前在线用户的 userId 集合。 */
export async function getOnlineUserIds(now = new Date()) {
  const sessions = await prisma.session.findMany({ where: getOnlineSessionWhere(now), select: { userId: true } });
  return new Set(sessions.map((item) => item.userId));
}
