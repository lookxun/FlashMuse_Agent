CREATE TABLE "ContentModerationRuleGroup" (
  "id" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentModerationRuleGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentModerationTerm" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "normalized" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContentModerationTerm_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentModerationEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "requestId" TEXT,
  "kind" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "matchedTerm" TEXT,
  "semanticReason" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "leaseAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentModerationEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContentModerationRuleGroup_category_key" ON "ContentModerationRuleGroup"("category");
CREATE INDEX "ContentModerationRuleGroup_enabled_idx" ON "ContentModerationRuleGroup"("enabled");
CREATE UNIQUE INDEX "ContentModerationTerm_groupId_normalized_key" ON "ContentModerationTerm"("groupId", "normalized");
CREATE INDEX "ContentModerationTerm_groupId_idx" ON "ContentModerationTerm"("groupId");
CREATE INDEX "ContentModerationEvent_status_createdAt_idx" ON "ContentModerationEvent"("status", "createdAt");
CREATE INDEX "ContentModerationEvent_category_createdAt_idx" ON "ContentModerationEvent"("category", "createdAt");
CREATE INDEX "ContentModerationEvent_userId_createdAt_idx" ON "ContentModerationEvent"("userId", "createdAt");
CREATE INDEX "ContentModerationEvent_requestId_idx" ON "ContentModerationEvent"("requestId");

ALTER TABLE "ContentModerationTerm" ADD CONSTRAINT "ContentModerationTerm_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ContentModerationRuleGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
