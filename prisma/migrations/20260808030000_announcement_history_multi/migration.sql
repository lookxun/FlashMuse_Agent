-- 改为"每次开启记一条"：去掉 version 唯一约束，改成普通索引。
DROP INDEX IF EXISTS "AnnouncementHistory_version_key";
CREATE INDEX IF NOT EXISTS "AnnouncementHistory_version_idx" ON "AnnouncementHistory"("version");
