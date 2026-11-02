/**
 * lib/duplicates.ts
 *
 * Listings the shop has on Etsy twice, and which of the two the site should rank.
 *
 * Reviewed by hand and listed by id, because no field in the catalog separates a real
 * duplicate from two different designs that happen to share a title.
 */

import type { Listing } from "@/types/etsy";

/** A set of listings that are the same product, and the id the others defer to. */
interface DuplicateGroup {
  primary: number;
  duplicates: number[];
}

/*
  Confirmed by comparing the artwork, not the metadata.

  Every pair below shares a title and a price, and each has a different primary photo. In
  these three the photos are the same design shot twice, so the pages compete for one query
  and one of them should carry the ranking. The primary is the listing whose photo is the
  styled render rather than the flat sheet, which is the one worth showing in image search.
*/
const GROUPS: DuplicateGroup[] = [
  // Techno Christmas Tree. Flat sheet (4415243885) defers to the neon render.
  { primary: 4408182930, duplicates: [4415243885] },
  // Techno Skull. Flat sheet (4415238112) defers to the styled render.
  { primary: 4408195937, duplicates: [4415238112] },
  // Border Collie. Byte-identical photos, so the lower id is primary by convention.
  { primary: 4396573340, duplicates: [4396574071] },
];

/*
  Title collisions that are NOT duplicates, kept here so the guard below stops reporting
  them and nobody merges them by mistake.

  4490472396 is diploma scrolls on light blue and 4490014655 is graduation caps on olive.
  They share a title and a byte-identical description on Etsy, which is a listing error to
  fix there: the site cannot rewrite a product name it does not own, and canonicalising one
  to the other would drop a design out of search entirely.
*/
const DISTINCT_DESPITE_SHARED_TITLE: number[][] = [[4490472396, 4490014655]];

const PRIMARY_BY_DUPLICATE = new Map<number, number>(
  GROUPS.flatMap((g) => g.duplicates.map((id) => [id, g.primary] as const))
);

/** Stable identity for a set of ids, so group membership can be compared directly. */
function groupKey(ids: number[]): string {
  return [...ids].sort((a, b) => a - b).join(",");
}

const REVIEWED_GROUP_KEYS = new Set(
  [
    ...GROUPS.map((g) => [g.primary, ...g.duplicates]),
    ...DISTINCT_DESPITE_SHARED_TITLE,
  ].map(groupKey)
);

/** The id this listing defers to, or null when it is the one that should rank. */
export function canonicalIdFor(listing: Listing): number | null {
  return PRIMARY_BY_DUPLICATE.get(listing.id) ?? null;
}

/**
 * The id this listing defers to once the catalog is taken into account.
 *
 * A primary that has been delisted leaves the copy behind as the only page for that
 * product, so the copy stops deferring. Every consumer resolves through this, or the
 * sitemap and the canonical tag end up disagreeing about which page exists.
 */
export function deferredPrimaryId(
  listing: Listing,
  exists: (id: number) => boolean
): number | null {
  const primaryId = PRIMARY_BY_DUPLICATE.get(listing.id);
  if (primaryId === undefined) return null;
  return exists(primaryId) ? primaryId : null;
}

/** Whether this listing defers to another copy that is still in `catalog`. */
export function defersToAnother(listing: Listing, catalog: Listing[]): boolean {
  const present = new Set(catalog.map((l) => l.id));
  return deferredPrimaryId(listing, (id) => present.has(id)) !== null;
}

/** Every id reviewed so far, duplicate or deliberately distinct. */
export function reviewedIds(): Set<number> {
  return new Set([
    ...GROUPS.flatMap((g) => [g.primary, ...g.duplicates]),
    ...DISTINCT_DESPITE_SHARED_TITLE.flat(),
  ]);
}

function normalizeTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Title groups whose exact membership has not been reviewed.
 *
 * Matches on the normalized title only, so it catches a straight relisting and misses a
 * copy whose title was retyped. Comparing membership rather than individual ids means a
 * listing joining a reviewed group, or two reviewed primaries colliding after an Etsy
 * retitle, both get reported.
 */
export function unreviewedTitleCollisions(listings: Listing[]): Listing[][] {
  const byTitle = new Map<string, Listing[]>();

  for (const listing of listings) {
    const key = normalizeTitle(listing.title);
    if (!key) continue;
    const group = byTitle.get(key);
    if (group) group.push(listing);
    else byTitle.set(key, [listing]);
  }

  return [...byTitle.values()].filter(
    (group) => group.length > 1 && !REVIEWED_GROUP_KEYS.has(groupKey(group.map((l) => l.id)))
  );
}
