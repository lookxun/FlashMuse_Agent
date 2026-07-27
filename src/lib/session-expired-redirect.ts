/**
 * ⭐「登录状态已失效 → 直接跳首页」唯一权威（2026-07-28 新增）
 *
 * 背景（正式服 17 条红字的根因）：本项目是**单会话策略**（每次登录会删掉该用户所有旧会话），
 * 所以用户在另一台设备登录后，旧页面手里的 cookie 就作废了，但页面自己看起来一切正常
 * （头像/积分都是加载时取好的）。这时点生成，服务端查不到会话。
 *
 * 产品约定（用户 2026-07-28 明确）：**这种情况不要给任何提示**，一操作就直接跳首页、
 * 让用户看到未登录状态自己重新登录即可。所以这里只做一件事：跳首页。
 *
 * 服务端配合：`assertUserCanUseCredits` 抛 `isUnauthenticatedError` 可识别的错误，
 * 各 route 的 catch 统一回 **401**（以前回的是 500，导致本函数这类保护全都不触发）。
 *
 * ⚠️ 前端所有"读到响应就判一下"的地方都该走这里，别再各写一套 `status === 401` 判断。
 */
/** 跳首页期间用来终止后续流程的哨兵错误信息（用户看不到，跳转已经在进行）。 */
export const SESSION_EXPIRED_SILENT_ERROR = "__session_expired_redirecting__";

export function handleSessionExpiredResponse(response: { status: number }): boolean {
  if (response.status !== 401) return false;
  if (typeof window === "undefined") return true;
  window.location.replace("/");
  return true;
}
