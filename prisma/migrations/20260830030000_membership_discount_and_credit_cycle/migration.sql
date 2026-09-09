-- 首期折「每帐号1次」必须落库（光写文案没用，到期重买还能再享折）。
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "membershipDiscountUsed" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
-- 会员每月积分的下次发放时间（到点才发，发一次推 30 天）。
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "membershipCreditsCycleAt" TIMESTAMP(3);
