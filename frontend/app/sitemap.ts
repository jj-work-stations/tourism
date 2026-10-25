import type { MetadataRoute } from "next";

import { serverFetch } from "@/lib/api";
import type { Destination, Page } from "@/lib/types";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://seir.ir").replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/destinations`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/search`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/assistant`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/support`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];

  const data = await serverFetch<Page<Destination>>("/destinations", { page_size: 100 });
  const destinations: MetadataRoute.Sitemap = (data?.items ?? []).map((destination) => ({
    url: `${SITE_URL}/destinations/${destination.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...destinations];
}
