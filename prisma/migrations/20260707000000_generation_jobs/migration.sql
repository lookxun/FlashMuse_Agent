-- CreateTable
CREATE TABLE "GenerationJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "flow" TEXT,
    "creditSource" TEXT,
    "model" TEXT,
    "provider" TEXT,
    "prompt" TEXT,
    "settingsJson" JSONB,
    "referenceImages" JSONB,
    "referenceVideos" JSONB,
    "referenceAudios" JSONB,
    "referenceMode" TEXT,
    "conversationId" TEXT,
    "conversationTitle" TEXT,
    "messageId" TEXT,
    "workflowId" TEXT,
    "workflowNodeId" TEXT,
    "itemIndex" INTEGER,
    "count" INTEGER NOT NULL DEFAULT 1,
    "providerTaskId" TEXT,
    "resultUrls" JSONB,
    "resultDimensions" JSONB,
    "posterUrl" TEXT,
    "usageJson" JSONB,
    "creditJson" JSONB,
    "metadataJson" JSONB,
    "extraJson" JSONB,
    "error" TEXT,
    "errorCode" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GenerationJob_requestId_key" ON "GenerationJob"("requestId");

-- CreateIndex
CREATE INDEX "GenerationJob_status_kind_nextRunAt_idx" ON "GenerationJob"("status", "kind", "nextRunAt");

-- CreateIndex
CREATE INDEX "GenerationJob_userId_status_updatedAt_idx" ON "GenerationJob"("userId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "GenerationJob_workflowId_idx" ON "GenerationJob"("workflowId");

-- CreateIndex
CREATE INDEX "GenerationJob_conversationId_idx" ON "GenerationJob"("conversationId");
