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

import { getAllListings, getFacetGroups } from "@/lib/shop";
import type { FacetOption, Listing } from "@/types/etsy";

export type CollectionKind = "type" | "theme";

export interface Collection {
  /** URL segment. Identical to the facet id it came from. */
  slug: string;
  kind: CollectionKind;
  label: string;
  /** How many listings the facet holds, for the page copy and the ItemList. */
  count: number;
  /**
   * A product photo to represent the collection. Absent only if nothing in it has one.
   * Decorative on the tiles, since the visible label already names the link.
   */
  imageUrl?: string;
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
  "wall-art": "Posters and art prints to fill the wall you keep meaning to do something about. Bold color, clean printing, no frame required to look finished.",
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
  minimalist: "Minimalist designs — clean lines, restrained color, plenty of space. For rooms and people that do not need to shout.",
  cottagecore: "Cottagecore and rustic designs with a farmhouse warmth to them. Slow mornings, worn wood, and things that look handmade.",
  pride: "LGBTQ+ and Pride designs to wear, gift and decorate with. Rainbow and beyond, for June and every other month.",
  coastal: "Coastal and nautical designs — ocean color, beach days and seaside calm, for people happiest near the water.",
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
/** True when this listing belongs in that collection. */
function belongsTo(listing: Listing, collection: Collection): boolean {
  return collection.kind === "type"
    ? listing.productType === collection.slug
    : Boolean(listing.themes?.includes(collection.slug));
}

export async function getCollections(): Promise<Collection[]> {
  const [facets, listings] = await Promise.all([getFacetGroups(), getAllListings()]);

  const types = facets.productTypes.map((o) => toCollection("type", o));
  const themes = facets.themes.map((o) => toCollection("theme", o));
  const seen = new Set(types.map((c) => c.slug));
  const collections = [...types, ...themes.filter((c) => !seen.has(c.slug))];

  // Newest first, so a tile shows the same product the collection page leads with rather
  // than an arbitrary one. Sorted once here instead of per collection.
  const newestFirst = [...listings]
    .filter((l) => l.image)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  for (const collection of collections) {
    const hero = newestFirst.find((l) => belongsTo(l, collection));
    if (hero?.image) collection.imageUrl = hero.image.url;
  }

  return collections;
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

// ─── Product type crossed with theme ─────────────────────────────────────────

/**
 * Minimum products before an intersection earns a page. Below this it is a thin page
 * competing with the two collections it sits between rather than adding anything.
 */
export const MIN_INTERSECTION_PRODUCTS = 10;

export interface Intersection {
  type: Collection;
  theme: Collection;
  /** What the page is about, written out rather than composed from the two labels. */
  label: string;
  count: number;
  imageUrl?: string;
}

/**
 * The intersections that get a page, keyed `<type>|<theme>`.
 *
 * Both the label and the intro are written by hand, and a pair with no entry here gets no
 * page even when it clears the threshold. That is deliberate: composing "Cats" and
 * "Wrapping Paper" into a heading and a sentence would scale to dozens of pages whose
 * only distinct text is two interpolated nouns, which is the shape search engines
 * discount. Writing them is the gate.
 */
const INTERSECTIONS: Record<string, { label: string; intro: string }> = {
  "wrapping-paper|glam": {
    label: "Glam Wrapping Paper",
    intro:
      "Gold tones, glitter-look texture and a lot of shine, printed flat on paper. These are the wraps for a gift that is already an occasion: the engagement, the milestone birthday, the anniversary you actually remembered.",
  },
  "wrapping-paper|gothic": {
    label: "Gothic Wrapping Paper",
    intro:
      "Skulls, moths, Victorian botanicals and a great deal of black. Gothic gift wrap for the present that should not turn up in snowmen, whatever month it happens to be.",
  },
  "wrapping-paper|cats": {
    label: "Cat Wrapping Paper",
    intro:
      "Enough cat designs to find the specific cat they would die for. Tabbies, black cats, loaf cats and a few behaving exactly as cats do, repeated edge to edge across the sheet.",
  },
  "wrapping-paper|retro": {
    label: "Retro Wrapping Paper",
    intro:
      "Nineties and Y2K gift wrap: pixel hearts, chrome lettering, checkerboard and colors that look like a disposable camera found them. For people who were there and the ones who found it later.",
  },
  "wrapping-paper|floral": {
    label: "Floral Wrapping Paper",
    intro:
      "Florals that are not the supermarket sort. Pressed botanical repeats, bold modern blooms and fine line stems, in palettes that suit a birthday as easily as a wedding gift.",
  },
  "wrapping-paper|minimalist": {
    label: "Minimalist Wrapping Paper",
    intro:
      "Line art, single color repeats and plenty of space. The wrap that does not argue with the ribbon, and the safe answer when you genuinely do not know what they like.",
  },
  "wrapping-paper|dogs": {
    label: "Dog Wrapping Paper",
    intro:
      "Dog gift wrap that gets specific: dachshunds, corgis, greyhounds in coats, and a few generic good boys. For the dog person, or for the dog's birthday, which is a real thing people celebrate.",
  },
  "wrapping-paper|food": {
    label: "Food Wrapping Paper",
    intro:
      "Coffee, pan dulce, pizza, cocktails and birthday cake, repeated across a sheet. Gift wrap for the person whose whole personality is a snack.",
  },
  "wrapping-paper|cottagecore": {
    label: "Cottagecore Wrapping Paper",
    intro:
      "Mushrooms, hand drawn florals, gingham and muted, slightly faded color. It reads hand blocked and costs the same as the shiny stuff.",
  },
  "wrapping-paper|music": {
    label: "Music Wrapping Paper",
    intro:
      "Guitars, vinyl, cassettes and sound waves. Gift wrap for a present that is probably also music, or for the person who still has opinions about album order.",
  },
  "wrapping-paper|wildlife": {
    label: "Woodland Wrapping Paper",
    intro:
      "Deer, foxes, bunnies, owls and bears in woodland repeats. It suits a baby shower and a sixtieth birthday equally well, which is rarer in gift wrap than it sounds.",
  },
  "wrapping-paper|pride": {
    label: "Pride Wrapping Paper",
    intro:
      "Rainbow and beyond: progress stripes, bi and trans palettes, and queer coded motifs that are more than a flag on a background. For June and for the other eleven months.",
  },
  "apparel|gothic": {
    label: "Gothic Shirts & Sweatshirts",
    intro:
      "Skulls, moths, occult line work and heavy black, on tees and sweatshirts. Printed on demand, so the design is the point rather than the blank it sits on.",
  },
  "apparel|food": {
    label: "Food & Drink Shirts",
    intro:
      "Shirts for people with a specialist subject. Coffee, tacos, pan dulce, and a few things that should not be sandwiches but are anyway.",
  },
};

export function intersectionKey(typeSlug: string, themeSlug: string): string {
  return `${typeSlug}|${themeSlug}`;
}

export function intersectionPath(typeSlug: string, themeSlug: string, page = 1): string {
  const base = `${collectionPath(typeSlug)}/${themeSlug}`;
  return page <= 1 ? base : `${base}/pages/${page}`;
}

export function intersectionUrl(typeSlug: string, themeSlug: string, page = 1): string {
  return `${SITE_URL}${intersectionPath(typeSlug, themeSlug, page)}`;
}

export function intersectionIntro(i: Intersection): string {
  return INTERSECTIONS[intersectionKey(i.type.slug, i.theme.slug)].intro;
}

/**
 * Every intersection that has copy, clears the product threshold, and whose two halves
 * are both live collections.
 *
 * `pages` can never be a theme slug, because `/collections/<type>/pages/2` is already the
 * deeper-page route for the type itself and would shadow it.
 */
export async function getIntersections(): Promise<Intersection[]> {
  const [collections, listings] = await Promise.all([getCollections(), getAllListings()]);
  const bySlug = new Map(collections.map((c) => [`${c.kind}:${c.slug}`, c]));

  const newestFirst = [...listings]
    .filter((l) => l.image)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  const out: Intersection[] = [];
  for (const [key, copy] of Object.entries(INTERSECTIONS)) {
    const [typeSlug, themeSlug] = key.split("|");
    if (themeSlug === "pages") continue;

    const type = bySlug.get(`type:${typeSlug}`);
    const theme = bySlug.get(`theme:${themeSlug}`);
    if (!type || !theme) continue;

    const matching = listings.filter((l) => belongsTo(l, type) && belongsTo(l, theme));
    if (matching.length < MIN_INTERSECTION_PRODUCTS) continue;

    const hero = newestFirst.find((l) => belongsTo(l, type) && belongsTo(l, theme));
    out.push({
      type,
      theme,
      label: copy.label,
      count: matching.length,
      ...(hero?.image ? { imageUrl: hero.image.url } : {}),
    });
  }

  return out.sort((a, b) => b.count - a.count);
}

export async function resolveIntersection(
  typeSlug: string,
  themeSlug: string
): Promise<Intersection | null> {
  const all = await getIntersections();
  return all.find((i) => i.type.slug === typeSlug && i.theme.slug === themeSlug) ?? null;
}

/** The intersections hanging off one collection, for the cross-links on its page. */
export async function intersectionsFor(collection: Collection): Promise<Intersection[]> {
  const all = await getIntersections();
  return all.filter((i) =>
    collection.kind === "type" ? i.type.slug === collection.slug : i.theme.slug === collection.slug
  );
}

// ─── Long-form copy for the collections worth ranking ────────────────────────

export interface CollectionDetail {
  body?: { heading: string; paragraphs: string[] }[];
  faq?: { q: string; a: string }[];
}

/**
 * Only for collections that are a commercial search target in their own right. Every
 * specification below is taken from the listings themselves, which carry the same stock
 * and finish across 303 of the 305 wrapping papers.
 */
const COLLECTION_DETAIL: Record<string, CollectionDetail> = {
  "wrapping-paper": {
    body: [
      {
        heading: "What the paper is",
        paragraphs: [
          "Every design is printed on 90gsm fine art stock, one side only, with a neat white margin at the edges so the sheet finishes cleanly where it folds. That is a heavier paper than standard gift wrap, which is what lets a corner take a sharp crease instead of splitting along it.",
          "You choose glossy or matte on the listing before ordering, and each design comes in three sizes so a small box and an awkward long one can use the same artwork.",
        ],
      },
      {
        heading: "Picking a design",
        paragraphs: [
          "The fastest way in is by subject rather than by occasion. Most people arrive knowing the recipient is a cat person, or that the gift needs to look expensive, or that it has to work for a birthday in the last week of October. The theme pages below cut the catalog down that way.",
        ],
      },
    ],
    faq: [
      {
        q: "What kind of paper is it?",
        a: "90gsm fine art paper, printed on one side, with a neat white margin at the edges. It is a heavier stock than standard gift wrap, so corners fold sharp rather than tearing.",
      },
      {
        q: "Can I choose matte or glossy?",
        a: "Yes. Every design is offered in both finishes, and you pick which one you want on the listing before you order.",
      },
      {
        q: "What sizes does it come in?",
        a: "Three sizes. The exact dimensions are listed on each design, because they vary between products.",
      },
      {
        q: "Can I have a name or a message printed on it?",
        a: "No. These are fixed printed designs rather than custom print, so nothing is personalized to order. If you want a name on the gift, pair the paper with a card.",
      },
      {
        q: "Where do I actually buy it?",
        a: "Each design links through to its listing in the Design That Hits shop on Etsy, which is where payment and shipping are handled.",
      },
    ],
  },
};

export function collectionDetail(slug: string): CollectionDetail | null {
  return COLLECTION_DETAIL[slug] ?? null;
}

// ─── Page specs ──────────────────────────────────────────────────────────────

/** Everything a catalog landing page needs, independent of which shape produced it. */
export interface CatalogSpec {
  /** Drives the h1, the title and the breadcrumb leaf. */
  label: string;
  eyebrow: string;
  intro: string;
  query: { types?: string[]; themes?: string[] };
  pagePath: (page: number) => string;
  /** Breadcrumb between Collections and this page's own leaf. */
  trail: { name: string; href: string }[];
  detail?: CollectionDetail | null;
  /** Cross-links rendered under the grid. */
  related?: { heading: string; items: { label: string; href: string; count: number }[] };
}

export async function collectionSpec(collection: Collection): Promise<CatalogSpec> {
  const related = await intersectionsFor(collection);

  return {
    label: collection.label,
    eyebrow: collection.kind === "type" ? "Product type" : "Theme",
    intro: introFor(collection),
    query: collectionQuery(collection),
    pagePath: (page) => collectionPagePath(collection.slug, page),
    trail: [],
    detail: collectionDetail(collection.slug),
    related: related.length
      ? {
          heading:
            collection.kind === "type"
              ? `${collection.label} by theme`
              : `${collection.label} by product`,
          items: related.map((i) => ({
            label: i.label,
            href: intersectionPath(i.type.slug, i.theme.slug),
            count: i.count,
          })),
        }
      : undefined,
  };
}

export function intersectionSpec(i: Intersection): CatalogSpec {
  return {
    label: i.label,
    eyebrow: i.type.label,
    intro: intersectionIntro(i),
    query: { types: [i.type.slug], themes: [i.theme.slug] },
    pagePath: (page) => intersectionPath(i.type.slug, i.theme.slug, page),
    // Up is the product type, which is the broader page a visitor would widen to.
    trail: [{ name: i.type.label, href: collectionPath(i.type.slug) }],
    detail: null,
  };
}
