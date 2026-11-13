/**
 * The cards the studio offers for posting, built from the catalog.
 *
 * Unlike a hand-written social calendar, every card here is a real listing, so the copy
 * can only say what the catalog already knows: the design's name, its occasion, its type,
 * its price and its link. Nothing is invented about a design this module has not read.
 *
 * What goes on the page is what is worth posting now: the occasions whose shopping window
 * is open, then whatever has been published recently. Both lists come from the modules the
 * storefront itself merchandises from, so the studio and the shop never disagree about
 * what is in season.
 */

import { newArrivals } from "@/lib/arrivals";
import {
  deriveOccasions,
  deriveProductType,
  occasionLabel,
  primaryTheme,
  productTypeLabel,
  themeLabel,
} from "@/lib/facets";
import { clampName } from "@/lib/pinterest";
import { formatPrice, hasPrice } from "@/lib/price";
import { relevantOccasions } from "@/lib/seasonal";
import { currentTheme } from "@/lib/season";
import { getAllListings } from "@/lib/shop";
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
export const LAYOUTS = ["panel", "banner", "frame", "edge"] as const;
export type Layout = (typeof LAYOUTS)[number];

/** The separately drawn layers of an animated story, matching the video's filter inputs. */
export type Part = "wash" | "eyebrow" | "title" | "details";

/** Part of every image's version hash. Bump it whenever the drawing changes, so caches refresh. */
export const STORY_DESIGN = "s1";

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
  /** Price and format, the two facts a scroller wants before tapping. */
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
  /** The full-size product photo, fetched and inlined at render time. */
  photo: string;
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

function tagsFor(listing: Listing, platform: Platform): string[] {
  const own = [
    ...deriveOccasions(listing).map(occasionLabel),
    primaryTheme(listing) ? themeLabel(primaryTheme(listing)!) : "",
    deriveProductType(listing) ? productTypeLabel(deriveProductType(listing)!) : "",
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
 * The price, alone.
 *
 * The product type belongs to the eyebrow, and carrying it here as well printed
 * "Wrapping Paper" twice on the same card. Empty when the feed has no price, which
 * `hasPrice` treats as the signal to send people to Etsy for it instead.
 */
function detailLines(listing: Listing): string[] {
  return hasPrice(listing) ? [formatPrice(listing.price, listing.currency)] : [];
}

/** Whether the design's own name already says what it is printed on. */
function namesItsType(name: string, typeName: string): boolean {
  return name.toLowerCase().includes(typeName.toLowerCase());
}

/*
  Three angles on the same design, so a card can be posted more than once without
  repeating itself. Each is a function of facts already in the listing: what it is, what
  it is for, and that it is new. Nothing claims a design sells well, because the catalog
  carries no view or favourite counts to support it.
*/
type Angle = "design" | "occasion" | "arrival";

function eyebrowFor(listing: Listing, angle: Angle): string {
  const occasion = deriveOccasions(listing)[0];
  const type = deriveProductType(listing);
  if (angle === "arrival") return "New in the shop";
  if (angle === "occasion" && occasion) return occasionLabel(occasion);
  if (type) return productTypeLabel(type);
  return "Design that hits";
}

function captionsFor(listing: Listing, angle: Angle): Record<Platform, Caption> {
  const name = listingName(listing);
  const occasion = deriveOccasions(listing)[0];
  const type = deriveProductType(listing);
  const typeName = type ? productTypeLabel(type).toLowerCase() : "design";
  const price = hasPrice(listing) ? formatPrice(listing.price, listing.currency) : null;

  // "Beach Christmas Wrapping Paper, printed on wrapping paper" reads as a bug, so a name
  // that already says what it is printed on stands on its own.
  const described = namesItsType(name, typeName) ? `${name}.` : `${name}, printed on ${typeName}.`;
  const opener =
    angle === "arrival"
      ? `Just added: ${name}.`
      : angle === "occasion" && occasion
        ? `${occasionLabel(occasion)} sorted. ${name}.`
        : described;
  const closer = price ? `${price}, printed on demand and shipped from the US.` : "Printed on demand and shipped from the US.";

  const text = `${opener} ${closer}`;
  return {
    tiktok: {
      title: clampCaption(opener, TIKTOK_TITLE_MAX),
      text,
      hashtags: tagsFor(listing, "tiktok"),
    },
    instagram: {
      text,
      hashtags: tagsFor(listing, "instagram"),
      cta: angle === "arrival" ? "🎁 See the new one" : "🎁 Shop this design",
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

/** A stable number from a string, so a card's looks are the same on every render. */
function seed(text: string): number {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return hash;
}

const ANGLES: Angle[] = ["design", "occasion", "arrival"];

function versionsFor(listing: Listing, fresh: boolean, today: PaletteId): StoryVersion[] {
  const start = seed(listingSlug(listing));
  const occasion = deriveOccasions(listing)[0];
  // A design for a holiday the palette knows is drawn in that holiday's colours whatever
  // the calendar says, so a Christmas card never goes out wearing the fall accent.
  const palette = (occasion ? OCCASION_PALETTES[occasion] : undefined) ?? today;
  // The arrival angle is a claim about the catalog, so it only appears when it is true.
  const angles = ANGLES.filter((a) => a !== "arrival" || fresh);

  return angles.map((angle, i) => ({
    eyebrow: eyebrowFor(listing, angle),
    title: clampName(listingName(listing)),
    lines: detailLines(listing),
    layout: LAYOUTS[(start + i) % LAYOUTS.length],
    palette,
    captions: captionsFor(listing, angle),
  }));
}

/** How many cards the page offers. Beyond this it stops being a shortlist. */
export const MAX_CARDS = 24;

/**
 * The cards worth posting now: in-season occasions first, then recent arrivals.
 *
 * Occasion cards lead because their window closes; arrivals keep until they stop being
 * new. A listing that is both appears once, as an occasion card, with the arrival angle
 * still among its versions.
 */
export async function storyCards(now: Date = new Date()): Promise<StoryCard[]> {
  const [listings, arrivals] = await Promise.all([getAllListings(), newArrivals(now.getTime())]);
  const today = paletteIdFor(currentTheme(now));
  const fresh = new Set(arrivals.map((l) => l.id));

  const open = relevantOccasions(now);
  const seasonal = open.flatMap((slug) =>
    listings
      .filter((l) => l.image && deriveOccasions(l).includes(slug))
      // Newest first, so a card list refreshes as the catalog grows rather than freezing.
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, Math.ceil(MAX_CARDS / 2 / open.length))
      .map((listing) => ({ listing, reason: `In season · ${occasionLabel(slug)}` }))
  );

  const recent = arrivals
    .filter((l) => l.image)
    .map((listing) => ({ listing, reason: "New arrival" }));

  const picked = new Map<string, { listing: Listing; reason: string }>();
  for (const entry of [...seasonal, ...recent]) {
    const id = listingSlug(entry.listing);
    if (!picked.has(id)) picked.set(id, entry);
    if (picked.size >= MAX_CARDS) break;
  }

  return [...picked.values()].map(({ listing, reason }) => ({
    id: listingSlug(listing),
    title: listingName(listing),
    reason,
    photo: listing.image!.url,
    versions: versionsFor(listing, fresh.has(listing.id), today),
  }));
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
export const ANIMATION = "a1";

/** The video's version: the still story's hash plus the animation's own. */
export function videoVersion(card: StoryCard, version: number): string {
  return `${storyVersion(card, version, "story")}${ANIMATION}`;
}
