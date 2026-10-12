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

export type CollectionKind = "type" | "theme" | "occasion";

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

  // ── Occasions ───────────────────────────────────────────────────────────────
  christmas:
    "More than two hundred Christmas designs, which is the bulk of what we make. Mostly wrapping paper, running from traditional red and green through gothic, retro and cottagecore, so the gift does not have to look like everyone else's.",
  halloween:
    "Halloween designs that lean cute rather than gruesome. Kawaii ghosts, witchy pastels and a lot of black, across wrapping paper and shirts. Several of these double as October birthday gifts.",
  birthday:
    "Birthday designs for people tired of balloons and the word CELEBRATE set in a serif font. Gothic, glam and retro, plus a run of Halloween birthday wraps for the October crowd.",
  valentines:
    "Valentine's designs without the drugstore pink. Gothic roses, minimalist line hearts and celestial motifs, for when you want it romantic but not saccharine.",
  graduation:
    "Graduation designs for a gift that is usually cash in an envelope. Caps, confetti and academic motifs, so at least the envelope looks like someone tried.",

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
export function belongsTo(listing: Listing, collection: Collection): boolean {
  if (collection.kind === "type") return listing.productType === collection.slug;
  if (collection.kind === "occasion") return Boolean(listing.occasions?.includes(collection.slug));
  return Boolean(listing.themes?.includes(collection.slug));
}

export async function getCollections(): Promise<Collection[]> {
  const [facets, listings] = await Promise.all([getFacetGroups(), getAllListings()]);

  const types = facets.productTypes.map((o) => toCollection("type", o));
  const occasions = facets.occasions.map((o) => toCollection("occasion", o));
  const themes = facets.themes.map((o) => toCollection("theme", o));

  const seen = new Set<string>();
  const collections: Collection[] = [];
  for (const c of [...types, ...occasions, ...themes]) {
    if (seen.has(c.slug)) continue;
    seen.add(c.slug);
    collections.push(c);
  }

  // Newest first, so a tile shows the same product the collection page leads with rather
  // than an arbitrary one. Sorted once here instead of per collection.
  const newestFirst = [...listings]
    .filter((l) => l.image)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  // Occasions are multi-valued, so the newest listing can be the newest in two of them
  // and two adjacent tiles would show the same photo. Prefer one not already taken.
  const usedImages = new Set<string>();
  for (const collection of collections) {
    const members = newestFirst.filter((l) => belongsTo(l, collection));
    const hero = members.find((l) => l.image && !usedImages.has(l.image.url)) ?? members[0];
    if (hero?.image) {
      collection.imageUrl = hero.image.url;
      usedImages.add(hero.image.url);
    }
  }

  return collections;
}

export async function resolveCollection(slug: string): Promise<Collection | null> {
  const all = await getCollections();
  return all.find((c) => c.slug === slug) ?? null;
}

/** The listing query one collection stands for. */
export function collectionQuery(collection: Collection): {
  types?: string[];
  themes?: string[];
  occasions?: string[];
} {
  if (collection.kind === "type") return { types: [collection.slug] };
  if (collection.kind === "occasion") return { occasions: [collection.slug] };
  return { themes: [collection.slug] };
}

/** The equivalent filtered home-page URL, which canonicalises back to the collection. */
export function collectionFilterParam(collection: Collection): string {
  if (collection.kind === "type") return `types=${collection.slug}`;
  if (collection.kind === "occasion") return `occasions=${collection.slug}`;
  return `themes=${collection.slug}`;
}

export { introFor as collectionIntro };

// ─── Product type crossed with theme ─────────────────────────────────────────

/**
 * Minimum products before an intersection earns a page. Below this it is a thin page
 * competing with the two collections it sits between rather than adding anything.
 */
export const MIN_INTERSECTION_PRODUCTS = 10;

export interface Intersection {
  /** The first URL segment: a product type or an occasion. */
  primary: Collection;
  /** The second segment. Always a theme today. */
  secondary: Collection;
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

