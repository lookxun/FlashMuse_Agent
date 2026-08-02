-- 2026-08-02 审计 1.5：热点查询补索引（全部为纯新增索引，无破坏性语句）。
-- ⚠️ 最后一条 text_pattern_ops 索引 Prisma schema 表达不了，只存在于本迁移 SQL 里；
--    以后本地跑 `migrate dev` 若提示 drift，就是这一条，属预期。

-- UserAssetState：media-assets.ts 的去重 updateMany({ where: { mediaAssetId } }) 与级联删除不再全表扫
CREATE INDEX "UserAssetState_mediaAssetId_idx" ON "UserAssetState"("mediaAssetId");

-- MediaAsset：generation-jobs 起名候选名定点检查 / canonicalize 的 url OR 分支 / 资产库按 firstSeenAt 排序
CREATE INDEX "MediaAsset_userId_systemName_idx" ON "MediaAsset"("userId", "systemName");
CREATE INDEX "MediaAsset_userId_url_idx" ON "MediaAsset"("userId", "url");
CREATE INDEX "MediaAsset_userId_firstSeenAt_idx" ON "MediaAsset"("userId", "firstSeenAt");

-- Session：后台 DAU/WAU/MAU 与在线判定不再每次全表扫
CREATE INDEX "Session_lastSeenAt_idx" ON "Session"("lastSeenAt");

-- CreditLedger：workspace-state GET 每次都跑的两条用户账单过滤
CREATE INDEX "CreditLedger_userId_direction_workspaceKind_workspaceId_idx" ON "CreditLedger"("userId", "direction", "workspaceKind", "workspaceId");
CREATE INDEX "CreditLedger_userId_direction_conversationId_idx" ON "CreditLedger"("userId", "direction", "conversationId");

-- GenerationJob：requestId LIKE 'xxx:%' 前缀匹配（generation-jobs.ts 查同请求的全部子任务）
CREATE INDEX "GenerationJob_requestId_text_pattern_idx" ON "GenerationJob"("requestId" text_pattern_ops);
