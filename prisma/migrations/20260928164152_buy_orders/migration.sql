-- CreateEnum
CREATE TYPE "BuyOrderStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED', 'FILLED', 'EXPIRED');

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "buyOrderId" TEXT;

-- CreateTable
CREATE TABLE "BuyOrder" (
    "id" TEXT NOT NULL,
    "buyerBusinessId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "conditions" "ListingCondition"[],
    "maxUnitPriceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "quantityWanted" INTEGER NOT NULL,
    "remainingQty" INTEGER NOT NULL,
    "minLotQty" INTEGER NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT,
    "status" "BuyOrderStatus" NOT NULL DEFAULT 'ACTIVE',
    "pausedReason" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BuyOrder_status_category_idx" ON "BuyOrder"("status", "category");

-- CreateIndex
CREATE INDEX "BuyOrder_buyerBusinessId_idx" ON "BuyOrder"("buyerBusinessId");

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_buyOrderId_fkey" FOREIGN KEY ("buyOrderId") REFERENCES "BuyOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyOrder" ADD CONSTRAINT "BuyOrder_buyerBusinessId_fkey" FOREIGN KEY ("buyerBusinessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Guards the database enforces even if application code has a bug.
ALTER TABLE "BuyOrder" ADD CONSTRAINT "BuyOrder_price_positive" CHECK ("maxUnitPriceCents" > 0);
ALTER TABLE "BuyOrder" ADD CONSTRAINT "BuyOrder_qty_bounds" CHECK ("remainingQty" >= 0 AND "remainingQty" <= "quantityWanted" AND "minLotQty" >= 1 AND "minLotQty" <= "quantityWanted");
ALTER TABLE "BuyOrder" ADD CONSTRAINT "BuyOrder_has_conditions" CHECK (cardinality("conditions") > 0);
