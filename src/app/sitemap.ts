import type { MetadataRoute } from "next";
import { getAllListings } from "@/lib/shop";
import { listingPath } from "@/lib/slug";
import type { Listing } from "@/types/etsy";
import { since, NEW_ARRIVALS_DAYS } from "@/lib/arrivals";
import {
  COLLECTION_PAGE_SIZE,
  collectionPagePath,
  belongsTo,
  getCollections,
  getIntersections,
  intersectionPath,
} from "@/lib/collections";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designthathits.com";

/*
  Regenerated daily alongside the product pages. The catalogue only changes when it is
  re-synced, so there is no value in rebuilding this per request — and every request
  would otherwise load all 366 listings.
*/
export const revalidate = 86400;

/*
  `lastModified` is a claim, and a wrong one is worse than none.

  Every non-product URL here used to carry the build time, so 124 of 523 entries claimed
  to have changed on every deploy and every daily revalidation. That teaches Google to
  discount the field across the whole sitemap. A catalog-driven page now carries the
  newest `updatedAt` among the products it actually lists, and the two pages that change
  only when the code does carry nothing at all, which Google reads as unknown rather than
  as a daily edit.
*/
function newestUpdate(listings: Listing[]): Date | undefined {
  let newest = 0;
  for (const listing of listings) {
    if (listing.updatedAt > newest) newest = listing.updatedAt;
  }
  return newest > 0 ? new Date(newest * 1000) : undefined;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  /*
    No dates here. The home page and the hub get one below, from the catalog they list;
    About and Contact change only when the code does, so they carry none.
  */
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL,                   changeFrequency: "daily",   priority: 1.0 },
    { url: `${SITE_URL}/collections`,  changeFrequency: "weekly",  priority: 0.8 },
    { url: `${SITE_URL}/collections/new`, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/about`,        changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/contact`,      changeFrequency: "yearly",  priority: 0.5 },
  ];

  /*
    The catalogue may be unreachable at build time (Etsy overlay down, no local data).
    A sitemap missing every product is bad, but a build failing on it is worse — so fall
    back to the static pages and let the next revalidation pick the products up.
  */
  let listings = [] as Awaited<ReturnType<typeof getAllListings>>;
  let collections: Awaited<ReturnType<typeof getCollections>> = [];
  let intersections: Awaited<ReturnType<typeof getIntersections>> = [];
  try {
    [listings, collections, intersections] = await Promise.all([
      getAllListings(),
      getCollections(),
      getIntersections(),
    ]);
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
  // Listings but no collections means the facet source came back empty, which is how this
  // file silently lost all 50 category URLs once before.
  if (listings.length > 0 && collections.length === 0) {
    console.warn("[sitemap] Catalog has listings but no collections; category URLs omitted.");
  }

  const categoryPages: MetadataRoute.Sitemap = collections.flatMap((collection) => {
    const totalPages = Math.max(1, Math.ceil(collection.count / COLLECTION_PAGE_SIZE));
    const lastModified = newestUpdate(listings.filter((l) => belongsTo(l, collection)));

    return Array.from({ length: totalPages }, (_, i) => ({
      url:             `${SITE_URL}${collectionPagePath(collection.slug, i + 1)}`,
      ...(lastModified ? { lastModified } : {}),
      changeFrequency: "weekly" as const,
      // Page one is the ranking target; deeper pages exist mainly to be crawled through.
      priority:        i === 0 ? 0.7 : 0.4,
    }));
  });

  /*
    Product type crossed with theme. These are the strongest commercial targets on the
    site: "cat wrapping paper" is a query a small shop can rank for, where "wrapping
    paper" is not.
  */
  const intersectionPages: MetadataRoute.Sitemap = intersections.flatMap((i) => {
    const totalPages = Math.max(1, Math.ceil(i.count / COLLECTION_PAGE_SIZE));
    const members = listings.filter((l) => belongsTo(l, i.primary) && belongsTo(l, i.secondary));
    const lastModified = newestUpdate(members);

    return Array.from({ length: totalPages }, (_, n) => ({
      url:             `${SITE_URL}${intersectionPath(i.primary.slug, i.secondary.slug, n + 1)}`,
      ...(lastModified ? { lastModified } : {}),
      changeFrequency: "weekly" as const,
      priority:        n === 0 ? 0.7 : 0.4,
    }));
  });

  const productPages: MetadataRoute.Sitemap = listings.map((listing) => ({
    url: `${SITE_URL}${listingPath(listing)}`,
    // Etsy's own updated timestamp, so re-crawls track real edits rather than build time.
    lastModified:    new Date(listing.updatedAt * 1000),
    changeFrequency: "weekly",
    priority:        0.8,
    /*
      The product photo, declared as an image sitemap entry.

      On a storefront the image is the product, and Google Images is a real entry point
      for gift and print-on-demand searches. The photos are hosted on Etsy's CDN rather
      than this domain, which is exactly the case image sitemaps exist for: without this
      Google has to infer them from the page markup, and off-domain images are the ones it
      is least willing to index on inference alone.
    */
    ...(listing.image ? { images: [listing.image.url] } : {}),
  }));

  // The home grid and the hub both list the catalog, so the newest product is when they
  // last genuinely changed.
  const catalogUpdated = newestUpdate(listings);
  const catalogDriven = new Set([SITE_URL, `${SITE_URL}/collections`]);

  /*
    New Arrivals is dated from its own members, not from the catalog as a whole. Editing a
    listing older than the window changes the catalog's newest `updatedAt` but not this
    page, and claiming otherwise is the kind of lastmod that teaches Google to ignore the
    field.
  */
  const arrivalsUpdated = newestUpdate(since(listings, NEW_ARRIVALS_DAYS));
  const datedStatic: MetadataRoute.Sitemap = staticPages.map((entry) => {
    if (entry.url === `${SITE_URL}/collections/new`) {
      return arrivalsUpdated ? { ...entry, lastModified: arrivalsUpdated } : entry;
    }
    return catalogUpdated && catalogDriven.has(entry.url) ? { ...entry, lastModified: catalogUpdated } : entry;
  });

  return [...datedStatic, ...categoryPages, ...intersectionPages, ...productPages];
}
