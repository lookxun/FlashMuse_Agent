-- 会员升级要按「当时实付金额」折算旧套餐剩余价值（不能用标价，否则首期折的钱会多退）。
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "membershipPaidCny" INTEGER NOT NULL DEFAULT 0;
