/**
 * What to design next, derived from the catalog the shop already has.
 *
 * This is deliberately built only from first-party data. The two external sources worth
 * having are gated: Etsy's own view and favorite counts need a Seller App key, and
 * Pinterest's trending keywords need an approved business app. Both slot in later. What
 * neither of them can supply is Etsy-wide trending data, because no Etsy tier exposes
 * it, so nothing here pretends to know what is selling elsewhere.
 *
 * The one signal that is available and genuinely actionable is coverage: which
 * combinations of occasion, theme and product type the shop is thin on, and which are
 * close enough to the intersection threshold that a couple of designs would open a new
 * indexable page.
 */

import { getCatalogListings } from "@/lib/catalog";
import { belongsTo, getCollections, getIntersections, MIN_INTERSECTION_PRODUCTS } from "@/lib/collections";
import { relevantOccasions } from "@/lib/seasonal";
import type { Collection } from "@/lib/collections";
import type { Listing } from "@/types/etsy";

/** A pair that has no page yet, with the shortfall to the threshold. */
export interface Opportunity {
  primary: Collection;
  secondary: Collection;
  count: number;
  /** Designs still needed before this becomes an indexable collection page. */
  shortfall: number;
  /** True when the pair is inside an occasion whose selling window is open. */
  seasonal: boolean;
}

export interface Axis {
  slug: string;
  label: string;
  kind: Collection["kind"];
  count: number;
}

export interface StudioReport {
  generatedAt: Date;
  totalListings: number;
  /** Occasions whose window is open today, in the shop's own timezone. */
  openOccasions: string[];
  /** Pairs within one or two designs of unlocking a page, most nearly there first. */
  nearMisses: Opportunity[];
  /** Pairs that already clear the threshold but have no entry in INTERSECTIONS. */
  unbuilt: Opportunity[];
  /** Every axis value, so thin ones are visible rather than inferred. */
  axes: Axis[];
  /** Product type spread, which is lopsided enough to be worth stating plainly. */
  byType: Axis[];
}

/*
  How far below the threshold still counts as worth showing. Four is a judgement call:
  it is roughly a weekend of design work, and past that the pair is better read as "this
  niche is not really in the catalog" than as "nearly there".
*/
const MAX_SHORTFALL = 4;

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

export async function buildStudioReport(now = new Date()): Promise<StudioReport> {
  const listings = getCatalogListings();
  const collections = await getCollections();
  const intersections = await getIntersections();

  // Both directions, because INTERSECTIONS is keyed primary|secondary and a pair is the
  // same pair whichever way round it was written.
  const built = new Set(intersections.map((i) => pairKey(i.primary.slug, i.secondary.slug)));

  const openOccasions = relevantOccasions(now);
  const byKind = (kind: Collection["kind"]) => collections.filter((c) => c.kind === kind);

  const members = new Map<string, Listing[]>();
  for (const c of collections) members.set(c.slug, listings.filter((l) => belongsTo(l, c)));

  const nearMisses: Opportunity[] = [];
  const unbuilt: Opportunity[] = [];

  /*
    Only the pairings that produce a page a shopper would actually search for. Theme
    crossed with theme is not one: "gothic cats" is a real query, but the route shape is
    <axis>/<theme>, so a theme can only ever be the secondary.
  */
  const primaries = [...byKind("occasion"), ...byKind("type")];
  const secondaries = byKind("theme");

  for (const primary of primaries) {
    for (const secondary of secondaries) {
      if (primary.slug === secondary.slug) continue;
      if (built.has(pairKey(primary.slug, secondary.slug))) continue;

      const a = members.get(primary.slug) ?? [];
      const b = new Set((members.get(secondary.slug) ?? []).map((l) => l.id));
      const count = a.filter((l) => b.has(l.id)).length;
      if (count === 0) continue;

      const seasonal = primary.kind === "occasion" && openOccasions.includes(primary.slug);
      const shortfall = MIN_INTERSECTION_PRODUCTS - count;

      if (shortfall <= 0) unbuilt.push({ primary, secondary, count, shortfall: 0, seasonal });
      else if (shortfall <= MAX_SHORTFALL) nearMisses.push({ primary, secondary, count, shortfall, seasonal });
    }
  }

  // Seasonal first, then whichever needs the fewest designs: that is the order the work
  // should actually be done in.
  const order = (x: Opportunity, y: Opportunity) =>
    Number(y.seasonal) - Number(x.seasonal) || x.shortfall - y.shortfall || y.count - x.count;

  nearMisses.sort(order);
  unbuilt.sort((x, y) => Number(y.seasonal) - Number(x.seasonal) || y.count - x.count);

  const toAxis = (c: Collection): Axis => ({
    slug: c.slug,
    label: c.label,
    kind: c.kind,
    count: members.get(c.slug)?.length ?? 0,
  });

  return {
    generatedAt: now,
    totalListings: listings.length,
    openOccasions,
    nearMisses,
    unbuilt,
    axes: [...byKind("occasion"), ...byKind("theme")].map(toAxis).sort((a, b) => a.count - b.count),
    byType: byKind("type").map(toAxis).sort((a, b) => b.count - a.count),
  };
}
