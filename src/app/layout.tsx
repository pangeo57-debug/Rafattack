import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import Nav from "@/components/Nav";
import Providers from "@/components/Providers";
import CapacitorBridge from "@/components/CapacitorBridge";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Overstock Trade — B2B overstock marketplace",
  description:
    "Buy and sell excess and overstock inventory between businesses, with escrow-protected payments.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Overstock Trade",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <Providers>
          <CapacitorBridge />
          <Nav />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-slate-200 bg-white py-6 text-center text-sm text-slate-500">
            <p>Overstock Trade &mdash; a B2B marketplace for excess inventory.</p>
            <p className="mt-2 flex justify-center gap-4">
              <Link href="/privacy" className="hover:text-slate-700 hover:underline">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-slate-700 hover:underline">
                Terms of Service
              </Link>
            </p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
