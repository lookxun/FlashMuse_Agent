ALTER TABLE "WorkspaceWorkflow" ADD COLUMN "workflowCode" TEXT;
ALTER TABLE "WorkspaceWorkflow" ADD COLUMN "nextImageNumber" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "WorkspaceWorkflow" ADD COLUMN "nextVideoNumber" INTEGER NOT NULL DEFAULT 1;
