CREATE TABLE "GptImagePromptOptimizationCase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workflowId" TEXT,
    "workflowNodeId" TEXT,
    "mediaAssetId" TEXT,
    "imageUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "sourceModel" TEXT NOT NULL,
    "optimizerModel" TEXT NOT NULL,
    "attemptsUsed" INTEGER NOT NULL,
    "originalPrompt" TEXT NOT NULL,
    "optimizedPrompt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GptImagePromptOptimizationCase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GptImagePromptOptimizationCase_userId_createdAt_idx" ON "GptImagePromptOptimizationCase"("userId", "createdAt");
CREATE INDEX "GptImagePromptOptimizationCase_workflowId_idx" ON "GptImagePromptOptimizationCase"("workflowId");
CREATE INDEX "GptImagePromptOptimizationCase_workflowNodeId_idx" ON "GptImagePromptOptimizationCase"("workflowNodeId");
CREATE INDEX "GptImagePromptOptimizationCase_mediaAssetId_idx" ON "GptImagePromptOptimizationCase"("mediaAssetId");
CREATE INDEX "GptImagePromptOptimizationCase_sourceModel_createdAt_idx" ON "GptImagePromptOptimizationCase"("sourceModel", "createdAt");

ALTER TABLE "GptImagePromptOptimizationCase" ADD CONSTRAINT "GptImagePromptOptimizationCase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
