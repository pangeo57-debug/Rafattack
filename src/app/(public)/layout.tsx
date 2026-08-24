import Link from "next/link";
import Nav from "@/components/Nav";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-zinc-200 bg-white py-6 text-center text-sm text-zinc-500">
        <p>Overstock Trade &mdash; a B2B marketplace for excess inventory.</p>
        <p className="mt-2 flex justify-center gap-4">
          <Link href="/privacy" className="hover:text-zinc-700 hover:underline">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-zinc-700 hover:underline">
            Terms of Service
          </Link>
        </p>
      </footer>
    </div>
  );
}
