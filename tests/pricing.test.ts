import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST as createOffer } from "@/app/api/offers/route";
import { makeBusiness, makeListing, actAs, call } from "./helpers";

describe("the server decides the price, never the browser", () => {
  it("'Buy now' charges the listing's asking price even if the browser sends a lower one", async () => {
    const seller = await makeBusiness();
    const buyer = await makeBusiness();
    const listing = await makeListing(seller.business.id, { askingPrice: 18, quantityAvailable: 100 });

    actAs(buyer);
    const res = await call(createOffer, {
      body: { listingId: listing.id, offeredPrice: 0.01, quantity: 100, buyNow: true },
    });

    expect(res.status).toBe(201);
    const tx = await prisma.transaction.findFirstOrThrow({ where: { listingId: listing.id } });
    expect(tx.unitPrice).toBe(18);
    expect(tx.amount).toBe(1800);
  });
});
