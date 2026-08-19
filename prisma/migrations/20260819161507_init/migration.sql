-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "taxId" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "verificationNote" TEXT,
    "stripeAccountId" TEXT,
    "stripeOnboarded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platformRole" TEXT NOT NULL DEFAULT 'USER',
    "businessId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sellerBusinessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "photos" TEXT NOT NULL DEFAULT '[]',
    "quantityAvailable" INTEGER NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'ITEM',
    "condition" TEXT NOT NULL DEFAULT 'NEW',
    "originalPrice" REAL NOT NULL,
    "askingPrice" REAL NOT NULL,
    "minOrderQty" INTEGER NOT NULL DEFAULT 1,
    "fulfillment" TEXT NOT NULL DEFAULT 'BOTH',
    "locationCity" TEXT NOT NULL,
    "locationCountry" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Listing_sellerBusinessId_fkey" FOREIGN KEY ("sellerBusinessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "buyerBusinessId" TEXT NOT NULL,
    "offeredPrice" REAL NOT NULL,
    "quantity" INTEGER NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "counterPrice" REAL,
    "counterQuantity" INTEGER,
    "counterMessage" TEXT,
    "parentOfferId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Offer_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Offer_buyerBusinessId_fkey" FOREIGN KEY ("buyerBusinessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Offer_parentOfferId_fkey" FOREIGN KEY ("parentOfferId") REFERENCES "Offer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "offerId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "sellerBusinessId" TEXT NOT NULL,
    "buyerBusinessId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" REAL NOT NULL,
    "amount" REAL NOT NULL,
    "commissionRate" REAL NOT NULL,
    "commissionAmount" REAL NOT NULL,
    "sellerPayoutAmount" REAL NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "escrowStatus" TEXT NOT NULL DEFAULT 'NONE',
    "orderStatus" TEXT NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "disputeStatus" TEXT NOT NULL DEFAULT 'NONE',
    "disputeReason" TEXT,
    "disputeNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" DATETIME,
    "shippedAt" DATETIME,
    "completedAt" DATETIME,
    "cancelledAt" DATETIME,
    CONSTRAINT "Transaction_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_sellerBusinessId_fkey" FOREIGN KEY ("sellerBusinessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_buyerBusinessId_fkey" FOREIGN KEY ("buyerBusinessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionId" TEXT NOT NULL,
    "reviewerBusinessId" TEXT NOT NULL,
    "revieweeBusinessId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Review_reviewerBusinessId_fkey" FOREIGN KEY ("reviewerBusinessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Review_revieweeBusinessId_fkey" FOREIGN KEY ("revieweeBusinessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "keyword" TEXT,
    "category" TEXT,
    "location" TEXT,
    "minPrice" REAL,
    "maxPrice" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedSearch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "commissionPercent" REAL NOT NULL DEFAULT 8,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Business_verificationStatus_idx" ON "Business"("verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Listing_status_idx" ON "Listing"("status");

-- CreateIndex
CREATE INDEX "Listing_category_idx" ON "Listing"("category");

-- CreateIndex
CREATE INDEX "Listing_sellerBusinessId_idx" ON "Listing"("sellerBusinessId");

-- CreateIndex
CREATE INDEX "Offer_listingId_idx" ON "Offer"("listingId");

-- CreateIndex
CREATE INDEX "Offer_buyerBusinessId_idx" ON "Offer"("buyerBusinessId");

-- CreateIndex
CREATE INDEX "Offer_status_idx" ON "Offer"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_offerId_key" ON "Transaction"("offerId");

-- CreateIndex
CREATE INDEX "Transaction_orderStatus_idx" ON "Transaction"("orderStatus");

-- CreateIndex
CREATE INDEX "Transaction_sellerBusinessId_idx" ON "Transaction"("sellerBusinessId");

-- CreateIndex
CREATE INDEX "Transaction_buyerBusinessId_idx" ON "Transaction"("buyerBusinessId");

-- CreateIndex
CREATE INDEX "Review_revieweeBusinessId_idx" ON "Review"("revieweeBusinessId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_transactionId_reviewerBusinessId_key" ON "Review"("transactionId", "reviewerBusinessId");

-- CreateIndex
CREATE INDEX "SavedSearch_businessId_idx" ON "SavedSearch"("businessId");

-- CreateIndex
CREATE INDEX "Notification_businessId_isRead_idx" ON "Notification"("businessId", "isRead");
