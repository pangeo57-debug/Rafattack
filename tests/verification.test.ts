import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { PATCH as decide } from "@/app/api/admin/businesses/[id]/route";
import { PATCH as editBusiness } from "@/app/api/business/route";
import { DELETE as deleteAccount } from "@/app/api/account/route";
import { makeBusiness, actAs, call } from "./helpers";

const DOC = "data:image/jpeg;base64,/9j/AAAA";

async function withDocs(status: "PENDING" | "VERIFIED" = "PENDING") {
  const b = await makeBusiness();
  await prisma.business.update({
    where: { id: b.business.id },
    data: { verificationStatus: status, verificationDocuments: JSON.stringify([DOC, DOC]) },
  });
  return b;
}

async function admin() {
  const a = await makeBusiness();
  return { ...a, user: { ...a.user, platformRole: "ADMIN" } };
}

const docsOf = async (id: string) => JSON.parse((await prisma.business.findUniqueOrThrow({ where: { id } })).verificationDocuments);

describe("ID documents are deleted once they have served their purpose", () => {
  it.each([
    ["VERIFIED", undefined],
    ["REJECTED", "Registration certificate is unreadable."],
    ["SUSPENDED", "Tax ID does not match the registry."],
  ])("deciding %s deletes the uploaded documents", async (verificationStatus, verificationNote) => {
    const b = await withDocs();
    actAs(await admin());
    const res = await call(decide, { method: "PATCH", params: { id: b.business.id }, body: { verificationStatus, verificationNote } });
    expect(res.status).toBe(200);
    expect(await docsOf(b.business.id)).toEqual([]);
  });

  it("deleting the account deletes the documents too", async () => {
    const b = await withDocs();
    actAs(b);
    const res = await call(deleteAccount, { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(await docsOf(b.business.id)).toEqual([]);
  });
});

describe("the Verified badge only vouches for the details that were checked", () => {
  it("changing the tax ID of a verified business sends it back for verification", async () => {
    const b = await withDocs("VERIFIED");
    actAs(b);
    const res = await call(editBusiness, { method: "PATCH", body: { taxId: "EL999999999" } });

    expect(res.status).toBe(200);
    expect(res.json.reverificationRequired).toBe(true);
    const after = await prisma.business.findUniqueOrThrow({ where: { id: b.business.id } });
    expect(after.verificationStatus).toBe("PENDING");
    expect(await prisma.notification.count({ where: { businessId: b.business.id, title: "Verification needed again" } })).toBe(1);
  });

  it("changing the name does too, but a phone number or a re-save of the same name does not", async () => {
    const b = await withDocs("VERIFIED");
    actAs(b);
    await call(editBusiness, { method: "PATCH", body: { contactPhone: "+30 210 0000000", name: `${b.business.name} ` } });
    expect((await prisma.business.findUniqueOrThrow({ where: { id: b.business.id } })).verificationStatus).toBe("VERIFIED");

    await call(editBusiness, { method: "PATCH", body: { name: "Famous Brand SA" } });
    expect((await prisma.business.findUniqueOrThrow({ where: { id: b.business.id } })).verificationStatus).toBe("PENDING");
  });

  it("editing the profile never lifts a suspension", async () => {
    const b = await makeBusiness();
    await prisma.business.update({ where: { id: b.business.id }, data: { verificationStatus: "SUSPENDED" } });
    actAs(b);
    await call(editBusiness, { method: "PATCH", body: { name: "Fresh Start Ltd", taxId: "EL111" } });
    expect((await prisma.business.findUniqueOrThrow({ where: { id: b.business.id } })).verificationStatus).toBe("SUSPENDED");
  });

  it("refuses an empty tax ID", async () => {
    const b = await makeBusiness();
    actAs(b);
    const res = await call(editBusiness, { method: "PATCH", body: { taxId: "   " } });
    expect(res.status).toBe(400);
    expect((await prisma.business.findUniqueOrThrow({ where: { id: b.business.id } })).taxId).toBe(b.business.taxId);
  });
});
