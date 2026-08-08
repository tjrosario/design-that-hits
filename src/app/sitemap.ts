import type { MetadataRoute } from "next";
import { getAllListings, getFacetGroups } from "@/lib/shop";
import { listingPath } from "@/lib/slug";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designthathits.com";

/*
  Regenerated daily alongside the product pages. The catalogue only changes when it is
  re-synced, so there is no value in rebuilding this per request — and every request
  would otherwise load all 366 listings.
*/
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL,               lastModified: now, changeFrequency: "daily",   priority: 1.0 },
    { url: `${SITE_URL}/about`,    lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/contact`,  lastModified: now, changeFrequency: "yearly",  priority: 0.5 },
  ];

  /*
    The catalogue may be unreachable at build time (Etsy overlay down, no local data).
    A sitemap missing every product is bad, but a build failing on it is worse — so fall
    back to the static pages and let the next revalidation pick the products up.
  */
  let listings = [] as Awaited<ReturnType<typeof getAllListings>>;
  let facets: Awaited<ReturnType<typeof getFacetGroups>> | null = null;
  try {
    [listings, facets] = await Promise.all([getAllListings(), getFacetGroups()]);
  } catch {
    return staticPages;
  }

  /*
    Category views. These are filtered home-page URLs rather than dedicated routes, and
    they are the middle rung of every product's breadcrumb, so they belong in the
    sitemap. Search URLs deliberately stay out — they remain noindex.
  */
  const categoryPages: MetadataRoute.Sitemap = [
    ...facets.productTypes.map((t) => `/?types=${t.id}`),
    ...facets.themes.map((t) => `/?themes=${t.id}`),
  ].map((path) => ({
    url:             `${SITE_URL}${path}`,
    lastModified:    now,
    changeFrequency: "weekly" as const,
    priority:        0.6,
  }));

  const productPages: MetadataRoute.Sitemap = listings.map((listing) => ({
    url: `${SITE_URL}${listingPath(listing)}`,
    // Etsy's own updated timestamp, so re-crawls track real edits rather than build time.
    lastModified:    new Date(listing.updatedAt * 1000),
    changeFrequency: "weekly",
    priority:        0.8,
  }));

  return [...staticPages, ...categoryPages, ...productPages];
}
