/**
 * lib/facets.ts
 *
 * Secondary filter facets: product type, theme, and price band.
 *
 * WHY THESE ARE DERIVED RATHER THAN STORED:
 * Etsy gives us exactly one piece of real taxonomy, the shop section, and that drives
 * the primary category filter. Everything else here is inferred from the title and the
 * listing's real Etsy tags. Keeping the rules in code rather than baking results into
 * catalog.json means changing a rule takes effect on the next build, with no re-sync and
 * no stale values sitting in the data file.
 *
 * The rules are heuristics. They are tuned against the live catalog and their coverage
 * is asserted by `npm run facets:report`, so a rule change that starts dropping products
 * on the floor is visible rather than silent.
 */

import type { Listing } from "@/types/etsy";

export interface FacetOption {
  id: string;
  label: string;
  count: number;
}

// ─── Product type ─────────────────────────────────────────────────────────────

/**
 * Ordered most specific first: a listing gets the FIRST type it matches.
 *
 * Order is load-bearing. "Wrapping paper" is both the largest group and the most likely
 * phrase to appear incidentally in another product's tags (an ornament tagged
 * "gift wrap idea"), so it sits last and only claims what nothing else did.
 */
const PRODUCT_TYPE_RULES: { id: string; label: string; pattern: RegExp }[] = [
  { id: "phone-case", label: "Phone Cases", pattern: /phone case/i },
  { id: "drinkware", label: "Tumblers & Mugs", pattern: /tumbler|\bmug\b|water bottle/i },
  { id: "sticker", label: "Stickers", pattern: /\bsticker/i },
  { id: "tote", label: "Tote Bags", pattern: /tote bag|\btote\b/i },
  { id: "stationery", label: "Cards & Stationery", pattern: /greeting card|notecard|stationery|napkin|\bcard\b/i },
  { id: "wall-art", label: "Posters & Prints", pattern: /poster|art print|wall art|canvas/i },
  { id: "digital", label: "Digital Downloads", pattern: /digital download|printable|\bsvg\b/i },
  { id: "ornament", label: "Ornaments", pattern: /ornament/i },
  // Hats sit above apparel so "Snapback Cap" lands somewhere more useful than the
  // catch-all clothing bucket. Bare "hat" and "cap" are deliberately not matched: they
  // pull in wrapping paper tagged "santa hat" and similar.
  { id: "hat", label: "Hats & Caps", pattern: /snapback|flat bill|trucker (hat|cap)|baseball cap|\bbeanie\b|bucket hat|dad hat/i },
  {
    id: "apparel",
    label: "T-Shirts & Apparel",
    pattern: /t-?shirt|\btee\b|sweatshirt|hoodie|apparel|\bshirt\b|pajama|lounge pants|sleepwear/i,
  },
  { id: "wrapping-paper", label: "Wrapping Paper", pattern: /wrapping paper|gift ?wrap|giftwrap/i },
];

// ─── Theme ────────────────────────────────────────────────────────────────────

/** A listing can carry several themes, so these are not exclusive. */
const THEME_RULES: { id: string; label: string; pattern: RegExp }[] = [
  { id: "cats", label: "Cats", pattern: /\bcats?\b|kitten|feline|meow/i },
  { id: "dogs", label: "Dogs", pattern: /\bdogs?\b|puppy|canine|\bpup\b/i },
  { id: "gothic", label: "Gothic & Dark", pattern: /gothic|\bgoth\b|skull|victorian|macabre|spooky|dark_/i },
  { id: "retro", label: "Retro & Y2K", pattern: /retro|\b90s\b|\by2k\b|vaporwave|pixel|vintage|nostalg/i },
  { id: "floral", label: "Floral & Botanical", pattern: /floral|botanical|flower|peony|rose\b|garden/i },
  { id: "minimalist", label: "Minimalist", pattern: /minimal|modern|simple|clean_|geometric/i },
  // "cozy" deliberately excluded: it appears in 72 listings as a generic holiday tag
  // (guitars, dogs, woodland animals) and swamped this theme with unrelated products.
  { id: "cottagecore", label: "Cottagecore & Rustic", pattern: /cottagecore|farmhouse|rustic/i },
  { id: "pride", label: "LGBTQ+ & Pride", pattern: /lgbt|\bpride\b|rainbow|queer/i },
  { id: "coastal", label: "Coastal & Nautical", pattern: /coastal|nautical|beach|ocean|seaside/i },
  // The five below were added after a coverage pass: without them 105 products (29%)
  // carried no theme at all and vanished from every themed view. They lift coverage to
  // ~90%. See `npm run facets:report`.
  { id: "music", label: "Music", pattern: /guitar|music|techno|\bdj\b|mariachi|\bband\b|concert|vinyl|headphone/i },
  { id: "food", label: "Food & Drink", pattern: /\bfood\b|coffee|concha|pan dulce|candy|cookie|donut|pizza|taco|dessert|bakery|drink|cocktail/i },
  { id: "wildlife", label: "Woodland & Wildlife", pattern: /woodland|\bdeer\b|\bfox\b|bunny|rabbit|\bowl\b|\bbird|forest|moose|\bbear\b|squirrel/i },
  { id: "glam", label: "Glam & Elegant", pattern: /glam|glitter|sparkle|\bgold\b|elegant|luxe|shimmer/i },
  { id: "family", label: "Family & Matching", pattern: /matching|family_|couples|his and hers/i },
];

