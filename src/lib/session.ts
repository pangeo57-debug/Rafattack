import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}

export async function requireBusiness() {
  const user = await requireUser();
  if (!user.businessId) redirect("/onboarding");
  const business = await prisma.business.findUnique({
    where: { id: user.businessId },
  });
  if (!business || business.deletedAt) redirect("/login");
  return { user, business };
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.platformRole !== "ADMIN") redirect("/dashboard");
  return user;
}

// Single source of truth for "is this business blocked from listing, offering,
// or paying". Every API route that lets a business list, offer, or pay must
// call this — a route that reimplements the check inline will eventually
// drift from the others (one already had, letting a suspended business
// reactivate its own removed listing).
export async function isBusinessSuspended(businessId: string): Promise<boolean> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { verificationStatus: true },
  });
  return business?.verificationStatus === "SUSPENDED";
}
