-- CreateTable
CREATE TABLE "GenerationEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "requestId" TEXT,
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'conversation',
    "model" TEXT,
    "provider" TEXT,
    "status" TEXT NOT NULL,
    "failureReason" TEXT,
    "failureCode" TEXT,
    "moderation" BOOLEAN NOT NULL DEFAULT false,
    "durationMs" INTEGER,
    "referenceImageCount" INTEGER NOT NULL DEFAULT 0,
    "referenceVideoCount" INTEGER NOT NULL DEFAULT 0,
    "referenceAudioCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'image',
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "bytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GenerationEvent_requestId_kind_key" ON "GenerationEvent"("requestId", "kind");

-- CreateIndex
CREATE INDEX "GenerationEvent_createdAt_idx" ON "GenerationEvent"("createdAt");

-- CreateIndex
CREATE INDEX "GenerationEvent_kind_status_createdAt_idx" ON "GenerationEvent"("kind", "status", "createdAt");

-- CreateIndex
CREATE INDEX "GenerationEvent_model_createdAt_idx" ON "GenerationEvent"("model", "createdAt");

-- CreateIndex
CREATE INDEX "GenerationEvent_source_createdAt_idx" ON "GenerationEvent"("source", "createdAt");

-- CreateIndex
CREATE INDEX "UploadEvent_createdAt_idx" ON "UploadEvent"("createdAt");

-- CreateIndex
CREATE INDEX "UploadEvent_status_createdAt_idx" ON "UploadEvent"("status", "createdAt");
