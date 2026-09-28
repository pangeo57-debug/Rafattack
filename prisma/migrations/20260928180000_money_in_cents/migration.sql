-- Money moves from floating point euros to integer cents, and commission from
-- a float percentage to integer basis points (8% = 800). Existing values are
-- converted exactly: float -> numeric -> x100 -> rounded half away from zero.

-- Listing
ALTER TABLE "Listing" ADD COLUMN "originalPriceCents" INTEGER, ADD COLUMN "askingPriceCents" INTEGER;
UPDATE "Listing" SET
  "originalPriceCents" = ROUND("originalPrice"::numeric * 100),
  "askingPriceCents"   = ROUND("askingPrice"::numeric * 100);
ALTER TABLE "Listing"
  ALTER COLUMN "originalPriceCents" SET NOT NULL,
  ALTER COLUMN "askingPriceCents" SET NOT NULL,
  DROP COLUMN "originalPrice",
  DROP COLUMN "askingPrice";

-- Offer
ALTER TABLE "Offer" ADD COLUMN "offeredPriceCents" INTEGER, ADD COLUMN "counterPriceCents" INTEGER;
UPDATE "Offer" SET
  "offeredPriceCents" = ROUND("offeredPrice"::numeric * 100),
  "counterPriceCents" = ROUND("counterPrice"::numeric * 100);
ALTER TABLE "Offer"
  ALTER COLUMN "offeredPriceCents" SET NOT NULL,
  DROP COLUMN "offeredPrice",
  DROP COLUMN "counterPrice";

-- Transaction
ALTER TABLE "Transaction"
  ADD COLUMN "unitPriceCents" INTEGER,
  ADD COLUMN "amountCents" INTEGER,
  ADD COLUMN "commissionBps" INTEGER,
  ADD COLUMN "commissionCents" INTEGER,
  ADD COLUMN "sellerPayoutCents" INTEGER;
UPDATE "Transaction" SET
  "unitPriceCents"    = ROUND("unitPrice"::numeric * 100),
  "amountCents"       = ROUND("amount"::numeric * 100),
  "commissionBps"     = ROUND("commissionRate"::numeric * 100),
  "commissionCents"   = ROUND("commissionAmount"::numeric * 100),
  "sellerPayoutCents" = ROUND("sellerPayoutAmount"::numeric * 100);
ALTER TABLE "Transaction"
  ALTER COLUMN "unitPriceCents" SET NOT NULL,
  ALTER COLUMN "amountCents" SET NOT NULL,
  ALTER COLUMN "commissionBps" SET NOT NULL,
  ALTER COLUMN "commissionCents" SET NOT NULL,
  ALTER COLUMN "sellerPayoutCents" SET NOT NULL,
  DROP COLUMN "unitPrice",
  DROP COLUMN "amount",
  DROP COLUMN "commissionRate",
  DROP COLUMN "commissionAmount",
  DROP COLUMN "sellerPayoutAmount";

-- SavedSearch
ALTER TABLE "SavedSearch" ADD COLUMN "minPriceCents" INTEGER, ADD COLUMN "maxPriceCents" INTEGER;
UPDATE "SavedSearch" SET
  "minPriceCents" = ROUND("minPrice"::numeric * 100),
  "maxPriceCents" = ROUND("maxPrice"::numeric * 100);
ALTER TABLE "SavedSearch" DROP COLUMN "minPrice", DROP COLUMN "maxPrice";

-- PlatformSetting
ALTER TABLE "PlatformSetting" ADD COLUMN "commissionBps" INTEGER NOT NULL DEFAULT 800;
UPDATE "PlatformSetting" SET "commissionBps" = ROUND("commissionPercent"::numeric * 100);
ALTER TABLE "PlatformSetting" DROP COLUMN "commissionPercent";

-- Old rows were computed with floats and may be a cent off. Make them
-- consistent before the invariants are switched on, without changing what
-- anyone was charged or paid: the buyer's charge (amount) and the seller's
-- payout stay as they were, and a rounding cent goes to the commission.
UPDATE "Transaction" SET "commissionCents" = "amountCents" - "sellerPayoutCents"
  WHERE "commissionCents" + "sellerPayoutCents" <> "amountCents";
-- A price below half a cent (possible before, when prices weren't limited
-- to two decimals) becomes 1 cent rather than 0.
UPDATE "Listing" SET "askingPriceCents" = 1 WHERE "askingPriceCents" < 1;
UPDATE "Listing" SET "originalPriceCents" = 1 WHERE "originalPriceCents" < 1;
UPDATE "Offer" SET "offeredPriceCents" = 1 WHERE "offeredPriceCents" < 1;
UPDATE "Offer" SET "counterPriceCents" = 1 WHERE "counterPriceCents" < 1;

-- Invariants the database keeps from now on, for every row.
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_prices_positive"
  CHECK ("askingPriceCents" > 0 AND "originalPriceCents" > 0);
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_price_positive"
  CHECK ("offeredPriceCents" > 0 AND ("counterPriceCents" IS NULL OR "counterPriceCents" > 0));
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_split_adds_up"
  CHECK ("commissionCents" + "sellerPayoutCents" = "amountCents" AND "commissionCents" >= 0 AND "sellerPayoutCents" >= 0);
ALTER TABLE "PlatformSetting" ADD CONSTRAINT "PlatformSetting_commission_range"
  CHECK ("commissionBps" >= 0 AND "commissionBps" <= 10000);

-- amount = unit price x quantity: checked when an order is created. Not a
-- CHECK constraint, because some old orders had sub-cent unit prices and
-- would then refuse every later status change.
CREATE FUNCTION surplo_check_order_amount() RETURNS trigger AS $$
BEGIN
  IF NEW."amountCents" <> NEW."unitPriceCents" * NEW."quantity" THEN
    RAISE EXCEPTION 'order amount % is not unit price % x quantity %', NEW."amountCents", NEW."unitPriceCents", NEW."quantity";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Transaction_amount_is_price_times_qty" BEFORE INSERT ON "Transaction"
  FOR EACH ROW EXECUTE FUNCTION surplo_check_order_amount();
