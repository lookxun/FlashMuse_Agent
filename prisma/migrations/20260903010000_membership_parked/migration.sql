-- 低升高：高级马上用，标准剩的天数先搁着；高级到期再切回标准。各档各续各的。
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "membershipParkedTier" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "membershipParkedPeriod" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "membershipParkedRemainingDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "membershipParkedPaidCny" INTEGER NOT NULL DEFAULT 0;
