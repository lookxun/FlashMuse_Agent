ALTER TABLE "WorkspaceSession" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "WorkspaceWorkflow" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "WorkspaceSession_userId_archivedAt_updatedAt_idx" ON "WorkspaceSession"("userId", "archivedAt", "updatedAt");
CREATE INDEX "WorkspaceWorkflow_userId_archivedAt_updatedAt_idx" ON "WorkspaceWorkflow"("userId", "archivedAt", "updatedAt");
