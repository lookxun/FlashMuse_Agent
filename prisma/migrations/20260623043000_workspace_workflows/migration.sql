-- Add explicit workspace source markers for history, billing, and media.
ALTER TABLE "WorkspaceSession" ADD COLUMN "workspaceKind" TEXT NOT NULL DEFAULT 'conversation';
CREATE INDEX "WorkspaceSession_workspaceKind_idx" ON "WorkspaceSession"("workspaceKind");

CREATE TABLE "WorkspaceWorkflow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "workspaceKind" TEXT NOT NULL DEFAULT 'workflow',
    "title" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "canvasJson" JSONB NOT NULL,
    "usageSummary" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceWorkflow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceWorkflow_userId_workflowId_key" ON "WorkspaceWorkflow"("userId", "workflowId");
CREATE INDEX "WorkspaceWorkflow_workspaceKind_idx" ON "WorkspaceWorkflow"("workspaceKind");
CREATE INDEX "WorkspaceWorkflow_userId_updatedAt_idx" ON "WorkspaceWorkflow"("userId", "updatedAt");
CREATE INDEX "WorkspaceWorkflow_userId_deletedAt_updatedAt_idx" ON "WorkspaceWorkflow"("userId", "deletedAt", "updatedAt");
ALTER TABLE "WorkspaceWorkflow" ADD CONSTRAINT "WorkspaceWorkflow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CreditLedger" ADD COLUMN "workspaceKind" TEXT;
ALTER TABLE "CreditLedger" ADD COLUMN "workspaceId" TEXT;
UPDATE "CreditLedger"
SET
  "workspaceKind" = CASE
    WHEN "metadata"->>'creditSource' LIKE 'workflow_%' THEN 'workflow'
    WHEN "conversationId" IS NOT NULL THEN 'conversation'
    ELSE NULL
  END,
  "workspaceId" = "conversationId"
WHERE "workspaceId" IS NULL;
CREATE INDEX "CreditLedger_workspaceKind_workspaceId_idx" ON "CreditLedger"("workspaceKind", "workspaceId");

ALTER TABLE "MediaAsset" ADD COLUMN "workspaceKind" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN "workspaceId" TEXT;
UPDATE "MediaAsset"
SET
  "workspaceKind" = CASE
    WHEN "workflowId" IS NOT NULL THEN 'workflow'
    WHEN "conversationId" IS NOT NULL THEN 'conversation'
    WHEN "sourceKind" IN ('asset_generation_image', 'asset_generation_video', 'asset_upload_image') THEN 'asset_generation'
    ELSE NULL
  END,
  "workspaceId" = COALESCE("workflowId", "conversationId")
WHERE "workspaceKind" IS NULL;
CREATE INDEX "MediaAsset_userId_workspaceKind_createdAt_idx" ON "MediaAsset"("userId", "workspaceKind", "createdAt");
