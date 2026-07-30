import { normalizeEmail } from "@/lib/auth";
import { PERMANENT_ADMIN_EMAILS } from "@/lib/permanent-admins";
import { getLocalEnvValue } from "@/lib/system-settings";

export const defaultUsdToCnyRate = 7.2;

/**
 * 「后台白名单」= 能进 `/admin` 的邮箱清单。
 * ⭐ 优先读 `.env.local`（后台「帐号功能管理」按账号开关时写的就是这里），
 * 再回落 `process.env`（首次部署时值在 `.env` 里）。
 * ⭐⭐ 无论 env 里有没有，`PERMANENT_ADMIN_EMAILS` 一定在结果里（**永不失去后台入口**，
 * 详见 `lib/permanent-admins.ts` 顶部注释）。
 * ⚠️ 本文件只在服务端使用（全部引用点都是 route / 服务端组件），可以安全读文件。
 */
export function getAdminEmails() {
  const fromEnv = (getLocalEnvValue("ADMIN_EMAILS") ?? process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => normalizeEmail(item))
    .filter(Boolean);
  return [...new Set([...PERMANENT_ADMIN_EMAILS, ...fromEnv])];
}

export function isAdminEmail(email: string) {
  return getAdminEmails().includes(normalizeEmail(email));
}
