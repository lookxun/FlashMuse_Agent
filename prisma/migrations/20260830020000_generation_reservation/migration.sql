-- 生成额度预占表：让「并发上限」和「积分够不够」能在一个事务里原子判定。
-- 详见 lib/generation-quota.ts。expiresAt 是防泄漏兜底，绝不允许把用户永久卡住。
CREATE TABLE IF NOT EXISTS "GenerationReservation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "estCredits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenerationReservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GenerationReservation_requestId_key" ON "GenerationReservation"("requestId");
CREATE INDEX IF NOT EXISTS "GenerationReservation_userId_expiresAt_idx" ON "GenerationReservation"("userId", "expiresAt");
CREATE INDEX IF NOT EXISTS "GenerationReservation_expiresAt_idx" ON "GenerationReservation"("expiresAt");
