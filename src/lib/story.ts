/**
 * The cards the studio offers for posting, built from the catalog.
 *
 * Unlike a hand-written social calendar, every card here is a real listing, so the copy
 * can only say what the catalog already knows: the design's name, its occasion, its type,
 * how it is made and its link. Nothing is invented about a design this module has not read.
 *
 * What goes on the page is what is worth posting now: the occasions whose shopping window
 * is open, then whatever has been published recently. Both lists come from the modules the
 * storefront itself merchandises from, so the studio and the shop never disagree about
 * what is in season.
 */

import { newArrivals } from "@/lib/arrivals";
import { ctaFor } from "@/lib/cta";
import { designLine } from "@/lib/design-line";
import {
  deriveOccasions,
  deriveProductType,
  occasionLabel,
  primaryOccasion,
  primaryTheme,
  productTypeLabel,
  themeLabel,
} from "@/lib/facets";
import { clampName } from "@/lib/pinterest";
import { relevantOccasions } from "@/lib/seasonal";
import { SHIPPING_ESTIMATE_PRODUCT_TYPE } from "@/lib/shipping";
import { currentTheme } from "@/lib/season";
import { getAllListings } from "@/lib/shop";
import { shopToday, toISODate } from "@/lib/shop-time";
import { listingName, listingPath, listingSlug } from "@/lib/slug";
import { paletteIdFor, STORY_PALETTES, type PaletteId } from "@/lib/story-palette";
import type { Listing } from "@/types/etsy";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designthathits.com";

export const STORY_FORMATS = {
  square: { width: 1080, height: 1080, label: "square (feed)" },
  story: { width: 1080, height: 1920, label: "story (TikTok, Reels, Stories)" },
} as const;
export type StoryFormat = keyof typeof STORY_FORMATS;

/*
  Four layouts, all of which keep the product photo whole.

  This is the one place the design deliberately departs from the pattern it was ported
  from. That site photographs a room, so its layouts darken the photo and set type across
  it. Here the photo IS the product: a gift wrap design under a 95% scrim is a listing
  nobody can see. So the photo either keeps its own panel or carries a band small enough
  to leave the pattern legible.
*/
export const LAYOUTS = ["banner", "panel", "edge", "frame"] as const;
export type Layout = (typeof LAYOUTS)[number];

/** The separately drawn layers of an animated story, matching the video's filter inputs. */
export type Part = "wash" | "eyebrow" | "title" | "details";

/** Part of every image's version hash. Bump it whenever the drawing changes, so caches refresh. */
export const STORY_DESIGN = "s3";

export const platforms = ["tiktok", "instagram"] as const;
export type Platform = (typeof platforms)[number];

/** TikTok photo posts take a short title and a longer description; Instagram adds a link sticker. */
export interface Caption {
  title?: string;
  text: string;
  hashtags: string[];
  cta?: string;
  link?: string;
}
export const TIKTOK_TITLE_MAX = 90;

export interface StoryVersion {
  /** The small label above the name. */
  eyebrow: string;
  /** The design's name, already cut to what the panel holds. */
  title: string;
  /** One sentence about the design, empty when the description holds none worth printing. */
  lines: string[];
  layout: Layout;
  palette: PaletteId;
  captions: Record<Platform, Caption>;
}

export interface StoryCard {
  /** The listing slug, which is also the card's path segment and its file name stem. */
  id: string;
  /** The card's name in the studio UI. */
  title: string;
  /** Why this card is on the page, shown as a chip. */
  reason: string;
  /**
   * The occasion this card is presented as, or null when it has none.
   *
   * Carried rather than re-derived, because a card is chosen for one occasion and the
   * chip, the eyebrow, the caption, the palette and the tags all have to agree with that
   * choice. Deriving it again picked a different one: `deriveOccasions` returns matches
   * in rule order, so "Pink Goth Birthday Wrapping Paper", selected for the birthday
   * window, came back Halloween and captioned itself "Halloween sorted" in July.
   */
  occasion: string | null;
  /** The full-size product photo, fetched and inlined at render time. */
  photo: string;
  /**
   * The mockups the animated story cuts between, `photo` first.
   *
   * Etsy holds up to ten per listing and the catalog keeps them all, but each one here
   * is a remote fetch and a shot to encode inside the route's time budget, so the card
   * takes only the first few. A listing the CSV export missed has just `photo`, and the
   * video falls back to the single-shot animation it has always had.
   */
  photos: string[];
  versions: StoryVersion[];
}

