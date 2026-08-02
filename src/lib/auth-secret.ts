// AUTH_SECRET 的唯一读取入口（2026-08-02 审计 2.8f）。
// ⛔ 历史问题：auth.ts / admin-auth.ts / upload-token.ts 三处各自写
//   `process.env.AUTH_SECRET || "flashmuse-local-dev-secret-change-me"` ——
//   任何环境忘配 AUTH_SECRET，攻击者就能用公开默认值**自签管理员 cookie**。
// 规则：生产环境没配 = 直接抛错（启动即失败，不许静默兜底）；本地开发才允许用默认值。

const LOCAL_DEV_FALLBACK_SECRET = "flashmuse-local-dev-secret-change-me";

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret) return secret;
  // ⭐ 构建期例外：`next build` 收集页面数据时会 evaluate 路由模块，而 AUTH_SECRET 只在运行时由
  //   挂载的 .env.local 提供 → 构建期允许兜底（产物不含密钥，运行时代码路径仍会执行下面的生产断言）。
  if (process.env.NEXT_PHASE === "phase-production-build") return LOCAL_DEV_FALLBACK_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET 未配置：生产环境必须在 .env.local 里设置 AUTH_SECRET（会话签名密钥）");
  }
  return LOCAL_DEV_FALLBACK_SECRET;
}
