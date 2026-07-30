import { normalizeEmail } from "@/lib/auth";
import { getLocalEnvValue } from "@/lib/system-settings";

export const defaultUsdToCnyRate = 7.2;

/**
 * 「后台白名单」= 能进 `/admin` 的邮箱清单。
 * ⭐ 优先读 `.env.local`（后台「帐号功能管理」按账号开关时写的就是这里），
 * 再回落 `process.env`（首次部署时值在 `.env` 里）。
 * ⚠️ 本文件只在服务端使用（全部 15 个引用点都是 route / 服务端组件），可以安全读文件。
 */
export function getAdminEmails() {
  return (getLocalEnvValue("ADMIN_EMAILS") ?? process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => normalizeEmail(item))
    .filter(Boolean);
}

export function isAdminEmail(email: string) {
  return getAdminEmails().includes(normalizeEmail(email));
}
