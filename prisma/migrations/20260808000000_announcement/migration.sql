CREATE TABLE "Announcement" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL DEFAULT 'global',
  "content" TEXT NOT NULL DEFAULT '',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Announcement_key_key" ON "Announcement"("key");
