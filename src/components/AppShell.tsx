import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SidebarNav from "@/components/SidebarNav";
import PageTransition from "@/components/PageTransition";
import ResendVerificationBanner from "@/components/ResendVerificationBanner";

export default async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [business, user] = await Promise.all([
    session.user.businessId
      ? prisma.business.findUnique({ where: { id: session.user.businessId } })
      : Promise.resolve(null),
    prisma.user.findUnique({ where: { id: session.user.id } }),
  ]);

  const unreadCount = session.user.businessId
    ? await prisma.notification.count({
        where: { businessId: session.user.businessId, isRead: false },
      })
    : 0;

  return (
    <div className="min-h-screen bg-zinc-50">
      <SidebarNav
        businessName={business?.name ?? "Your business"}
        verificationStatus={business?.verificationStatus ?? "PENDING"}
        isAdmin={session.user.platformRole === "ADMIN"}
        unreadCount={unreadCount}
      />
      <div className="lg:pl-64">
        {user && !user.emailVerified && <ResendVerificationBanner />}
        <PageTransition>{children}</PageTransition>
      </div>
    </div>
  );
}