/* Occasions the palette can theme. Birthday and graduation have no block in globals.css,
   so a card for either keeps whatever palette the site is wearing today. */
const OCCASION_PALETTES: Record<string, PaletteId> = {
  christmas: "christmas",
  halloween: "halloween",
  valentines: "valentines",
};

/** Five per platform: the design's own first, then the shop's, capped like the feed's tags. */
const DEFAULT_TAGS: Record<Platform, string[]> = {
  tiktok: ["#giftwrap", "#wrappingpaper", "#giftideas", "#tiktokmademebuyit", "#smallbusiness"],
  instagram: ["#giftwrap", "#wrappingpaper", "#giftwrapping", "#giftideas", "#shopsmall"],
};

/** A hashtag from a label, with everything a tag cannot carry removed. */
export function toHashtag(label: string): string {
  const body = label.replace(/[^a-z0-9]+/gi, "");
  return body ? `#${body.toLowerCase()}` : "";
}

function tagsFor(listing: Listing, platform: Platform, occasion: string | null): string[] {
  const theme = primaryTheme(listing);
  const type = deriveProductType(listing);
  /* The card's own occasion only. Tagging every match put #halloween on a birthday card
     in July, which is the same contradiction the eyebrow had. */
  const own = [
    occasion ? occasionLabel(occasion) : "",
    theme ? themeLabel(theme) : "",
    type ? productTypeLabel(type) : "",
  ]
    .filter(Boolean)
    .map(toHashtag)
    .filter(Boolean);
  return [...new Set([...own, ...DEFAULT_TAGS[platform]])].slice(0, 5);
}

/** Tags the destination so studio traffic is attributable, the same way the pin link does. */
export function storyLink(listing: Listing, platform: Platform): string {
  return `${SITE_URL}${listingPath(listing)}?utm_source=${platform}&utm_medium=social&utm_campaign=studio-story`;
}

/**
 * How each kind of listing is made, as the caption's closing sentence.
 *
 * Scoped the way /contact scopes its claims: a file is not printed, and the US origin is
 * only verified for the wrapping paper blueprint. The card itself no longer prints this.
 * A caption is read once beside a post, where a fulfilment claim answers the first
 * question a buyer has; the card is pixels that stay on the design for seven seconds, and
 * they are better spent on what the design actually looks like.
 */
const MADE = {
  paper: { sentence: "Printed on demand and shipped from the US." },
  digital: { sentence: "An instant digital download on Etsy." },
  other: { sentence: "Printed on demand. Find it on Etsy." },
} as const;

function madeKind(listing: Listing): keyof typeof MADE {
  const type = deriveProductType(listing);
  if (type === SHIPPING_ESTIMATE_PRODUCT_TYPE) return "paper";
  return type === "digital" ? "digital" : "other";
}

/**
 * The one line under the design's name.
 *
 * Empty for a listing whose description holds no sentence that stands alone on a card.
 * The card then prints its name and its domain, which is still a complete card.
 */
function detailLines(listing: Listing): string[] {
  const line = designLine(listing);
  return line ? [line] : [];
}

/*
  Three angles on the same design, so a card can be posted more than once without
  repeating itself. Each is a function of facts already in the listing: what it is, what
  it is for, and that it is new. Nothing claims a design sells well, because the catalog
  carries no view or favourite counts to support it.
*/
type Angle = "design" | "occasion" | "arrival";

function eyebrowFor(listing: Listing, angle: Angle, occasion: string | null): string {
  const type = deriveProductType(listing);
  if (angle === "arrival") return "New in the shop";
  if (angle === "occasion" && occasion) return occasionLabel(occasion);
  if (type) return productTypeLabel(type);
  return "Design that hits";
}

