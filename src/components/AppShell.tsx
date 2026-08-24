import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SidebarNav from "@/components/SidebarNav";
import PageTransition from "@/components/PageTransition";

export default async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const business = session.user.businessId
    ? await prisma.business.findUnique({ where: { id: session.user.businessId } })
    : null;

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
        <PageTransition>{children}</PageTransition>
      </div>
    </div>
  );
}