  // ── Occasion crossed with theme ─────────────────────────────────────────────
  // Where the search volume actually is. People look for christmas wrapping paper far
  // more than for gothic wrapping paper, and the pairs are specific enough to win.
  "christmas|glam": {
    label: "Glam Christmas Wrapping Paper",
    intro:
      "Gold tones, shine and a bit of excess, for the gift under the tree that wants to be noticed first. The metallic look is printed flat, so it photographs well without costing foil money.",
  },
  "christmas|cats": {
    label: "Cat Christmas Wrapping Paper",
    intro:
      "Christmas cats: in hats, in lights, in boxes they should not be in. Enough designs to find the one for the person whose cat already has a stocking.",
  },
  "halloween|gothic": {
    label: "Gothic Halloween Designs",
    intro:
      "Skulls, bats, Victorian gloom and a lot of black, across wrapping paper and shirts. Halloween for the people who find orange and purple a bit childish.",
  },
  "christmas|food": {
    label: "Food Christmas Wrapping Paper",
    intro:
      "Cocoa, cookies, candy canes and the whole Christmas dinner, repeated across a sheet. Wrapping for the person whose December is mostly about eating.",
  },
  "christmas|gothic": {
    label: "Gothic Christmas Wrapping Paper",
    intro:
      "Black ground Christmas wrap with skulls, ravens and dark botanicals. For the house where the tree is also black, and for anyone done with red and green.",
  },
  "christmas|retro": {
    label: "Retro Christmas Wrapping Paper",
    intro:
      "Seventies palettes, vintage baubles and mid century type. Christmas wrap that looks like it was found in an attic rather than bought this year.",
  },
  "christmas|dogs": {
    label: "Dog Christmas Wrapping Paper",
    intro:
      "Dogs in Santa hats, dogs in sweaters, dogs who have clearly eaten something they should not have. Christmas wrap for the dog person, or for the dog, who will tear it off anyway.",
  },
  "christmas|minimalist": {
    label: "Minimalist Christmas Wrapping Paper",
    intro:
      "Single color repeats, fine line trees and plenty of space. Christmas wrap for people who would rather their presents did not shout from under the tree.",
  },
  "christmas|music": {
    label: "Music Christmas Wrapping Paper",
    intro:
      "Guitars, vinyl and carols turned into pattern. Christmas wrap for a gift that is almost certainly music, or for whoever makes the December playlist.",
  },
  "birthday|glam": {
    label: "Glam Birthday Wrapping Paper",
    intro:
      "Gold, confetti and shine for a birthday that counts as a milestone. Works for the thirtieth, the fiftieth, and the one nobody is saying out loud.",
  },
  "birthday|gothic": {
    label: "Gothic Birthday Wrapping Paper",
    intro:
      "Birthday wrap in black, with skulls and dark florals where the balloons usually go. For the person who has asked, more than once, for no balloons.",
  },
  "christmas|cottagecore": {
    label: "Cottagecore Christmas Wrapping Paper",
    intro:
      "Mushrooms, hand drawn greenery, gingham and muted winter color. Christmas wrap that looks hand blocked and homemade without being either.",
  },
  "valentines|minimalist": {
    label: "Minimalist Valentine's Wrapping Paper",
    intro:
      "Line hearts, single color repeats and some restraint. Valentine's wrap for people who mean it but would rather not announce it in glitter.",
  },
  "christmas|wildlife": {
    label: "Woodland Christmas Wrapping Paper",
    intro:
      "Deer, foxes, owls and winter hares in woodland repeats. The Christmas wrap that works for a grandparent and a toddler without changing design.",
  },
  "valentines|gothic": {
    label: "Gothic Valentine's Wrapping Paper",
    intro:
      "Black ground Valentine's wrap with skulls, thorns and dark roses. Romantic in a way that suits some couples considerably better than pink does.",
  },
  "valentines|floral": {
    label: "Floral Valentine's Wrapping Paper",
    intro:
      "Roses, peonies and pressed botanicals for Valentine's, in palettes that are not drugstore pink. They carry an anniversary just as well.",
  },
  "halloween|retro": {
    label: "Retro Halloween Designs",
    intro:
      "Nineties and Y2K Halloween: neon ghosts, pixel bats and colors that belong on a VHS sleeve. Wrapping paper and shirts both.",
  },
  "christmas|pride": {
    label: "Pride Christmas Wrapping Paper",
    intro:
      "Progress stripes, trans and bi palettes, and queer coded motifs worked into Christmas designs. For chosen family, and for anyone whose December is complicated.",
  },
};

