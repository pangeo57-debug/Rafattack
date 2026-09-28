import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { POST as createListing } from "@/app/api/listings/route";
import { PATCH as editListing } from "@/app/api/listings/[id]/route";
import { PATCH as editBusiness } from "@/app/api/business/route";
import { makeBusiness, makeListing, actAs, call } from "./helpers";

/** A real phone-style JPEG: 40x30, rotated by EXIF, with GPS and owner info. */
async function photoWithLocation() {
  const buf = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#c33" } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .withExifMerge({
      IFD0: { Artist: "owner-home-secret", Make: "PhoneCo" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "37/1 58/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "23/1 43/1 0/1" },
    })
    .toBuffer();
  return { buf, dataUrl: `data:image/jpeg;base64,${buf.toString("base64")}` };
}

const listingBody = (photos: string[]) => ({
  title: "Box of mugs",
  description: "Two hundred ceramic mugs.",
  category: "Home & Kitchen",
  photos,
  quantityAvailable: 200,
  unit: "ITEM",
  condition: "NEW",
  originalPrice: 5,
  askingPrice: 2,
  minOrderQty: 10,
  fulfillment: "BOTH",
  locationCity: "Athens",
  locationCountry: "Greece",
});

const decode = (dataUrl: string) => Buffer.from(dataUrl.split(",")[1], "base64");

describe("uploaded photos lose their location data", () => {
  it("control: the test photo really does carry GPS and owner info", async () => {
    const { buf } = await photoWithLocation();
    const meta = await sharp(buf).metadata();
    expect(meta.exif).toBeDefined();
    expect(meta.orientation).toBe(6);
    expect(buf.includes("owner-home-secret")).toBe(true);
  });

  it("a new listing's photos are stored without EXIF, upright, as JPEG", async () => {
    const seller = await makeBusiness();
    actAs(seller);
    const { dataUrl } = await photoWithLocation();

    const res = await call(createListing, { body: listingBody([dataUrl]) });

    expect(res.status).toBe(201);
    const stored: string[] = JSON.parse((await prisma.listing.findUniqueOrThrow({ where: { id: res.json.id as string } })).photos);
    const out = decode(stored[0]);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.exif).toBeUndefined();
    expect(out.includes("owner-home-secret")).toBe(false);
    expect(out.includes("PhoneCo")).toBe(false);
    // Orientation 6 was applied to the pixels before the tag was dropped.
    expect([meta.width, meta.height]).toEqual([30, 40]);
  });

  it("editing a listing's photos cleans them too", async () => {
    const seller = await makeBusiness();
    const listing = await makeListing(seller.business.id);
    actAs(seller);
    const { dataUrl } = await photoWithLocation();

    const res = await call(editListing, { method: "PATCH", params: { id: listing.id }, body: { photos: [dataUrl] } });

    expect(res.status).toBe(200);
    const stored: string[] = JSON.parse((await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } })).photos);
    expect((await sharp(decode(stored[0])).metadata()).exif).toBeUndefined();
  });

  it("verification documents are cleaned the same way", async () => {
    const b = await makeBusiness();
    actAs(b);
    const { dataUrl } = await photoWithLocation();

    const res = await call(editBusiness, { method: "PATCH", body: { verificationDocuments: [dataUrl] } });

    expect(res.status).toBe(200);
    const docs: string[] = JSON.parse((await prisma.business.findUniqueOrThrow({ where: { id: b.business.id } })).verificationDocuments);
    expect(decode(docs[0]).includes("owner-home-secret")).toBe(false);
  });
});

describe("only real images are accepted", () => {
  const attempts: [string, string][] = [
    ["an external link (would leak every viewer's IP)", "https://tracker.example/pixel.png"],
    ["a script disguised as a JPEG", `data:image/jpeg;base64,${Buffer.from("<script>alert(1)</script>").toString("base64")}`],
    ["an SVG (can carry script)", `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString("base64")}`],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a truncated JPEG header", `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0x00]).toString("base64")}`],
  ];

  it.each(attempts)("refuses %s, and stores nothing", async (_label, photo) => {
    const seller = await makeBusiness();
    actAs(seller);
    const res = await call(createListing, { body: listingBody([photo]) });
    expect(res.status).toBe(400);
    expect(await prisma.listing.count()).toBe(0);
  });

  it("refuses a bad verification document without touching the existing ones", async () => {
    const b = await makeBusiness();
    await prisma.business.update({ where: { id: b.business.id }, data: { verificationDocuments: '["data:image/jpeg;base64,old"]' } });
    actAs(b);
    const res = await call(editBusiness, { method: "PATCH", body: { verificationDocuments: ["https://tracker.example/x.png"] } });
    expect(res.status).toBe(400);
    expect((await prisma.business.findUniqueOrThrow({ where: { id: b.business.id } })).verificationDocuments).toBe('["data:image/jpeg;base64,old"]');
  });
});
