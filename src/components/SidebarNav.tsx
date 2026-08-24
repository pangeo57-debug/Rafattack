"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Search,
  Package,
  Handshake,
  ShoppingBag,
  Bookmark,
  Bell,
  Building2,
  UserCircle,
  ShieldCheck,
  Users,
  Receipt,
  AlertTriangle,
  Settings,
  Menu,
  X,
  Plus,
} from "lucide-react";
import SignOutButton from "@/components/SignOutButton";
import { badgeColor } from "@/lib/ui";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
};

const mainNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/listings", label: "Browse", icon: Search },
  { href: "/dashboard/listings", label: "My Listings", icon: Package },
  { href: "/dashboard/offers", label: "Offers", icon: Handshake },
  { href: "/dashboard/orders", label: "Orders", icon: ShoppingBag },
  { href: "/dashboard/saved-searches", label: "Saved Searches", icon: Bookmark },
];

const accountNav: NavItem[] = [
  { href: "/dashboard/business", label: "Business Profile", icon: Building2 },
  { href: "/dashboard/account", label: "Account", icon: UserCircle },
];

const adminNav: NavItem[] = [
  { href: "/admin", label: "Overview", icon: ShieldCheck },
  { href: "/admin/businesses", label: "Businesses", icon: Users },
  { href: "/admin/transactions", label: "Transactions", icon: Receipt },
  { href: "/admin/disputes", label: "Disputes", icon: AlertTriangle },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function NavLink({ item, pathname, onClick }: { item: NavItem; pathname: string; onClick?: () => void }) {
  const active = item.href === "/dashboard" || item.href === "/admin"
    ? pathname === item.href
    : pathname.startsWith(item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
        active
          ? "bg-white/10 text-white"
          : "text-[var(--sidebar-text)] hover:bg-white/5 hover:text-white"
      }`}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active-pill"
          className="absolute inset-y-0 left-0 w-0.5 rounded-full bg-brand"
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
        />
      )}
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {item.badge ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--sidebar-text)]/60">
      {children}
    </p>
  );
}

function SidebarContent({
  pathname,
  businessName,
  verificationStatus,
  isAdmin,
  unreadCount,
  onNavigate,
}: {
  pathname: string;
  businessName: string;
  verificationStatus: string;
  isAdmin: boolean;
  unreadCount: number;
  onNavigate?: () => void;
}) {
  const items = mainNav.map((item) =>
    item.href === "/dashboard/notifications" ? item : item
  );
  const notifItem: NavItem = { href: "/dashboard/notifications", label: "Notifications", icon: Bell, badge: unreadCount };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
          <Package className="h-4.5 w-4.5" />
        </span>
        <span className="text-base font-semibold tracking-tight text-white">
          Overstock<span className="text-brand">Trade</span>
        </span>
      </div>

      <div className="mx-3 mb-2 rounded-lg bg-white/5 px-3 py-2.5">
        <p className="truncate text-sm font-medium text-white">{businessName}</p>
        <span
          className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${badgeColor(
            verificationStatus
          )}`}
        >
          {verificationStatus}
        </span>
      </div>

      <Link
        href="/listings/new"
        onClick={onNavigate}
        className="mx-3 mb-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-brand-hover active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" />
        List inventory
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <SectionLabel>Marketplace</SectionLabel>
        <div className="space-y-0.5">
          {items.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} onClick={onNavigate} />
          ))}
          <NavLink item={notifItem} pathname={pathname} onClick={onNavigate} />
        </div>

        <SectionLabel>Account</SectionLabel>
        <div className="space-y-0.5">
          {accountNav.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} onClick={onNavigate} />
          ))}
        </div>

        {isAdmin && (
          <>
            <SectionLabel>Admin</SectionLabel>
            <div className="space-y-0.5">
              {adminNav.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} onClick={onNavigate} />
              ))}
            </div>
          </>
        )}
      </nav>

      <div className="border-t border-white/10 px-4 py-3">
        <SignOutButton dark />
      </div>
    </div>
  );
}

export default function SidebarNav({
  businessName,
  verificationStatus,
  isAdmin,
  unreadCount,
}: {
  businessName: string;
  verificationStatus: string;
  isAdmin: boolean;
  unreadCount: number;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col lg:bg-[var(--sidebar-bg)]">
        <SidebarContent
          pathname={pathname}
          businessName={businessName}
          verificationStatus={verificationStatus}
          isAdmin={isAdmin}
          unreadCount={unreadCount}
        />
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur-md lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold text-zinc-900">
          Overstock<span className="text-brand">Trade</span>
        </span>
        <Link href="/dashboard/notifications" className="relative rounded-lg p-2 text-zinc-600 hover:bg-zinc-100">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white ring-2 ring-white">
              {unreadCount}
            </span>
          )}
        </Link>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[var(--sidebar-bg)] lg:hidden"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-4 rounded-lg p-1.5 text-[var(--sidebar-text)] hover:bg-white/10 hover:text-white"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
              <SidebarContent
                pathname={pathname}
                businessName={businessName}
                verificationStatus={verificationStatus}
                isAdmin={isAdmin}
                unreadCount={unreadCount}
                onNavigate={() => setMobileOpen(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