/** Title plus tags is the whole signal. Tags are Etsy's own, so they carry real intent. */
function haystack(listing: Listing): string {
  return `${listing.title} ${(listing.tags ?? []).join(" ")}`.toLowerCase();
}

export function deriveProductType(listing: Listing): string | null {
  const hay = haystack(listing);
  const hit = PRODUCT_TYPE_RULES.find((rule) => rule.pattern.test(hay));
  return hit ? hit.id : null;
}

export function deriveThemes(listing: Listing): string[] {
  const hay = haystack(listing);
  return THEME_RULES.filter((rule) => rule.pattern.test(hay)).map((rule) => rule.id);
}

export function productTypeLabel(id: string): string {
  return PRODUCT_TYPE_RULES.find((r) => r.id === id)?.label ?? id;
}

export function themeLabel(id: string): string {
  return THEME_RULES.find((r) => r.id === id)?.label ?? id;
}

// ─── Price bands ──────────────────────────────────────────────────────────────

export interface PriceBand {
  id: string;
  label: string;
  /** Inclusive lower bound. */
  min: number;
  /** Exclusive upper bound, or Infinity for the top band. */
  max: number;
}

const TARGET_BANDS = 4;

/** Cents only when they exist, so "$25" stays clean but "$21.83" stays accurate. */
function money(value: number): string {
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}

/**
 * Builds price bands from the actual distribution rather than fixed brackets.
 *
 * This catalog is why: 83% of products sit on just two price points ($21.83 and $22.50).
 * Fixed $10 brackets would put nearly everything in one bucket and make the filter
 * useless — every option returning either all products or none.
 *
 * The algorithm walks distinct prices upward and closes a band once it holds roughly an
 * even share, but never splits a single price point across bands. A price point larger
 * than the target share becomes its own band, which is what keeps the two big clusters
 * separable.
 *
 * Returns [] when the catalog cannot support at least two meaningful bands, and callers
 * hide the filter entirely rather than show a control that does nothing.
 */
export function computePriceBands(listings: Listing[]): PriceBand[] {
  const counts = new Map<number, number>();
  for (const listing of listings) {
    if (listing.price > 0) counts.set(listing.price, (counts.get(listing.price) ?? 0) + 1);
  }

  const points = [...counts.entries()].sort((a, b) => a[0] - b[0]);
  const total = points.reduce((sum, [, n]) => sum + n, 0);
  if (points.length < 2 || total === 0) return [];

  const target = total / TARGET_BANDS;
  const groups: { min: number; max: number; count: number }[] = [];
  let current: { min: number; max: number; count: number } | null = null;

  for (const [price, count] of points) {
    if (current === null) {
      current = { min: price, max: price, count };
      continue;
    }

    // Close the current band when it already carries its share, and also when the price
    // point about to be added is itself large enough to stand alone. Without the second
    // rule a dominant price point gets swallowed by whatever small band precedes it —
    // which is exactly what happened here, merging 193 listings at $21.83 into the 13
    // cheaper ones and collapsing four bands into three.
    if (current.count >= target || count >= target) {
      groups.push(current);
      current = { min: price, max: price, count };
      continue;
    }

    current.max = price;
    current.count += count;
  }
  if (current) groups.push(current);

  // A trailing sliver is noise on a filter; fold it back into its neighbour.
  if (groups.length > 1) {
    const last = groups[groups.length - 1];
    if (last.count < total * 0.02) {
      const prev = groups[groups.length - 2];
      prev.max = last.max;
      prev.count += last.count;
      groups.pop();
    }
  }

  if (groups.length < 2) return [];

  return groups.map((group, i) => {
    const isFirst = i === 0;
    const isLast = i === groups.length - 1;

    // Bounds are the group's own price points, so bands can never overlap or leave a
    // gap: every price in the catalog falls in exactly one.
    const min = isFirst ? 0 : group.min;
    const max = isLast ? Infinity : group.max;

    let label: string;
    if (group.min === group.max) {
      // A band holding a single price point is clearest labelled as that price. With
      // this catalog two bands are exactly that ($21.83 and $22.50), and rendering them
      // as overlapping rounded ranges read as a bug.
      label = money(group.min);
    } else if (isFirst) {
      label = `Under ${money(Math.ceil(group.max))}`;
    } else if (isLast) {
      label = `${money(Math.floor(group.min))} & up`;
    } else {
      label = `${money(group.min)} – ${money(group.max)}`;
    }

    return { id: `p${i}`, label, min, max };
  });
}

/** Upper bound is inclusive, matching how computePriceBands sets it. */
export function matchesPriceBand(listing: Listing, band: PriceBand): boolean {
  return listing.price >= band.min && listing.price <= band.max;
}
