"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export default function SignOutButton({ dark }: { dark?: boolean }) {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className={
        dark
          ? "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-[var(--sidebar-text)] transition-colors hover:bg-white/5 hover:text-white"
          : "text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
      }
    >
      <LogOut className="h-4 w-4" />
      Sign out
    </button>
  );
}
