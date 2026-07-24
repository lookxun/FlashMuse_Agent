// 应用版本号（唯一权威）。
// 格式：四段 100 进制 vAA.BB.CC.DD（每段 0–99，满 100 向左进位），例：v1.0.0.1 → v1.0.0.2 ... v1.0.0.99 → v1.0.1.0。
// 规则：只有“部署测试服”时由 scripts/bump-version.mjs 自动最右段 +1 并写回本文件；
// 正式服部署绝不自增，只原样同步测试服代码，从而“版本号一样 = 代码一样”。
export const APP_VERSION = "v1.0.0.43";

// 是否测试服（由构建期环境变量 NEXT_PUBLIC_IS_TEST 决定；正式服不设 → false）。
export const IS_TEST_SERVER = process.env.NEXT_PUBLIC_IS_TEST === "true";

// 版本号展示文案：正式服 `版本号:vX`，测试服 `版本号(t):vX`。
export function versionLabel(): string {
  return IS_TEST_SERVER ? `版本号(t):${APP_VERSION}` : `版本号:${APP_VERSION}`;
}