function captionsFor(
  listing: Listing,
  angle: Angle,
  occasion: string | null
): Record<Platform, Caption> {
  const name = listingName(listing);

  /*
    The name alone, never "printed on <product type>". Those labels are plural categories
    rather than materials, so the sentence came out as "Golf Shirt, printed on t-shirts &
    apparel" and, worse, "printed on digital downloads". The eyebrow carries the category.
  */
  const opener =
    angle === "arrival"
      ? `Just added: ${name}.`
      : angle === "occasion" && occasion
        ? `${occasionLabel(occasion)} sorted. ${name}.`
        : `${name}.`;

  // Only the caption carries this; the card gives the space to the design instead.
  const text = `${opener} ${MADE[madeKind(listing)].sentence}`;
  return {
    tiktok: {
      title: clampCaption(opener, TIKTOK_TITLE_MAX),
      text,
      hashtags: tagsFor(listing, "tiktok", occasion),
    },
    instagram: {
      text,
      hashtags: tagsFor(listing, "instagram", occasion),
      cta: ctaFor(listing, occasion),
      link: storyLink(listing, "instagram"),
    },
  };
}

/** Cuts to a limit on a word boundary, since a TikTok title is truncated mid-word otherwise. */
export function clampCaption(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/**
 * The instant the arrivals cutoff is measured from: the start of the shop's calendar day.
 *
 * `newArrivals` otherwise cuts at `now - 45 days` to the second, so a listing fell out of
 * the set partway through an afternoon while the page's prerendered HTML still carried
 * its image and save URLs, and every one of them 404d until the page revalidated. The
 * occasion windows and the palette are already day-granular, so this makes the whole card
 * set a function of the shop's date rather than of the clock.
 *
 * The date is read in the shop's timezone and then measured from UTC midnight. The offset
 * between those does not matter: all that is needed is one value per shop day.
 */
export function shopDayStart(now: Date): number {
  return Date.parse(`${toISODate(shopToday(now))}T00:00:00Z`);
}

/** A stable number from a string, so a card's looks are the same on every render. */
function seed(text: string): number {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return hash;
}

const ANGLES: Angle[] = ["design", "occasion", "arrival"];

function versionsFor(
  listing: Listing,
  fresh: boolean,
  today: PaletteId,
  occasion: string | null
): StoryVersion[] {
  const start = seed(listingSlug(listing));
  // A design for a holiday the palette knows is drawn in that holiday's colours whatever
  // the calendar says, so a Christmas card never goes out wearing the fall accent.
  const palette = (occasion ? OCCASION_PALETTES[occasion] : undefined) ?? today;

  /*
    An angle only appears when it is true of this listing. Without the occasion guard a
    design with none produced two byte-identical versions, because the occasion angle
    fell through to the same eyebrow and the same caption as the design angle.
  */
  const angles = ANGLES.filter(
    (a) => (a !== "arrival" || fresh) && (a !== "occasion" || Boolean(occasion))
  );

  return angles.map((angle, i) => ({
    eyebrow: eyebrowFor(listing, angle, occasion),
    title: clampName(listingName(listing)),
    lines: detailLines(listing),
    /*
      `start * 2` is even, so version 0 always lands on a full-bleed layout and every
      card offers an animated story even when it has only one version. The versions then
      alternate full-bleed and stacked.
    */
    layout: LAYOUTS[(start * 2 + i) % LAYOUTS.length],
    palette,
    captions: captionsFor(listing, angle, occasion),
  }));
}

/** How many cards the page offers. Beyond this it stops being a shortlist. */
export const MAX_CARDS = 24;

/**
 * How many mockups an animated story cuts between.
 *
 * Sellers put their strongest photo first, and the pure-white pattern swatches sit at
 * the end of the set, so taking the first few needs no judgement about what a shot
 * contains. Four holds each one on screen for about two seconds in a seven-second clip,
 * which is long enough to read a design and short enough to keep moving.
 */
export const MAX_SHOTS = 4;

/**
 * The cards worth posting now: in-season occasions first, then recent arrivals.
 *
 * Occasion cards lead because their window closes; arrivals keep until they stop being
 * new. A listing that is both appears once, as an occasion card, with the arrival angle
 * still among its versions.
 */
export async function storyCards(now: Date = new Date()): Promise<StoryCard[]> {
  const [listings, arrivals] = await Promise.all([
    getAllListings(),
    newArrivals(shopDayStart(now)),
  ]);
  const today = paletteIdFor(currentTheme(now));
  const fresh = new Set(arrivals.map((l) => l.id));

  const open = relevantOccasions(now);
  const seasonal = open.flatMap((slug) =>
    listings
      .filter((l) => l.image && deriveOccasions(l).includes(slug))
      // Newest first, so a card list refreshes as the catalog grows rather than freezing.
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, Math.ceil(MAX_CARDS / 2 / open.length))
      // The slug that selected it, so the chip and the copy cannot disagree.
      .map((listing) => ({ listing, reason: `In season · ${occasionLabel(slug)}`, occasion: slug }))
  );

  const recent = arrivals
    .filter((l) => l.image)
    // Nothing selected these for an occasion, so the listing's own leading one is used.
    .map((listing) => ({ listing, reason: "New arrival", occasion: primaryOccasion(listing) }));

  const picked = new Map<string, { listing: Listing; reason: string; occasion: string | null }>();
  for (const entry of [...seasonal, ...recent]) {
    const id = listingSlug(entry.listing);
    if (!picked.has(id)) picked.set(id, entry);
    if (picked.size >= MAX_CARDS) break;
  }

  return [...picked.values()].map(({ listing, reason, occasion }) => ({
    id: listingSlug(listing),
    title: listingName(listing),
    reason,
    occasion,
    photo: listing.image!.url,
    photos: shotsFor(listing),
    versions: versionsFor(listing, fresh.has(listing.id), today, occasion),
  }));
}

