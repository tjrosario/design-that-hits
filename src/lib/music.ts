/**
 * lib/music.ts
 *
 * What to type into a sound search to find audio that fits a design.
 *
 * Not a track, and deliberately not a link. The audio a post can legally use is whatever
 * the platform's own library holds that week, which no catalogue here can know, and a
 * commercial sound on TikTok is gone from Instagram and back again a fortnight later.
 * What survives that churn is the search: "vegas lounge" finds something usable on any
 * platform on any day. So these are terms to paste into the sound picker, ordered from
 * the one that fits this design to the one that fits the season.
 *
 * Each term is short enough to be a real query. "Upbeat vintage casino swing with sleigh
 * bells" is a description of a song, not something a sound search has ever matched.
 */

import { deriveProductType } from "@/lib/facets";
import { subjectFor } from "@/lib/subject";
import type { Listing } from "@/types/etsy";

/** More than this and the chips stop being a shortlist and become a wall to read. */
const MAX_TERMS = 5;

/** The season, which is usually the best-stocked shelf in any sound library. */
const OCCASION_MUSIC: Record<string, string[]> = {
  christmas: ["christmas jazz", "cozy christmas"],
  halloween: ["spooky halloween", "halloween trap"],
  birthday: ["birthday party", "celebration pop"],
  valentines: ["romantic love song", "soft valentine"],
  graduation: ["graduation anthem", "celebration pop"],
};

/**
 * How the design feels, which decides the tempo more than its subject does.
 *
 * Read in order, first match wins, so the stronger words sit above the vaguer ones:
 * plenty of descriptions call a design both "elegant" and "bright".
 */
const MOODS: { pattern: RegExp; term: string }[] = [
  { pattern: /\bdark\b|moody|dramatic|mysterious|eerie|macabre/i, term: "moody cinematic" },
  { pattern: /elegant|luxe|luxurious|sophisticated|refined|timeless/i, term: "elegant piano" },
  { pattern: /playful|whimsical|quirky|silly|mischievous/i, term: "upbeat playful" },
  { pattern: /cozy|cosy|\bwarm\b|nostalgic|old-fashioned/i, term: "cozy acoustic" },
  { pattern: /\bcute\b|adorable|sweet|charming/i, term: "cute wholesome" },
  { pattern: /\bbold\b|vibrant|bright|colou?rful|cheerful/i, term: "upbeat pop" },
  { pattern: /minimal|\bcalm\b|serene|gentle|understated/i, term: "calm ambient" },
];

/**
 * The format the post itself takes, which is its own corner of every sound library.
 *
 * Wrapping a gift on camera is a genre with its own audio, and so is an outfit cut. This
 * is the one term here that comes from the product rather than the design.
 */
const PRODUCT_MUSIC: Record<string, string> = {
  "wrapping-paper": "gift wrapping asmr",
  apparel: "outfit transition",
  hat: "outfit transition",
  ornament: "tree decorating",
  drinkware: "cozy morning",
  sticker: "sticker haul",
  tote: "outfit transition",
  stationery: "stationery asmr",
  "wall-art": "room makeover",
  "phone-case": "phone case unboxing",
  digital: "satisfying design",
};

/** Used only when a design has no subject, no season and no mood anywhere in its text. */
const FALLBACK = "trending audio";

/**
 * Terms to search a sound library for, most specific first.
 *
 * The subject leads because it is what makes this post different from the last one, then
 * the season, then the mood, then the format. A design can match all four, so the list is
 * cut rather than padded.
 */
export function musicFor(listing: Listing, occasion: string | null): string[] {
  const text = `${listing.title} ${listing.description ?? ""}`;
  const mood = MOODS.find((m) => m.pattern.test(text))?.term;
  const product = PRODUCT_MUSIC[deriveProductType(listing) ?? ""];

  const subject = subjectFor(listing)?.music ?? [];

  /* One seasonal term beside a subject, two without one. Both shelves are well stocked,
     and a design with nothing more specific to say has the room to spare. This is what
     keeps the list short, rather than the cut below: two subject terms, one season and
     one mood is four, which leaves the format term its place at the end. */
  const season = (OCCASION_MUSIC[occasion ?? ""] ?? []).slice(0, subject.length > 0 ? 1 : 2);

  const terms = [...new Set([...subject, ...season, mood, product].filter((t): t is string => !!t))];
  // A backstop, not the shaping: it only bites if the tables above ever grow a longer row.
  return terms.length > 0 ? terms.slice(0, MAX_TERMS) : [FALLBACK];
}
