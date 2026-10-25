-- CreateEnum
CREATE TYPE "OrderActor" AS ENUM ('BUYER', 'SELLER', 'ADMIN', 'SYSTEM', 'PAYMENT_PROVIDER');

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "actor" "OrderActor" NOT NULL,
    "actorUserId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderEvent_transactionId_createdAt_idx" ON "OrderEvent"("transactionId", "createdAt");

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER "OrderEvent_append_only" BEFORE UPDATE OR DELETE ON "OrderEvent"
  FOR EACH ROW EXECUTE FUNCTION surplo_reject_change();

-- Existing orders: we can't reconstruct their past, so record where each one
-- stands now and say so, rather than inventing a history.
INSERT INTO "OrderEvent" ("id", "transactionId", "fromStatus", "toStatus", "actor", "reason", "createdAt")
SELECT 'backfill_' || t."id", t."id", NULL, t."orderStatus", 'SYSTEM',
       'Status when the audit log was introduced; earlier history was not recorded.', CURRENT_TIMESTAMP
FROM "Transaction" t;
