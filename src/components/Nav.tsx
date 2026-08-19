import Link from "next/link";
import { auth } from "@/auth";
import SignOutButton from "@/components/SignOutButton";
import { prisma } from "@/lib/prisma";

export default async function Nav() {
  const session = await auth();
  let unreadCount = 0;
  if (session?.user?.businessId) {
    unreadCount = await prisma.notification.count({
      where: { businessId: session.user.businessId, isRead: false },
    });
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
            Overstock<span className="text-indigo-600">Trade</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 sm:flex">
            <Link href="/listings" className="hover:text-slate-900">
              Browse
            </Link>
            {session?.user && (
              <>
                <Link href="/dashboard" className="hover:text-slate-900">
                  Dashboard
                </Link>
                <Link href="/dashboard/offers" className="hover:text-slate-900">
                  Offers
                </Link>
                <Link href="/dashboard/orders" className="hover:text-slate-900">
                  Orders
                </Link>
              </>
            )}
            {session?.user?.platformRole === "ADMIN" && (
              <Link href="/admin" className="hover:text-slate-900">
                Admin
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {session?.user ? (
            <>
              <Link
                href="/dashboard/notifications"
                className="relative text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1 text-xs font-semibold text-white">
                    {unreadCount}
                  </span>
                )}
              </Link>
              <Link
                href="/listings/new"
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                + List inventory
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