export function intersectionKey(primarySlug: string, secondarySlug: string): string {
  return `${primarySlug}|${secondarySlug}`;
}

export function intersectionPath(primarySlug: string, secondarySlug: string, page = 1): string {
  const base = `${collectionPath(primarySlug)}/${secondarySlug}`;
  return page <= 1 ? base : `${base}/pages/${page}`;
}

export function intersectionUrl(primarySlug: string, secondarySlug: string, page = 1): string {
  return `${SITE_URL}${intersectionPath(primarySlug, secondarySlug, page)}`;
}

export function intersectionIntro(i: Intersection): string {
  return INTERSECTIONS[intersectionKey(i.primary.slug, i.secondary.slug)].intro;
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
  // The collection namespace is flat and deduplicated, so a slug identifies one collection
  // whatever axis it came from.
  const bySlug = new Map(collections.map((c) => [c.slug, c]));

  const newestFirst = [...listings]
    .filter((l) => l.image)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  const out: Intersection[] = [];
  for (const [key, copy] of Object.entries(INTERSECTIONS)) {
    const [primarySlug, secondarySlug] = key.split("|");
    if (secondarySlug === "pages") continue;

    const primary = bySlug.get(primarySlug);
    const secondary = bySlug.get(secondarySlug);
    if (!primary || !secondary) continue;

    const matching = listings.filter((l) => belongsTo(l, primary) && belongsTo(l, secondary));
    if (matching.length < MIN_INTERSECTION_PRODUCTS) continue;

    const hero = newestFirst.find((l) => belongsTo(l, primary) && belongsTo(l, secondary));
    out.push({
      primary,
      secondary,
      label: copy.label,
      count: matching.length,
      ...(hero?.image ? { imageUrl: hero.image.url } : {}),
    });
  }

  return out.sort((a, b) => b.count - a.count);
}

export async function resolveIntersection(
  primarySlug: string,
  secondarySlug: string
): Promise<Intersection | null> {
  const all = await getIntersections();
  return (
    all.find((i) => i.primary.slug === primarySlug && i.secondary.slug === secondarySlug) ?? null
  );
}

