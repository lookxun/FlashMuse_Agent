CREATE TABLE "AnnouncementHistory" (
  "id" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnnouncementHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnnouncementHistory_version_key" ON "AnnouncementHistory"("version");
CREATE INDEX "AnnouncementHistory_createdAt_idx" ON "AnnouncementHistory"("createdAt");
