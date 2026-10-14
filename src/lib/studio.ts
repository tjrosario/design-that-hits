/**
 * What to design next, derived from the catalog the shop already has.
 *
 * Deliberately first-party only. The two external sources worth having are gated: Etsy's
 * own view and favorite counts need a Seller App key, and Pinterest's trending keywords
 * need an approved business app. Neither can supply Etsy-wide trending data, because no
 * Etsy tier exposes it, so nothing here pretends to know what is selling elsewhere.
 *
 * A collection page needs two things, and the point of this module is to say which one a
 * given pair is missing. It needs MIN_INTERSECTION_PRODUCTS listings, and it needs a
 * hand-written label and intro in INTERSECTIONS, because `getIntersections` walks that
 * object rather than the catalog. Copy with too few products yields nothing; products
 * with no copy also yield nothing.
 */

import { getAllListings } from "@/lib/shop";
import {
  belongsTo,
  getCollections,
  getIntersections,
  hasIntersectionCopy,
  MIN_INTERSECTION_PRODUCTS,
} from "@/lib/collections";
import { relevantOccasions } from "@/lib/seasonal";
import type { Collection } from "@/lib/collections";
import type { Listing } from "@/types/etsy";

export interface Opportunity {
  a: Collection;
  b: Collection;
  count: number;
  /** Designs still needed to clear the threshold. Zero when only copy is missing. */
  shortfall: number;
  /** True when any member of the pair carries an occasion whose window is open. */
  seasonal: boolean;
  /** The published page that already shows the most of this set, if one does. */
  rival?: { label: string; share: number };
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
  openOccasions: string[];
  /** Enough products already; needs only a label and an intro. */
  copyOnly: Opportunity[];
  /** A few designs short, and it will need copy as well. */
  needsDesigns: Opportunity[];
  axes: Axis[];
  byType: Axis[];
}

/*
  How far below the threshold still counts as worth showing. Four is roughly a weekend of
  design work; past that the pair reads as "this niche is not in the catalog" rather than
  "nearly there".
*/
const MAX_SHORTFALL = 4;

/** An axis is thin below this, which is where a shelf starts looking like an afterthought. */
export const THIN_AXIS = 20;

/*
  A pair that contains almost all of one of its parents is not a niche, it is the parent
  under another name: christmas x wrapping-paper is 192 of 209 Christmas listings, so the
  page would show the same grid as /collections/christmas and compete with it.
*/
const MAX_PARENT_SHARE = 0.85;

/** How much of a pair has to sit in an open window before "in season" means anything. */
const SEASONAL_SHARE = 0.6;

/*
  How much of a candidate an existing page can already show before the new one is a
  duplicate rather than an addition. Comparing against published intersections only, not
  against the two parent collections, since every pair is a subset of both of those by
  construction.
*/
const MAX_RIVAL_SHARE = 0.8;

export async function buildStudioReport(now = new Date()): Promise<StudioReport> {
  // The same source `getCollections` and `getIntersections` read, so the counts here are
  // the counts that decide whether a page exists. The bare catalog can lag it.
  const listings = await getAllListings();
  const collections = await getCollections();

  const openOccasions = new Set(relevantOccasions(now));
  const members = new Map<string, Listing[]>();
  for (const c of collections) members.set(c.slug, listings.filter((l) => belongsTo(l, c)));

  // The pages that already exist, so a candidate can be checked against them rather than
  // only against the other candidates.
  const published = (await getIntersections()).map((i) => ({
    label: i.label,
    ids: new Set(
      listings.filter((l) => belongsTo(l, i.primary) && belongsTo(l, i.secondary)).map((l) => l.id)
    ),
  }));

  const copyOnly: Opportunity[] = [];
  const needsDesigns: Opportunity[] = [];

  /*
    Every unordered pair. There is no constraint that a theme be the secondary: the route
    segments are named [slug]/[theme] but `resolveIntersection` looks both up in one flat
    map, so occasion x type and theme x theme are equally reachable.
  */
  for (let i = 0; i < collections.length; i++) {
    for (let j = i + 1; j < collections.length; j++) {
      const a = collections[i];
      const b = collections[j];
      if (hasIntersectionCopy(a.slug, b.slug)) continue;

      const aMembers = members.get(a.slug) ?? [];
      const bIds = new Set((members.get(b.slug) ?? []).map((l) => l.id));
      const shared = aMembers.filter((l) => bIds.has(l.id));
      if (shared.length === 0) continue;

      const share = Math.max(
        shared.length / Math.max(1, aMembers.length),
        shared.length / Math.max(1, bIds.size)
      );
      if (share >= MAX_PARENT_SHARE) continue;

      /*
        From the members themselves, so a pair whose stock is all Halloween counts even
        though its axes are a type and a theme. A majority, not merely one: Christmas is
        over half the catalog, so `some` flagged every pair and the badge meant nothing.
      */
      const inWindow = shared.filter((l) => (l.occasions ?? []).some((o) => openOccasions.has(o)));
      const seasonal = inWindow.length >= shared.length * SEASONAL_SHARE;
      const shortfall = MIN_INTERSECTION_PRODUCTS - shared.length;

      // Whichever live page already shows the most of this set.
      let rival: Opportunity["rival"];
      for (const page of published) {
        const overlap = shared.filter((l) => page.ids.has(l.id)).length / shared.length;
        if (overlap > (rival?.share ?? 0)) rival = { label: page.label, share: overlap };
      }
      if (rival && rival.share >= MAX_RIVAL_SHARE) continue;

      const entry: Opportunity = {
        a,
        b,
        count: shared.length,
        shortfall: Math.max(0, shortfall),
        seasonal,
        ...(rival ? { rival } : {}),
      };

      if (shortfall <= 0) copyOnly.push(entry);
      else if (shortfall <= MAX_SHORTFALL) needsDesigns.push(entry);
    }
  }

  // In season first, then the biggest, because among copy-only pairs a larger set is the
  // stronger page.
  copyOnly.sort((x, y) => Number(y.seasonal) - Number(x.seasonal) || y.count - x.count);
  // In season first, then whatever needs the fewest designs.
  needsDesigns.sort((x, y) => Number(y.seasonal) - Number(x.seasonal) || x.shortfall - y.shortfall);

  const toAxis = (c: Collection): Axis => ({
    slug: c.slug,
    label: c.label,
    kind: c.kind,
    count: members.get(c.slug)?.length ?? 0,
  });

  return {
    generatedAt: now,
    totalListings: listings.length,
    openOccasions: [...openOccasions],
    copyOnly,
    needsDesigns,
    axes: collections.filter((c) => c.kind !== "type").map(toAxis).sort((a, b) => a.count - b.count),
    byType: collections.filter((c) => c.kind === "type").map(toAxis).sort((a, b) => b.count - a.count),
  };
}