/** The intersections hanging off one collection, for the cross-links on its page. */
export async function intersectionsFor(collection: Collection): Promise<Intersection[]> {
  const all = await getIntersections();
  return all.filter(
    (i) => i.primary.slug === collection.slug || i.secondary.slug === collection.slug
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

/**
 * Long-form copy for the intersections that are a seasonal search target.
 *
 * Christmas only for now: it is over half the catalog and these are the pages that have
 * to carry traffic between October and December. Each page gets its own body and its own
 * questions rather than a shared block, because eleven pages repeating one FAQ is exactly
 * the duplicate content these pages exist to avoid. Nothing here asserts a specification
 * that is not already stated on the listings themselves.
 */
const INTERSECTION_DETAIL: Record<string, CollectionDetail> = {
  "christmas|glam": {
    body: [
      {
        heading: "Gold without the foil price",
        paragraphs: [
          "The metallic effect in these designs is printed, not foiled. That means the gold reads as gold in photographs and under a tree light, but the sheet still folds and creases like paper rather than cracking along a foil line.",
          "It also means the price is the same as every other design in the shop. Real foil wrap costs several times this and tends to split at the corners of a box.",
        ],
      },
      {
        heading: "What it suits",
        paragraphs: [
          "Glam works hardest on a small gift. A jewelry box or a bottle in gold against a plain tree is the whole point, where a large flat parcel can tip into looking like a corporate hamper. If you are wrapping something big, a minimalist or retro design carries scale better.",
        ],
      },
    ],
    faq: [
      {
        q: "Is the gold actual metallic foil?",
        a: "No, it is printed. It photographs like metallic and catches light, but it behaves like paper when you fold it, which is the trade most people want at this price.",
      },
      {
        q: "Will it look cheap next to real foil wrap?",
        a: "Side by side in bright daylight you would see the difference. Under a tree, in a pile, and in photos, you would not.",
      },
      {
        q: "Does glossy or matte suit these better?",
        a: "Glossy pushes the shine further, which is usually the reason to pick a glam design in the first place. Matte reads more expensive and less festive.",
      },
    ],
  },

  "christmas|cats": {
    body: [
      {
        heading: "Which cat person you are buying for",
        paragraphs: [
          "The designs split into two groups and it is worth knowing which you want before scrolling. One group is the cat as a character: in a Santa hat, tangled in lights, sitting in a box it was not given. The other is the cat as pattern, repeated small and flat, closer to a textile print than a joke.",
          "The character designs are the ones that get a laugh when the paper comes off. The pattern designs are the ones you can wrap an entire family's gifts in without it getting old by the fourth parcel.",
        ],
      },
      {
        heading: "If the cat is the recipient",
        paragraphs: [
          "Worth saying plainly: cats shred wrapping paper and eat ribbon. If the parcel is going under a tree in a house with a cat, the pattern designs hide a repair better than a single large character does.",
        ],
      },
    ],
    faq: [
      {
        q: "Can I get a specific breed?",
        a: "Some designs are breed specific and some are generic cats. The product titles name the breed where there is one, so searching this page for the breed is the fastest way to tell.",
      },
      {
        q: "Is this too childish for an adult?",
        a: "The character designs are playful. The repeated pattern designs are not, and read as an ordinary textile print that happens to be cats, which is usually the safer pick for an adult.",
      },
      {
        q: "Will it match a cat themed gift bag or card?",
        a: "Nothing here is sold as a matching set, so treat the paper as the anchor and pick a plain card rather than trying to pair two patterns.",
      },
    ],
  },

  "christmas|food": {
    body: [
      {
        heading: "Cocoa, cookies and the whole dinner",
        paragraphs: [
          "Food designs are the most reliable Christmas wrap for someone whose tastes you do not know well. Nobody dislikes gingerbread. It sidesteps the problem that a cat design or a gothic design has, which is that it says something about the recipient and can be wrong.",
          "The range runs from single subject repeats, cocoa mugs or candy canes across the sheet, to busier spreads with a full table on them. The single subject designs are easier to wrap neatly because the pattern does not have an obvious right way up.",
        ],
      },
      {
        heading: "Wrapping food gifts",
        paragraphs: [
          "If the gift is itself edible, a food design doubles the joke rather than spoiling it, but keep the paper off anything unwrapped. This is printed art paper, not food safe packaging, so a tin or a box goes between the paper and the contents.",
        ],
      },
    ],
    faq: [
      {
        q: "Is this paper safe to put against food?",
        a: "No. It is printed fine art paper meant to wrap a box or a tin. Anything edible should be in its own sealed container first.",
      },
      {
        q: "Which food designs wrap most neatly?",
        a: "The single subject repeats, such as cocoa or candy canes, because they have no obvious orientation. A design with a laid table on it has a top and a bottom, which shows if a corner folds the wrong way.",
      },
      {
        q: "Is there anything savory rather than sweet?",
        a: "Most of this set is sweet, cocoa and baking, but the Christmas dinner designs cover the savory side. The titles say which is which.",
      },
    ],
  },

  "christmas|gothic": {
    body: [
      {
        heading: "Black ground Christmas wrap",
        paragraphs: [
          "These are built on black rather than on red and green, with skulls, ravens, bats and dark botanicals worked into otherwise conventional Christmas motifs. Ornaments, holly and candles are all still there, they are just not the colors the aisle in a supermarket offers.",
          "The practical effect of a black ground is contrast. A gift in black under a lit tree stands out from a pile in a way that red does not, because everything else in the pile is already red.",
        ],
      },
      {
        heading: "Will it read as Christmas",
        paragraphs: [
          "It depends which design. The ones with ornaments, holly or candles read as Christmas immediately even in black. The pure skull and rose designs read as gothic first and Christmas second, which is the point if the recipient would rather that, and a problem if the parcel has to sit under a tree at someone else's house.",
        ],
      },
    ],
    faq: [
      {
        q: "Will a black design look out of place at a traditional family Christmas?",
        a: "The designs that keep a recognizable Christmas motif, the ornaments and the holly, sit fine next to conventional wrap. The skull led designs will get a comment, which may be the reason to buy them.",
      },
      {
        q: "Do the dark designs show fingerprints or scuffs?",
        a: "A large flat black area shows handling more than a busy pattern does, in any paper. The designs with a dense repeat across the sheet hide it better than the sparse ones.",
      },
      {
        q: "Should I pick matte or glossy for a black design?",
        a: "Matte. Gloss on a large black area turns into a mirror and picks up every light in the room, and matte is what makes the black look deep rather than gray.",
      },
    ],
  },

  "christmas|retro": {
    body: [
      {
        heading: "Which decade you are actually asking for",
        paragraphs: [
          "Retro here covers a span, and the palettes are the quickest way to tell them apart. Mid century designs lean on teal, cream and a muted red, with simple geometric baubles and hand lettered type. The seventies designs go hotter: orange, mustard, brown, with fatter shapes and more of them.",
          "If you are wrapping a gift for someone who grew up with one of these, the palette matters more than the motif. The color is what triggers the recognition.",
        ],
      },
      {
        heading: "Why it scales well",
        paragraphs: [
          "Retro designs tend to use a large, evenly spaced repeat, which makes them the easiest set here to wrap something big in. A large parcel in a small busy pattern looks like it was covered in fabric, where a large parcel in a mid century repeat looks deliberate.",
        ],
      },
    ],
    faq: [
      {
        q: "Is this vintage paper or a new print of a vintage style?",
        a: "A new print. These are original designs drawn in a retro style, printed on current stock, so you get the look without the brittleness of actual old paper.",
      },
      {
        q: "What is the difference between the mid century and seventies designs?",
        a: "Mostly palette. Mid century is teal, cream and muted red with sparse geometric shapes. Seventies is orange, mustard and brown with denser, rounder motifs.",
      },
      {
        q: "Which designs work for a large gift?",
        a: "The ones with a wide, evenly spaced repeat. Those hold their proportion on a big box, where a tight pattern starts to read as texture rather than design.",
      },
    ],
  },

  "christmas|dogs": {
    body: [
      {
        heading: "Breed specific or not",
        paragraphs: [
          "Roughly half of these name a breed in the title and half are generic dogs. The breed designs are the ones that land, because a dog person does not think of their dog as a dog, they think of it as a border collie. If the breed is in the catalog, that is the one to buy.",
          "If it is not, the generic designs split between dogs as characters, in hats and sweaters, and dogs as a repeated silhouette. The silhouettes are the safer pick for an adult.",
        ],
      },
      {
        heading: "It is going to get torn",
        paragraphs: [
          "If the gift is for the dog, or is going under a tree a dog can reach, accept that the paper is temporary. That is an argument for a busy pattern over a single large illustration, because a tear across a repeat is much less obvious.",
        ],
      },
    ],
    faq: [
      {
        q: "Is my breed in here?",
        a: "Check the product titles on this page, which name the breed where a design is breed specific. The catalog does not cover every breed, and the generic silhouette designs are the fallback.",
      },
      {
        q: "Are there designs with both a dog and a cat?",
        a: "A few designs cover both, and they sit on the cat pages as well as this one. Search this page for cat to find them.",
      },
      {
        q: "Is it suitable for wrapping a dog's own present?",
        a: "The paper is fine to wrap a toy or a treat box, but it is printed art paper rather than anything a dog should chew, so unwrap it with them rather than leaving it.",
      },
    ],
  },

  "christmas|minimalist": {
    body: [
      {
        heading: "Quiet under the tree",
        paragraphs: [
          "Single color repeats, fine line trees, and a lot of empty space. These are for the house where the tree is one color and the parcels are meant to look like part of the room rather than competing with it.",
          "The practical advantage is that a minimalist design takes a ribbon better than anything else here. There is space for it to sit without covering the pattern, which is not true of a busy repeat.",
        ],
      },
      {
        heading: "The one thing to watch",
        paragraphs: [
          "Large areas of flat, pale color show every fold and every thumbprint. If the parcel is going to be handled, posted, or sat under a tree for three weeks, a design with a light line pattern across the whole sheet will look better on the day than a nearly blank one.",
        ],
      },
    ],
    faq: [
      {
        q: "Does a plain design look like I made no effort?",
        a: "It reads as deliberate if the wrapping is tidy, which is the catch: a minimalist design depends on sharp folds in a way a busy pattern does not.",
      },
      {
        q: "Do these show creases and marks?",
        a: "More than the busier designs, yes. Flat pale areas show handling. The line pattern designs are more forgiving than the sparse ones.",
      },
      {
        q: "Matte or glossy for a minimalist design?",
        a: "Matte, in almost every case. Gloss on a large flat area is what makes paper look cheap, and matte is what makes a single color look considered.",
      },
    ],
  },

  "christmas|music": {
    body: [
      {
        heading: "For when the gift is obviously a record",
        paragraphs: [
          "Guitars, vinyl, turntables and carols turned into pattern. The honest use for these is a gift that is already music, where the wrap stops pretending otherwise, and the second use is for whoever in the family runs the December playlist.",
          "There is a spread of genre in here rather than one look. The acoustic and carol designs are warm and traditional. The electric guitar, metal and DJ designs are not, and are closer to the gothic end of the catalog in palette.",
        ],
      },
      {
        heading: "Wrapping a record",
        paragraphs: [
          "A twelve inch sleeve is the one parcel shape where a large repeat genuinely helps, because the flat front face is big enough to show a whole motif. A small tight pattern on a record sleeve reads as texture and the design is wasted.",
        ],
      },
    ],
    faq: [
      {
        q: "Is there anything for a specific instrument?",
        a: "Guitars are the best covered, acoustic and electric both. Other instruments appear in the mixed designs rather than getting their own.",
      },
      {
        q: "Are these only for music gifts?",
        a: "No, but they are at their best when the gift is music. A vinyl pattern on a sweater sized box is just a pattern.",
      },
      {
        q: "Is there anything heavier than carols?",
        a: "Yes. The metal and electric guitar designs are dark and sit closer to the gothic Christmas set than to the traditional ones.",
      },
    ],
  },

  "christmas|cottagecore": {
    body: [
      {
        heading: "Handmade without being handmade",
        paragraphs: [
          "Mushrooms, hand drawn greenery, gingham and muted winter color. These are printed designs that read as block printed or stamped, which is the whole appeal: the look of something made at a kitchen table, with none of the time it would take.",
          "The palette is the common thread and it is deliberately low contrast. Sage, oatmeal, dusty red. That makes these the easiest designs here to use across a whole pile of gifts without the pile looking chaotic, because nothing in the set fights anything else in it.",
        ],
      },
      {
        heading: "Pairing it",
        paragraphs: [
          "Cottagecore is the one set that genuinely benefits from string and a sprig rather than ribbon. The muted palette leaves room for a brown paper tag in a way a saturated design does not.",
        ],
      },
    ],
    faq: [
      {
        q: "Is this actually block printed?",
        a: "No. It is a printed design drawn to look hand blocked, so the registration is perfect and the price is the same as everything else in the shop.",
      },
      {
        q: "Will the different cottagecore designs work together?",
        a: "Better than any other set here, because they share a muted palette. You can wrap a whole family's gifts in three different designs from this page and it still looks intentional.",
      },
      {
        q: "Is it Christmas specific enough?",
        a: "The greenery and gingham designs lean seasonal rather than explicitly Christmas, which some people want. If you need it to say Christmas outright, the ones naming a holiday motif in the title are the safer pick.",
      },
    ],
  },

  "christmas|wildlife": {
    body: [
      {
        heading: "The design that works for everyone",
        paragraphs: [
          "Deer, foxes, owls and winter hares in woodland repeats. This is the set to reach for when one design has to cover a grandparent, a toddler and a teenager, because an illustrated fox in snow offends nobody and bores nobody.",
          "It is also the most traditional looking set here without being red and green. If you want Christmas wrap that looks like Christmas but not like the supermarket, this is usually the answer.",
        ],
      },
      {
        heading: "Scale and audience",
        paragraphs: [
          "The designs with a large single animal read younger and suit a child's gift. The dense woodland repeats read older and suit an adult's. Same subject, quite different effect, and the product photos make the difference obvious at a glance.",
        ],
      },
    ],
    faq: [
      {
        q: "Is this suitable for children's gifts?",
        a: "The large single animal designs are, and they work well for a child. The dense woodland repeats are more adult, though nothing in this set is unsuitable either way.",
      },
      {
        q: "Are the animals realistic or illustrated?",
        a: "Illustrated. These are drawn designs rather than photographs, which is what lets them repeat across a sheet without looking odd.",
      },
      {
        q: "Does it work outside Christmas?",
        a: "Several of these are winter rather than Christmas, so they carry through January and work for a midwinter birthday. The titles say which mention a holiday motif.",
      },
    ],
  },

  "christmas|pride": {
    body: [
      {
        heading: "Christmas designs that are not assuming",
        paragraphs: [
          "Progress stripes, trans and bi palettes, and queer coded motifs worked into ordinary Christmas designs: ornaments, trees, winter botanicals. The flag colors are part of the pattern rather than printed as a flag, so these read as a well chosen design first.",
          "That matters practically. A gift wrapped in this can sit under a tree in a mixed room without putting the recipient in the position of explaining it, which is not true of wrap with a flag printed across it.",
        ],
      },
      {
        heading: "Chosen family",
        paragraphs: [
          "This is the smallest set on this page, so if you are wrapping several gifts you will likely use the same design more than once. Varying the ribbon rather than the paper is the easier fix.",
        ],
      },
    ],
    faq: [
      {
        q: "Are the flags printed literally?",
        a: "Mostly not. The palettes are worked into the pattern, as stripes in an ornament or in winter botanicals, rather than printed as a flag across the sheet.",
      },
      {
        q: "Which palettes are covered?",
        a: "Progress, trans and bi appear across this set. The product titles name the palette where a design is specific to one.",
      },
      {
        q: "Is it obviously Christmas?",
        a: "Yes. These keep conventional Christmas motifs, trees and ornaments, and change the color rather than the subject.",
      },
    ],
  },
};

export function intersectionDetail(primary: string, secondary: string): CollectionDetail | null {
  return INTERSECTION_DETAIL[`${primary}|${secondary}`] ?? null;
}

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
  query: { types?: string[]; themes?: string[]; occasions?: string[] };
  pagePath: (page: number) => string;
  /** Breadcrumb between Collections and this page's own leaf. */
  trail: { name: string; href: string }[];
  detail?: CollectionDetail | null;
  /** Product photo for the share card, so these do not all share the generic site image. */
  imageUrl?: string;
  /** Cross-links rendered under the grid. */
  related?: { heading: string; items: { label: string; href: string; count: number }[] };
}

export async function collectionSpec(collection: Collection): Promise<CatalogSpec> {
  const related = await intersectionsFor(collection);

  return {
    label: collection.label,
    eyebrow:
      collection.kind === "type"
        ? "Product type"
        : collection.kind === "occasion"
        ? "Occasion"
        : "Theme",
    intro: introFor(collection),
    query: collectionQuery(collection),
    pagePath: (page) => collectionPagePath(collection.slug, page),
    trail: [],
    imageUrl: collection.imageUrl,
    detail: collectionDetail(collection.slug),
    related: related.length
      ? {
          heading: `More in ${collection.label}`,
          items: related.map((i) => ({
            label: i.label,
            href: intersectionPath(i.primary.slug, i.secondary.slug),
            count: i.count,
          })),
        }
      : undefined,
  };
}

export function intersectionSpec(i: Intersection): CatalogSpec {
  return {
    label: i.label,
    eyebrow: i.primary.label,
    intro: intersectionIntro(i),
    query: { ...collectionQuery(i.primary), ...collectionQuery(i.secondary) },
    pagePath: (page) => intersectionPath(i.primary.slug, i.secondary.slug, page),
    imageUrl: i.imageUrl,
    // Up is the primary axis, which is the broader page a visitor would widen to.
    trail: [{ name: i.primary.label, href: collectionPath(i.primary.slug) }],
    detail: intersectionDetail(i.primary.slug, i.secondary.slug),
  };
}
