/**
 * lib/collections.ts
 *
 * Real, indexable landing pages for the two category axes: product type and theme.
 *
 * WHY THESE EXIST
 * These views used to be reachable only as filtered home-page URLs — `/?types=sticker`,
 * `/?themes=cats` — and those were what the sitemap listed and what every product's
 * breadcrumb pointed at. A query-parameter view is a weak ranking target: it reads as a
 * variant of the home page rather than a page about stickers, and the equity earned by
 * "cat stickers" links spreads across `/` instead of concentrating anywhere. Each axis
 * value now has its own path, its own copy and its own structured data, and the filtered
 * home URLs canonicalise into them.
 *
 * The filter UI is untouched. Ticking boxes still produces `/?types=…` and still works;
 * those URLs simply defer to the collection page as the canonical home of that content.
 */

import { getFacetGroups } from "@/lib/shop";
import type { FacetOption } from "@/types/etsy";

export type CollectionKind = "type" | "theme";

export interface Collection {
  /** URL segment. Identical to the facet id it came from. */
  slug: string;
  kind: CollectionKind;
  label: string;
  /** How many listings the facet holds, for the page copy and the ItemList. */
  count: number;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designthathits.com";

/** Matches the home grid, so a collection holds the same number of products per page. */
export const COLLECTION_PAGE_SIZE = 24;

export function collectionPath(slug: string): string {
  return `/collections/${slug}`;
}

/**
 * Page one keeps the bare collection URL; deeper pages get a path segment.
 *
 * A segment rather than `?page=2` so every page prerenders — reading `searchParams` would
 * opt the route into dynamic rendering and trade the whole catalogue's TTFB for a tidier
 * URL shape.
 */
export function collectionPagePath(slug: string, page: number): string {
  return page <= 1 ? collectionPath(slug) : `${collectionPath(slug)}/pages/${page}`;
}

export function collectionUrl(slug: string, page: number): string {
  return `${SITE_URL}${collectionPagePath(slug, page)}`;
}

/**
 * Intro copy, one per collection.
 *
 * Written out rather than templated on purpose. A page whose only unique text is its own
 * title is thin content, and twenty-five near-identical pages generated from one sentence
 * pattern is exactly the shape search engines discount. Anything without an entry falls
 * back to the generic line below, so adding a facet rule in lib/facets.ts cannot break a
 * build — it just publishes a plainer page until someone writes its copy.
 */
const INTROS: Record<string, string> = {
  // ── Product types ───────────────────────────────────────────────────────────
  "phone-case": "Phone cases that do not look like everyone else's. Pick a design, pick your model, and carry something with a bit of personality on it.",
  drinkware: "Tumblers and mugs for people who are particular about what they drink out of. Morning coffee, iced tea all afternoon, or whatever gets you through the meeting.",
  sticker: "Stickers for laptops, water bottles, notebooks and bumpers. Small enough to be an impulse buy, loud enough to be worth it.",
  tote: "Tote bags built for actual use — groceries, books, the beach, the farmers market. Roomy, washable, and a lot better looking than another plastic bag.",
  stationery: "Greeting cards, notecards and party napkins for the occasions that deserve something better than a generic card off the rack.",
  "wall-art": "Posters and art prints to fill the wall you keep meaning to do something about. Bold colour, clean printing, no frame required to look finished.",
  digital: "Instant digital downloads. Buy it, download it, print it at home or take it to a print shop — no shipping and nothing to wait for.",
  ornament: "Ornaments for the tree, the mantel, or a gift that gets unpacked every December. The kind of small thing people keep for years.",
  hat: "Snapbacks, trucker caps, beanies and bucket hats. Everyday headwear with a design worth a second look.",
  apparel: "T-shirts, hoodies, sweatshirts and loungewear. Comfortable enough to live in, printed with something you actually want to wear.",
  "wrapping-paper": "Wrapping paper that makes the gift look considered before it is even opened. Seamless patterns, heavyweight paper, several sizes.",

  // ── Themes ──────────────────────────────────────────────────────────────────
  cats: "For cat people, by people who understand. Kittens, cranky tabbies and cats behaving exactly as cats do, across gifts, wrapping paper and wearables.",
  dogs: "Dog designs for every kind of dog person. Good boys, bad boys, and the ones who have never once come when called.",
  gothic: "Dark and gothic designs — skulls, Victorian detail, and a moodier palette. For the people whose taste never quite left October.",
  retro: "Retro and Y2K designs pulling from the nineties and early two-thousands. Nostalgic without being a costume.",
  floral: "Floral and botanical designs, from delicate line-drawn stems to full saturated blooms. The safe gift that still feels chosen.",
  minimalist: "Minimalist designs — clean lines, restrained colour, plenty of space. For rooms and people that do not need to shout.",
  cottagecore: "Cottagecore and rustic designs with a farmhouse warmth to them. Slow mornings, worn wood, and things that look handmade.",
  pride: "LGBTQ+ and Pride designs to wear, gift and decorate with. Rainbow and beyond, for June and every other month.",
  coastal: "Coastal and nautical designs — ocean colour, beach days and seaside calm, for people happiest near the water.",
  music: "Music designs for players and listeners alike. Guitars, vinyl, headphones, and the genres people build their identity around.",
  food: "Food and drink designs, from coffee obsession to pan dulce and late-night pizza. Nobody has ever regretted a snack.",
  wildlife: "Woodland and wildlife designs — deer, foxes, bunnies, owls and bears. Cosy nature without the taxidermy.",
  glam: "Glam and elegant designs with shine to them. Gold, glitter and sparkle, for occasions that call for a little excess.",
  family: "Matching designs for families and couples. The same design across everyone, which is either charming or deeply embarrassing depending on the teenager.",
};

function introFor(collection: Collection): string {
  return (
    INTROS[collection.slug] ??
    `${collection.label} designs from Design That Hits, printed on demand and shipped from our Etsy shop.`
  );
}

function toCollection(kind: CollectionKind, option: FacetOption): Collection {
  return { slug: option.id, kind, label: option.label, count: option.count };
}

/**
 * Every collection, product types first.
 *
 * Types and themes share one flat URL namespace because `/collections/cats` reads better
 * than `/collections/themes/cats` and is a stronger link target. The two id sets are
 * disjoint today; if a future rule introduced the same id in both, the product type would
 * win here and the theme would be unreachable, so the ids are worth keeping distinct.
 */
export async function getCollections(): Promise<Collection[]> {
  const facets = await getFacetGroups();
  const types = facets.productTypes.map((o) => toCollection("type", o));
  const themes = facets.themes.map((o) => toCollection("theme", o));

  const seen = new Set(types.map((c) => c.slug));
  return [...types, ...themes.filter((c) => !seen.has(c.slug))];
}

export async function resolveCollection(slug: string): Promise<Collection | null> {
  const all = await getCollections();
  return all.find((c) => c.slug === slug) ?? null;
}

/** The listing query one collection stands for. */
export function collectionQuery(collection: Collection): { types?: string[]; themes?: string[] } {
  return collection.kind === "type" ? { types: [collection.slug] } : { themes: [collection.slug] };
}

/** The equivalent filtered home-page URL, which canonicalises back to the collection. */
export function collectionFilterParam(collection: Collection): string {
  return collection.kind === "type" ? `types=${collection.slug}` : `themes=${collection.slug}`;
}

export { introFor as collectionIntro };
