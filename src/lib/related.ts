/**
 * The rows of other products shown under a product.
 *
 * Replaces a single unlabelled grid of four. That row had no stated reason for being
 * there, so it read as filler, and four links is a thin crawl path out of a page when
 * there are 404 of them.
 *
 * Each row now has a reason a shopper can act on, drawn from the product's own facets:
 * the occasion it is for, the look it has, the thing it is. Rows are deduplicated
 * against each other and against the product itself, so a listing never appears twice on
 * one page, and a row is dropped rather than padded when it cannot be filled.
 */

import { getAllListings } from "@/lib/shop";
import { belongsTo, collectionPath, getCollections } from "@/lib/collections";
import { occasionLabel, productTypeLabel, themeLabel } from "@/lib/facets";
import { primaryOccasion, primaryTheme } from "@/lib/facets";
import type { Listing } from "@/types/etsy";

export interface Rail {
  /** Stable across renders, so it can key a list. */
  id: string;
  heading: string;
  /** The collection this row is a sample of, for the "see all" link. */
  href: string;
  listings: Listing[];
}

/** Enough to be worth scrolling, short enough to stay a sample rather than a page. */
const PER_RAIL = 10;

/** Below this a row looks broken rather than curated, so it is dropped. */
const MIN_PER_RAIL = 4;

export async function relatedRails(listing: Listing): Promise<Rail[]> {
  const [all, collections] = await Promise.all([getAllListings(), getCollections()]);
  const bySlug = new Map(collections.map((c) => [c.slug, c]));

  const pool = all.filter((l) => l.id !== listing.id && l.image);
  // Newest first, so a row refreshes as the catalog grows rather than showing the same
  // ten products for a year.
  pool.sort((a, b) => b.createdAt - a.createdAt);

  const occasion = primaryOccasion(listing);
  const theme = primaryTheme(listing);
  const type = listing.productType;

  const candidates = [
    occasion ? { id: "occasion", slug: occasion, heading: `More ${occasionLabel(occasion)} designs` } : null,
    theme ? { id: "theme", slug: theme, heading: `More ${themeLabel(theme)}` } : null,
    type ? { id: "type", slug: type, heading: `More ${productTypeLabel(type)}` } : null,
  ].filter((c): c is { id: string; slug: string; heading: string } => c !== null);

  const used = new Set<number>();
  const rails: Rail[] = [];

  for (const candidate of candidates) {
    const collection = bySlug.get(candidate.slug);
    if (!collection) continue;

    const members = pool.filter((l) => !used.has(l.id) && belongsTo(l, collection));
    if (members.length < MIN_PER_RAIL) continue;

    const picked = members.slice(0, PER_RAIL);
    for (const l of picked) used.add(l.id);
    rails.push({
      id: candidate.id,
      heading: candidate.heading,
      href: collectionPath(collection.slug),
      listings: picked,
    });
  }

  return rails;
}
