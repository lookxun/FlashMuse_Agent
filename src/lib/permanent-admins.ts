/**
 * ⭐⭐ **永久后台白名单**（2026-07-30 用户拍板）：这些邮箱**永远能进 `/admin`，谁也关不掉**。
 *
 * 为什么要有它：「后台白名单」存在 `.env.local` 的 `ADMIN_EMAILS` 里，
 * 而后台「帐号功能管理」页能改它 → 理论上存在"手滑把最后一个管理员也关掉 =
 * 全世界都进不了后台、只能 ssh 上服务器改文件才能救回来"的死局。
 * 加一个永不可摘的账号，保证后台永远有人能进。
 *
 * ⛔ **这里是唯一来源**，下面四个咽喉都必须走它，别在任何地方另写一份邮箱硬编码：
 *   ① `lib/admin.ts` 的 `getAdminEmails()` —— 无条件把它并进清单，
 *      **即使 `.env.local` 被改坏 / 写没了也还是管理员**（最底层兜底）
 *   ② `lib/system-settings.ts` 的 `updateAdminEmailWhitelist()` —— 落盘时强制补回，防止被写掉
 *   ③ `admin/api/users/admin-whitelist/route.ts` —— 单账号关闭时直接拒绝并给明确报错
 *   ④ `admin/api/users/feature-bulk/route.ts` —— 「一键全关」时保留它
 * 前端那一行的开关也会被置灰（`admin/page.tsx` 算出 `adminWhitelistLocked` 传给面板，
 * **前端不硬编码邮箱**）。
 *
 * ⚠️ 本文件**故意零 import** —— `lib/admin.ts` 依赖 `lib/system-settings.ts`（读 `.env.local`），
 * 若把常量放在这两个文件里的任意一个，另一个 import 它就会形成循环依赖。
 */
export const PERMANENT_ADMIN_EMAILS = ["lookxun@163.com"];

/** 是否是永久管理员（大小写/空格无关）。 */
export function isPermanentAdminEmail(email: string | null | undefined) {
  return PERMANENT_ADMIN_EMAILS.includes(String(email ?? "").trim().toLowerCase());
}
