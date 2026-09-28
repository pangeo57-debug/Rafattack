import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { prisma } from "@/lib/prisma";
import { POST as report } from "@/app/api/listings/[id]/report/route";
import { POST as decide } from "@/app/api/admin/reports/[id]/route";
import { PATCH as setVerification } from "@/app/api/admin/businesses/[id]/route";
import { PATCH as editListing } from "@/app/api/listings/[id]/route";
import ListingPage, { generateMetadata } from "@/app/(public)/listings/[id]/page";
import { sentEmails } from "./session-state";
import { makeBusiness, makeListing, actAs, call } from "./helpers";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
  useRouter: () => ({ push() {}, refresh() {}, replace() {} }),
}));

const validReport = {
  reason: "COUNTERFEIT",
  explanation: "The photos show fake branded trainers; the logo is misspelled.",
  name: "Maria P.",
  email: "maria@reporter.test",
  goodFaith: true,
};

let ip = 0;
function sendReport(listingId: string, body: unknown = validReport, fromIp = `10.0.0.${++ip}`) {
  return call(report, { params: { id: listingId }, body, headers: { "x-forwarded-for": fromIp } });
}

async function makeAdmin() {
  const a = await makeBusiness();
  await prisma.user.update({ where: { id: a.user.id }, data: { platformRole: "ADMIN" } });
  return { ...a, user: { ...a.user, platformRole: "ADMIN" } };
}

async function setup() {
  const seller = await makeBusiness();
  const buyer = await makeBusiness();
  const listing = await makeListing(seller.business.id);
  const offer = await prisma.offer.create({
    data: { listingId: listing.id, buyerBusinessId: buyer.business.id, offeredPrice: 15, quantity: 5 },
  });
  const admin = await makeAdmin();
  return { seller, buyer, listing, offer, admin };
}

const removeBody = {
  action: "REMOVE",
  ground: "TERMS_VIOLATION",
  facts: "Listing offers counterfeit branded footwear.",
  termsSection: "Terms §3",
};

describe("anyone can report a listing (DSA Art. 16)", () => {
  it("a visitor who is not signed in can report, and gets a receipt email", async () => {
    const { listing } = await setup();
    const res = await sendReport(listing.id);

    expect(res.status).toBe(201);
    const saved = await prisma.listingReport.findMany({ where: { listingId: listing.id } });
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ status: "OPEN", reason: "COUNTERFEIT", reporterEmail: "maria@reporter.test", reporterUserId: null });
    expect(sentEmails.map((e) => e.to)).toEqual(["maria@reporter.test"]);
  });

  it("rejects a report without an explanation or without the good-faith confirmation", async () => {
    const { listing } = await setup();
    expect((await sendReport(listing.id, { ...validReport, explanation: "bad" })).status).toBe(400);
    expect((await sendReport(listing.id, { ...validReport, goodFaith: false })).status).toBe(400);
    expect((await sendReport(listing.id, { ...validReport, email: "not-an-email" })).status).toBe(400);
    expect(await prisma.listingReport.count()).toBe(0);
  });

  it("a removed or non-existent listing answers the same 404", async () => {
    const { listing } = await setup();
    await prisma.listing.update({ where: { id: listing.id }, data: { status: "REMOVED" } });
    const removed = await sendReport(listing.id);
    const missing = await sendReport("does-not-exist");
    expect(removed.status).toBe(404);
    expect(missing).toEqual(removed);
  });

  it("limits how many reports one IP can send", async () => {
    const { listing } = await setup();
    const statuses = [];
    for (let i = 0; i < 6; i++) {
      statuses.push((await sendReport(listing.id, { ...validReport, email: `r${i}@x.test` }, "10.9.9.9")).status);
    }
    expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
  });
});

