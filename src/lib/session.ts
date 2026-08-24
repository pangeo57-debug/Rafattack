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
