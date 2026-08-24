import Link from "next/link";
import { Bell, LayoutDashboard, Plus, Package } from "lucide-react";
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
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-zinc-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-white">
              <Package className="h-4 w-4" />
            </span>
            Surp<span className="text-brand">lo</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-zinc-600 sm:flex">
            <Link href="/listings" className="transition-colors hover:text-zinc-900">
              Browse
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {session?.user ? (
            <>
              <Link
                href="/dashboard/notifications"
                className="relative rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white ring-2 ring-white">
                    {unreadCount}
                  </span>
                )}
              </Link>
              <Link
                href="/listings/new"
                className="hidden items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-brand-hover active:scale-[0.98] sm:inline-flex"
              >
                <Plus className="h-4 w-4" />
                List inventory
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-all hover:bg-zinc-50 active:scale-[0.98]"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900">
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-brand px-3.5 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-brand-hover active:scale-[0.98]"
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
