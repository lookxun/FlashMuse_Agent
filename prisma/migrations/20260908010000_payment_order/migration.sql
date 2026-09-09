CREATE TABLE IF NOT EXISTS "PaymentOrder" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'alipay',
    "kind" TEXT NOT NULL DEFAULT 'credit_pack',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "packCny" INTEGER NOT NULL,
    "payCny" DOUBLE PRECISION NOT NULL,
    "credits" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "qrCode" TEXT,
    "alipayTradeNo" TEXT,
    "paidAt" TIMESTAMP(3),
    "creditedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "notifyPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentOrder_orderNo_key" ON "PaymentOrder"("orderNo");
CREATE INDEX IF NOT EXISTS "PaymentOrder_userId_createdAt_idx" ON "PaymentOrder"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "PaymentOrder_status_createdAt_idx" ON "PaymentOrder"("status", "createdAt");

ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
