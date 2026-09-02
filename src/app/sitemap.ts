import type { MetadataRoute } from "next";
import { getAllListings } from "@/lib/shop";
import { listingPath } from "@/lib/slug";
import { COLLECTION_PAGE_SIZE, collectionPagePath, getCollections } from "@/lib/collections";

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
    { url: SITE_URL,                   lastModified: now, changeFrequency: "daily",   priority: 1.0 },
    { url: `${SITE_URL}/collections`,  lastModified: now, changeFrequency: "weekly",  priority: 0.8 },
    { url: `${SITE_URL}/about`,        lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/contact`,      lastModified: now, changeFrequency: "yearly",  priority: 0.5 },
  ];

  /*
    The catalogue may be unreachable at build time (Etsy overlay down, no local data).
    A sitemap missing every product is bad, but a build failing on it is worse — so fall
    back to the static pages and let the next revalidation pick the products up.
  */
  let listings = [] as Awaited<ReturnType<typeof getAllListings>>;
  let collections: Awaited<ReturnType<typeof getCollections>> = [];
  try {
    [listings, collections] = await Promise.all([getAllListings(), getCollections()]);
  } catch {
    return staticPages;
  }

  /*
    Category views, one entry per page of each collection.

    These used to be filtered home-page URLs — `/?types=sticker` — listed at page one
    only. They are real routes now, and every page of every collection is listed, so a
    crawler reaches the deeper products of a large category from the sitemap as well as
    by following the pagination links. Search URLs still stay out: they remain noindex.
  */
  const categoryPages: MetadataRoute.Sitemap = collections.flatMap((collection) => {
    const totalPages = Math.max(1, Math.ceil(collection.count / COLLECTION_PAGE_SIZE));

    return Array.from({ length: totalPages }, (_, i) => ({
      url:             `${SITE_URL}${collectionPagePath(collection.slug, i + 1)}`,
      lastModified:    now,
      changeFrequency: "weekly" as const,
      // Page one is the ranking target; deeper pages exist mainly to be crawled through.
      priority:        i === 0 ? 0.7 : 0.4,
    }));
  });

  const productPages: MetadataRoute.Sitemap = listings.map((listing) => ({
    url: `${SITE_URL}${listingPath(listing)}`,
    // Etsy's own updated timestamp, so re-crawls track real edits rather than build time.
    lastModified:    new Date(listing.updatedAt * 1000),
    changeFrequency: "weekly",
    priority:        0.8,
  }));

  return [...staticPages, ...categoryPages, ...productPages];
}
