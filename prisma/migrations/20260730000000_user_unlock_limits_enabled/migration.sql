-- 「解除限制」从全局开关（.env.local 的 BYTEPLUS_UNLOCK_LIMITS）改成按账号开关。
--
-- ⭐ 默认 false：按用户 2026-07-30 的要求，三个帐号功能开关**一律默认关闭**，
-- 需要谁用就去后台「帐号功能管理」单独开。
-- ⛔ 不要在这里加 `UPDATE "User" SET "unlockLimitsEnabled" = true`（曾经加过又去掉）——
--    那会在部署那一刻给全站所有人开上解除限制，与"默认关闭"的产品意图相反。
-- ⚠️ 副作用要知情：部署到服务器后，原来靠全局开关吃着"专属 Endpoint ID"的存量用户
--    会回到"公开模型名"，直到管理员在后台按账号打开。这是用户明确要的行为。
ALTER TABLE "User" ADD COLUMN "unlockLimitsEnabled" BOOLEAN NOT NULL DEFAULT false;
