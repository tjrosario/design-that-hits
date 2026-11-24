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
import { captionLines, type Angle } from "@/lib/caption";
import { ctaFor } from "@/lib/cta";
import { designLine } from "@/lib/design-line";
import { musicFor } from "@/lib/music";
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
import { currentTheme } from "@/lib/season";
import { getAllListings } from "@/lib/shop";
import { shopToday, toISODate } from "@/lib/shop-time";
import { listingName, listingPath, listingSlug } from "@/lib/slug";
import { kitFor, type KitId } from "@/lib/story-kit";
import { paletteIdFor, type PaletteId } from "@/lib/story-palette";
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
export const STORY_DESIGN = "s4";

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
  palette: KitId;
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
   * Terms to paste into a sound search, so a post can carry audio that fits the design.
   *
   * On the card rather than on a version, because the audio follows the design and the
   * versions are only the same design said a different way.
   */
  music: string[];
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

/*
  The three occasions that are also a look.

  Christmas, Halloween and Valentine's carry colours of their own that a shopper reads
  before any word on the card, and they outrank the design's theme: a goth Christmas paper
  posted in December is a Christmas paper first.
*/
const OCCASION_KITS: Record<string, KitId> = {
  christmas: "christmas",
  halloween: "halloween",
  valentines: "valentines",
};

/*
  The occasions people shop by rather than decorate by.

  A birthday has no agreed palette the way Christmas does, so the design's own theme is
  the better guide and these are consulted only after it. They exist at all because a
  birthday design with no theme would otherwise wear whatever the calendar is wearing,
  which is how a Sweet 16 paper went out in Thanksgiving browns.
*/
const PLAIN_OCCASION_KITS: Record<string, KitId> = {
  birthday: "birthday",
  graduation: "graduation",
};

/*
  Themes with a kit of their own, which is most of the catalog: gothic, glam, retro,
  floral and cottagecore, plus cats and dogs sharing one. A theme with no entry falls
  through to the calendar, which is what every listing did before.
*/
const THEME_KITS: Record<string, KitId> = {
  gothic: "gothic",
  glam: "glam",
  retro: "retro",
  floral: "floral",
  cottagecore: "cottagecore",
  cats: "pets",
  dogs: "pets",
};

/**
 * The kit a card is drawn in: its occasion's, then its theme's, then today's.
 *
 * Every card used to take the third branch unless it was one of three holidays, so the
 * whole page was drawn in one accent and differed only by photo.
 */
function kitIdFor(listing: Listing, occasion: string | null, today: PaletteId): KitId {
  const dated = occasion ? OCCASION_KITS[occasion] : undefined;
  if (dated) return dated;

  const theme = primaryTheme(listing);
  const themed = theme ? THEME_KITS[theme] : undefined;
  if (themed) return themed;

  return (occasion ? PLAIN_OCCASION_KITS[occasion] : undefined) ?? today;
}

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
 * The one line under the design's name.
 *
 * Empty for a listing whose description holds no sentence that stands alone on a card.
 * The card then prints its name and its domain, which is still a complete card.
 */
function detailLines(listing: Listing): string[] {
  const line = designLine(listing);
  return line ? [line] : [];
}

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
  /* Both platforms take the same body. What differs is the surface around it: TikTok
     wants a short title above its description, and Instagram carries the ask on a link
     sticker rather than in the text. */
  const lines = captionLines(listing, angle, occasion);
  const text = lines.join("\n");
  return {
    tiktok: {
      title: clampCaption(lines[0], TIKTOK_TITLE_MAX),
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
  // A design for a holiday the kits know is drawn in that holiday's colours whatever the
  // calendar says, so a Christmas card never goes out wearing the fall accent.
  const palette = kitIdFor(listing, occasion, today);

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
 * Every mockup the listing has, which is at most ten because that is Etsy's own limit on
 * a listing's photos. The number is kept as a bound rather than a choice: it caps the
 * inputs one ffmpeg call is handed, and the tests read it.
 */
export const MAX_SHOTS = 10;

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

  return [...picked.values()].map(({ listing, reason, occasion }) => {
    // The still draws the first shot, so the two cannot disagree about which photo it is.
    const photos = shotsFor(listing);
    return {
      id: listingSlug(listing),
      title: listingName(listing),
      reason,
      occasion,
      photo: photos[0],
      photos,
      music: musicFor(listing, occasion),
      versions: versionsFor(listing, fresh.has(listing.id), today, occasion),
    };
  });
}

/**
 * The mockups this card animates, led by the one the still uses.
 *
 * De-duplicated by Etsy's own image id rather than by URL, because the same photo
 * reaches the catalogue by two routes at two sizes: the feed gives the primary photo as
 * `il_570xN` and the mockup export gives it as `il_fullxfull`. Comparing strings let
 * that pair through, which showed one photo twice in a clip and spent a slot that a real
 * mockup wanted. Where both sizes arrive, the larger one wins: these render at 1080 wide.
 */
function shotsFor(listing: Listing): string[] {
  const shots = new Map<string, string>();
  for (const url of [listing.image!.url, ...(listing.images ?? [])]) {
    const key = etsyImageId(url) ?? url;
    const held = shots.get(key);
    if (!held || (isThumbnail(held) && !isThumbnail(url))) shots.set(key, url);
  }
  return [...shots.values()].slice(0, MAX_SHOTS);
}

/** The photo's own id in an Etsy image URL, which is the same across its sizes. */
function etsyImageId(url: string): string | null {
  return /il_[a-z0-9]+x[a-z0-9]+\.(\d+)/i.exec(url)?.[1] ?? null;
}

/** Etsy's listing-card size, far too small to fill a 1080-wide frame. */
function isThumbnail(url: string): boolean {
  return url.includes("il_570xN");
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
    kitFor(v.palette).brand,
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
export const ANIMATION = "a4";

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
