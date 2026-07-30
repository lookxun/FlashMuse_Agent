import { prisma } from "@/lib/prisma";
import { getAdminSystemSettings } from "@/lib/system-settings";

/**
 * 按账号的功能开关（后台「帐号功能管理」页维护）。
 *
 * ⭐ 唯一入口：所有链路（图片 / 视频 / 文本，对话流 · 工作流 · Agent · 通用模式）
 * 一律走这里读，禁止在各 route 里自己 `prisma.user.findUnique` 拼一份
 * —— 历史踩过 `getBytePlusProviderKey` 复制三份漏修的坑。
 */

/**
 * 取某个用户的「解除限制」状态。
 *
 * - 有 userId → 读 `User.unlockLimitsEnabled`（按账号，2026-07-30 起的正式口径）。
 * - 没有 userId（未登录 / 拿不到 session 的边角调用）→ 回落到全局
 *   `.env.local` 的 `BYTEPLUS_UNLOCK_LIMITS`，保持改造前的行为。
 * - 查库失败 → 同样回落全局，绝不因为这个开关把生成整单弄挂。
 */
export async function resolveUnlockLimitsForUser(userId?: string | null) {
  const globalFallback = getAdminSystemSettings().bytePlusUnlockLimits;
  if (!userId) return globalFallback;
  const user = await prisma.user
    .findUnique({ where: { id: userId }, select: { unlockLimitsEnabled: true } })
    .catch(() => null);
  if (!user) return globalFallback;
  return user.unlockLimitsEnabled;
}
