-- 词库显示顺序列。
-- ⛔ 原来后台按 createdAt 排序，但整批词是同一事务插入、createdAt 完全相同 → 排序不确定，
--    同一份数据在测试服和正式服显示成两种顺序（2026-08-11 真实事故）。
ALTER TABLE "ContentModerationTerm" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- 老数据（sortOrder 全 0）用 createdAt + id 兜底，保证至少是确定性的顺序。
CREATE INDEX "ContentModerationTerm_groupId_sortOrder_idx" ON "ContentModerationTerm"("groupId", "sortOrder");
