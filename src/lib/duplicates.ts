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

  Every pair below shares a title, a price and a description, and each has a different
  primary photo. In these three the photos are the same design shot twice, so the pages
  compete for one query and one of them should carry the ranking. The primary is the
  listing whose photo is the styled render rather than the flat sheet, which is the one
  worth showing in image search; where both photos are identical the lower id wins so the
  choice is stable.
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
  They share a title and a description on Etsy, which is a listing error to fix there: the
  site cannot rewrite a product name it does not own, and canonicalising one to the other
  would drop a design out of search entirely.
*/
const DISTINCT_DESPITE_SHARED_TITLE: number[][] = [[4490472396, 4490014655]];

const PRIMARY_BY_DUPLICATE = new Map<number, number>(
  GROUPS.flatMap((g) => g.duplicates.map((id) => [id, g.primary] as const))
);

/** The id this listing defers to, or null when it is the one that should rank. */
export function canonicalIdFor(listing: Listing): number | null {
  return PRIMARY_BY_DUPLICATE.get(listing.id) ?? null;
}

/** Whether this listing is the redundant copy of another. */
export function isDuplicate(listing: Listing): boolean {
  return PRIMARY_BY_DUPLICATE.has(listing.id);
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
 * Listings that share a title but have never been looked at.
 *
 * The catalog resyncs daily and the shop keeps listing new designs, so a new collision
 * will appear eventually. It needs the same eyes-on comparison the groups above got.
 */
export function unreviewedTitleCollisions(listings: Listing[]): Listing[][] {
  const reviewed = reviewedIds();
  const byTitle = new Map<string, Listing[]>();

  for (const listing of listings) {
    const key = normalizeTitle(listing.title);
    if (!key) continue;
    const group = byTitle.get(key);
    if (group) group.push(listing);
    else byTitle.set(key, [listing]);
  }

  return [...byTitle.values()].filter(
    (group) => group.length > 1 && group.some((l) => !reviewed.has(l.id))
  );
}
