import Link from "next/link";
import { PackageSearch, ArrowRight } from "lucide-react";
import { ui } from "@/lib/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <PackageSearch className="h-7 w-7" />
      </span>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-zinc-900">
        Page not found
      </h1>
      <p className="mt-2 max-w-sm text-sm text-zinc-500">
        This listing may have sold out or the page moved. Let&apos;s get you back
        to browsing.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/listings" className={`${ui.btnPrimary} px-5 py-2.5 text-base`}>
          Browse inventory
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link href="/" className={`${ui.btnSecondary} px-5 py-2.5 text-base`}>
          Go home
        </Link>
      </div>
    </div>
  );
}
