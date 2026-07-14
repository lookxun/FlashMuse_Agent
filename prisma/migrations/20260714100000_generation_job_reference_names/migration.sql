-- Store a url -> display-name map for a generation job's reference inputs (images/videos/audios),
-- so "使用提示词" can restore reference thumbnails + blue @mentions without a per-click name lookup.
ALTER TABLE "GenerationJob" ADD COLUMN "referenceNames" JSONB;