/**
 * The mockups this card animates, always starting with the one the still uses.
 *
 * De-duplicated because a listing whose export row repeats a URL would otherwise hold
 * the same shot twice and read as a stall in the middle of the clip.
 */
function shotsFor(listing: Listing): string[] {
  const first = listing.image!.url;
  return [...new Set([first, ...(listing.images ?? [])])].slice(0, MAX_SHOTS);
}

/**
 * Short content hash for one version's image URL.
 *
 * The route renders only the hash the page generated, so a stale tab cannot force a
 * render of a card that has since changed, and a made-up query cannot fill the CDN with
 * one-off variants that each cost a remote photo fetch and a megabyte of PNG.
 */
export function storyVersion(card: StoryCard, version: number, format: StoryFormat): string {
  const v = card.versions[version];
  if (!v) return "";
  const text = [
    v.eyebrow,
    v.title,
    ...v.lines,
    card.photo,
    v.palette,
    STORY_PALETTES[v.palette].brand,
    v.layout,
    STORY_DESIGN,
    format,
  ].join("|");
  return seed(text).toString(36);
}

/**
 * Whether a version's layout leaves the photo filling the frame.
 *
 * Only those animate: `panel` and `frame` give the photo part of the canvas and the rest
 * to the page, which ffmpeg cannot reproduce without a second copy of the geometry.
 *
 * Deliberately here rather than beside the encoder. The page needs to know which versions
 * offer a video, and importing that from the ffmpeg module traced its 68 MB binary into
 * the page's own bundle.
 */
export function animatable(card: StoryCard, version: number): boolean {
  const layout = card.versions[version]?.layout;
  return layout === "banner" || layout === "edge";
}

/** Bumped whenever the motion changes, so a cached video re-renders. */
export const ANIMATION = "a2";

/**
 * The video's version: the still story's hash, the animation's own, and the shots.
 *
 * The still draws only `photo`, so the extra mockups are hashed here rather than in
 * `storyVersion`, which would churn every cached PNG for a change they cannot show.
 */
export function videoVersion(card: StoryCard, version: number): string {
  const shots = seed(card.photos.join("|")).toString(36);
  return `${storyVersion(card, version, "story")}${ANIMATION}${shots}`;
}
