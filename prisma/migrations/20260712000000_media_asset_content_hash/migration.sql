-- Add content hash column for byte-identical upload dedup.
ALTER TABLE "MediaAsset" ADD COLUMN "contentHash" TEXT;
CREATE INDEX "MediaAsset_userId_contentHash_idx" ON "MediaAsset"("userId", "contentHash");
