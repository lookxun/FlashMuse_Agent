CREATE TABLE "AnnouncementDismissal" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnnouncementDismissal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnnouncementDismissal_userId_version_key" ON "AnnouncementDismissal"("userId", "version");
CREATE INDEX "AnnouncementDismissal_version_idx" ON "AnnouncementDismissal"("version");
