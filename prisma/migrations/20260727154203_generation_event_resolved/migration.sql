-- AlterTable
ALTER TABLE "GenerationEvent" ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedNote" TEXT;

-- CreateIndex
CREATE INDEX "GenerationEvent_status_resolvedAt_idx" ON "GenerationEvent"("status", "resolvedAt");