describe("removing a listing gives the seller a statement of reasons (DSA Art. 17)", () => {
  it("removes the listing, withdraws open offers, records the decision, tells seller and every reporter", async () => {
    const { seller, listing, offer, admin } = await setup();
    await sendReport(listing.id);
    await sendReport(listing.id, { ...validReport, email: "second@reporter.test" });
    const [first] = await prisma.listingReport.findMany({ orderBy: { createdAt: "asc" } });
    sentEmails.length = 0;

    actAs(admin);
    const res = await call(decide, { params: { id: first.id }, body: removeBody });

    expect(res.status).toBe(200);
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } })).status).toBe("REMOVED");
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).status).toBe("WITHDRAWN");
    expect(await prisma.listingReport.count({ where: { status: "OPEN" } })).toBe(0);

    const decisions = await prisma.moderationDecision.findMany();
    expect(decisions).toEqual([
      expect.objectContaining({ listingId: listing.id, reportId: first.id, adminUserId: admin.user.id, ground: "TERMS_VIOLATION" }),
    ]);

    const toSeller = sentEmails.find((e) => e.to === seller.business.contactEmail)!;
    expect(toSeller.html).toContain("Listing offers counterfeit branded footwear.");
    expect(toSeller.html).toContain("Breach of the Surplo Terms (Terms §3)");
    expect(toSeller.html).toContain("decided by a person");
    expect(toSeller.html).toContain("out-of-court");
    // The seller is not told who reported it.
    expect(toSeller.html).not.toContain("maria@reporter.test");

    expect(sentEmails.map((e) => e.to).sort()).toEqual(
      [seller.business.contactEmail, "maria@reporter.test", "second@reporter.test"].sort()
    );
    expect(await prisma.notification.count({ where: { businessId: seller.business.id, type: "LISTING_MODERATED" } })).toBe(1);
  });

  it("a double click removes once and records one decision", async () => {
    const { listing, admin } = await setup();
    await sendReport(listing.id);
    const r = await prisma.listingReport.findFirstOrThrow();

    actAs(admin);
    const results = await Promise.all([1, 2].map(() => call(decide, { params: { id: r.id }, body: removeBody })));

    expect(results.map((x) => x.status).sort()).toEqual([200, 409]);
    expect(await prisma.moderationDecision.count()).toBe(1);
  });

  it("dismissing keeps the listing up and tells the reporter why", async () => {
    const { listing, admin } = await setup();
    await sendReport(listing.id);
    const r = await prisma.listingReport.findFirstOrThrow();
    sentEmails.length = 0;

    actAs(admin);
    const res = await call(decide, { params: { id: r.id }, body: { action: "DISMISS", note: "Brand confirmed genuine via invoice." } });

    expect(res.status).toBe(200);
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } })).status).toBe("ACTIVE");
    expect(sentEmails).toEqual([expect.objectContaining({ to: "maria@reporter.test" })]);
    expect(sentEmails[0].html).toContain("Brand confirmed genuine via invoice.");
  });

  it("only an admin can decide; the reported seller cannot dismiss it", async () => {
    const { seller, listing } = await setup();
    await sendReport(listing.id);
    const r = await prisma.listingReport.findFirstOrThrow();

    actAs(seller);
    const res = await call(decide, { params: { id: r.id }, body: { action: "DISMISS", note: "Nothing wrong here at all." } });

    expect(res.status).toBe(403);
    expect((await prisma.listingReport.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("OPEN");
  });

  it("a removal without a written reason is refused", async () => {
    const { listing, admin } = await setup();
    await sendReport(listing.id);
    const r = await prisma.listingReport.findFirstOrThrow();
    actAs(admin);
    const res = await call(decide, { params: { id: r.id }, body: { ...removeBody, facts: "" } });
    expect(res.status).toBe(400);
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } })).status).toBe("ACTIVE");
  });
});

describe("a removed listing disappears for everyone but its seller", () => {
  const render = async (id: string) => renderToStaticMarkup(await ListingPage({ params: Promise.resolve({ id }) }));

  async function removed() {
    const s = await setup();
    await sendReport(s.listing.id);
    const r = await prisma.listingReport.findFirstOrThrow();
    actAs(s.admin);
    await call(decide, { params: { id: r.id }, body: removeBody });
    return s;
  }

  it("visitors and other businesses get not-found, and no title in the page metadata", async () => {
    const { listing, buyer } = await removed();
    actAs(null);
    await expect(render(listing.id)).rejects.toThrow("NEXT_NOT_FOUND");
    actAs(buyer);
    await expect(render(listing.id)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(await generateMetadata({ params: Promise.resolve({ id: listing.id }) })).toEqual({});
  });

  it("the seller can neither re-activate nor edit a removed listing (it is the evidence)", async () => {
    const { listing, seller } = await removed();
    actAs(seller);
    const reactivate = await call(editListing, { method: "PATCH", params: { id: listing.id }, body: { status: "ACTIVE" } });
    const edit = await call(editListing, { method: "PATCH", params: { id: listing.id }, body: { title: "Totally genuine jackets" } });
    expect(reactivate.status).toBe(400);
    expect(edit.status).toBe(400);
    const after = await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
    expect(after).toMatchObject({ status: "REMOVED", title: listing.title });
  });

  it("the seller sees the listing with the statement of reasons", async () => {
    const { listing, seller } = await removed();
    actAs(seller);
    const html = await render(listing.id);
    expect(html).toContain('data-testid="statement-of-reasons"');
    expect(html).toContain("Listing offers counterfeit branded footwear.");
  });
});

describe("suspending or rejecting a business requires a reason it can read", () => {
  it("refuses to suspend without a reason, and includes the reason when given", async () => {
    const { seller, admin } = await setup();
    actAs(admin);

    const bare = await call(setVerification, { method: "PATCH", params: { id: seller.business.id }, body: { verificationStatus: "SUSPENDED" } });
    expect(bare.status).toBe(400);
    expect((await prisma.business.findUniqueOrThrow({ where: { id: seller.business.id } })).verificationStatus).toBe("VERIFIED");

    const ok = await call(setVerification, {
      method: "PATCH",
      params: { id: seller.business.id },
      body: { verificationStatus: "SUSPENDED", verificationNote: "Repeated counterfeit listings." },
    });
    expect(ok.status).toBe(200);
    const note = await prisma.notification.findFirstOrThrow({ where: { businessId: seller.business.id, type: "VERIFICATION_UPDATED" } });
    expect(note.body).toContain("Repeated counterfeit listings.");
    expect(note.body).toContain("ask for a review");
  });
});
