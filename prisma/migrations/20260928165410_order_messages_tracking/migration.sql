-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "carrier" TEXT,
ADD COLUMN     "trackingNumber" TEXT;

-- CreateTable
CREATE TABLE "OrderMessage" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "senderBusinessId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderMessage_transactionId_createdAt_idx" ON "OrderMessage"("transactionId", "createdAt");

-- AddForeignKey
ALTER TABLE "OrderMessage" ADD CONSTRAINT "OrderMessage_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Records that must never be edited or deleted: order messages (evidence in
-- disputes) and moderation decisions (DSA statements of reasons). The
-- database refuses, whatever the application code does.
CREATE FUNCTION surplo_reject_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "OrderMessage_append_only" BEFORE UPDATE OR DELETE ON "OrderMessage"
  FOR EACH ROW EXECUTE FUNCTION surplo_reject_change();
CREATE TRIGGER "ModerationDecision_append_only" BEFORE UPDATE OR DELETE ON "ModerationDecision"
  FOR EACH ROW EXECUTE FUNCTION surplo_reject_change();
