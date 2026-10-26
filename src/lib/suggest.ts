/**
 * What to offer while someone types in the search box.
 *
 * Two kinds of suggestion, and the distinction matters. A collection or a product is a
 * destination: picking it navigates straight there, so it cannot lead to an empty page.
 * The last row runs the actual search, and it carries the real result count from
 * `filterListings`, so the box never promises results the results page will not show.
 *
 * Collections come first. On a catalog of 414 products, "Christmas" is a better answer
 * than any one Christmas design.
 */

import { filterListings } from "@/lib/catalog";
import { collectionPath } from "@/lib/collections";
import { listingName, listingPath } from "@/lib/slug";
import type { Collection } from "@/lib/collections";
import type { Listing } from "@/types/etsy";
import { MIN_QUERY_CHARS } from "@/lib/suggest-contract";
import type { Suggestion } from "@/lib/suggest-contract";

export { MIN_QUERY_CHARS };
export type { Suggestion };


const MAX_COLLECTIONS = 3;
const MAX_PRODUCTS = 5;

/** A name that starts with what was typed is a better answer than one containing it. */
function rank(label: string, q: string): number {
  const at = label.toLowerCase().indexOf(q);
  if (at < 0) return Number.POSITIVE_INFINITY;
  return at === 0 ? 0 : 1;
}

export function suggest(q: string, listings: Listing[], collections: Collection[]): Suggestion[] {
  const needle = q.trim().toLowerCase();
  if (needle.length < MIN_QUERY_CHARS) return [];

  const matchedCollections = collections
    .filter((c) => c.label.toLowerCase().includes(needle))
    .sort((a, b) => rank(a.label, needle) - rank(b.label, needle) || b.count - a.count)
    .slice(0, MAX_COLLECTIONS)
    .map<Suggestion>((c) => ({
      kind: "collection",
      label: c.label,
      href: collectionPath(c.slug),
      count: c.count,
    }));

  /*
    Matched on the display name rather than the raw Etsy title. The title is a run of
    pipe-separated keyword blocks, so matching it would offer products whose visible name
    does not contain what was typed. The query row below still reaches those.
  */
  const seen = new Set<string>();
  const matchedProducts: Suggestion[] = [];
  const byRank = listings
    .map((l) => ({ listing: l, name: listingName(l) }))
    .filter((entry) => entry.name.toLowerCase().includes(needle))
    .sort(
      (a, b) =>
        rank(a.name, needle) - rank(b.name, needle) || a.name.length - b.name.length
    );

  for (const { listing, name } of byRank) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    matchedProducts.push({ kind: "product", label: name, href: listingPath(listing) });
    if (matchedProducts.length === MAX_PRODUCTS) break;
  }

  // The count the results page will actually show, not the number of suggestions above.
  const total = filterListings(listings, { q: needle }).length;
  const query: Suggestion[] = total
    ? [
        {
          kind: "query",
          label: q.trim(),
          href: `/?q=${encodeURIComponent(q.trim())}`,
          count: total,
        },
      ]
    : [];

  return [...matchedCollections, ...matchedProducts, ...query];
}
