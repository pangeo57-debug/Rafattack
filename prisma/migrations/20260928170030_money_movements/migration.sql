-- CreateEnum
CREATE TYPE "MoneyMovementKind" AS ENUM ('SELLER_PAYOUT', 'BUYER_REFUND');

-- CreateEnum
CREATE TYPE "MoneyMovementStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "MoneyMovement" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "kind" "MoneyMovementKind" NOT NULL,
    "amountCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'eur',
    "destination" TEXT,
    "paymentIntentId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "status" "MoneyMovementStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "stripeObjectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoneyMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MoneyMovement_idempotencyKey_key" ON "MoneyMovement"("idempotencyKey");

-- CreateIndex
CREATE INDEX "MoneyMovement_status_idx" ON "MoneyMovement"("status");

-- CreateIndex
CREATE INDEX "MoneyMovement_transactionId_idx" ON "MoneyMovement"("transactionId");

-- AddForeignKey
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "MoneyMovement_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MoneyMovement" ADD CONSTRAINT "MoneyMovement_amount_positive" CHECK ("amountCents" IS NULL OR "amountCents" > 0);
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "MoneyMovement_target" CHECK (
  ("kind" = 'SELLER_PAYOUT' AND "destination" IS NOT NULL AND "amountCents" IS NOT NULL) OR
  ("kind" = 'BUYER_REFUND' AND "paymentIntentId" IS NOT NULL)
);
