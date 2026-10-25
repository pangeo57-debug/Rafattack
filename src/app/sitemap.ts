import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: appUrl, changeFrequency: "daily", priority: 1 },
    { url: `${appUrl}/listings`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${appUrl}/signup`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${appUrl}/trust-safety`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${appUrl}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${appUrl}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const listings = await prisma.listing.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, updatedAt: true },
    take: 5000,
  });
  const listingPages: MetadataRoute.Sitemap = listings.map((l) => ({
    url: `${appUrl}/listings/${l.id}`,
    lastModified: l.updatedAt,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  const businesses = await prisma.business.findMany({
    where: { verificationStatus: "VERIFIED", deletedAt: null },
    select: { id: true, updatedAt: true },
    take: 5000,
  });
  const businessPages: MetadataRoute.Sitemap = businesses.map((b) => ({
    url: `${appUrl}/businesses/${b.id}`,
    lastModified: b.updatedAt,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticPages, ...listingPages, ...businessPages];
}
