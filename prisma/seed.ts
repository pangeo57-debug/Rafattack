import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.platformSetting.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", commissionPercent: 8 },
  });

  const adminEmail = "admin@surplo.test";
  const adminPasswordHash = await bcrypt.hash("admin12345", 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Platform Admin",
      passwordHash: adminPasswordHash,
      platformRole: "ADMIN",
      emailVerified: new Date(),
    },
  });
  console.log(`Admin user ready: ${adminEmail} / admin12345`);

  const sellerEmail = "seller@surplo.test";
  let seller = await prisma.user.findUnique({ where: { email: sellerEmail } });
  if (!seller) {
    const business = await prisma.business.create({
      data: {
        name: "Northgate Apparel Co.",
        type: "RETAILER",
        category: "Apparel & Footwear",
        country: "United States",
        city: "Columbus",
        taxId: "US-DEMO-0001",
        contactEmail: sellerEmail,
        verificationStatus: "VERIFIED",
      },
    });
    seller = await prisma.user.create({
      data: {
        email: sellerEmail,
        name: "Sam Seller",
        passwordHash: await bcrypt.hash("seller12345", 10),
        businessId: business.id,
        emailVerified: new Date(),
      },
    });
    await prisma.listing.create({
      data: {
        sellerBusinessId: business.id,
        title: "End-of-season winter jackets — mixed sizes",
        description:
          "200 unisex winter jackets, past-season colors, tags attached. Great margin for outlet resale.",
        category: "Apparel & Footwear",
        quantityAvailable: 200,
        unit: "ITEM",
        condition: "NEW",
        originalPrice: 65,
        askingPrice: 18,
        minOrderQty: 25,
        fulfillment: "BOTH",
        locationCity: "Columbus",
        locationCountry: "United States",
      },
    });
    console.log(`Demo seller ready: ${sellerEmail} / seller12345`);
  }

  const buyerEmail = "buyer@surplo.test";
  const buyer = await prisma.user.findUnique({ where: { email: buyerEmail } });
  if (!buyer) {
    const business = await prisma.business.create({
      data: {
        name: "Liquidate Right Outlets",
        type: "LIQUIDATOR",
        category: "Apparel & Footwear",
        country: "United States",
        city: "Dallas",
        taxId: "US-DEMO-0002",
        contactEmail: buyerEmail,
        verificationStatus: "VERIFIED",
      },
    });
    await prisma.user.create({
      data: {
        email: buyerEmail,
        name: "Bailey Buyer",
        passwordHash: await bcrypt.hash("buyer12345", 10),
        businessId: business.id,
        emailVerified: new Date(),
      },
    });
    console.log(`Demo buyer ready: ${buyerEmail} / buyer12345`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
