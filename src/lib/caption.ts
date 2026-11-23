/**
 * lib/caption.ts
 *
 * The post copy for a story card, built out of the listing's own description.
 *
 * This replaces a caption that was the design's name followed by a fulfilment sentence.
 * Every post in the shop's history therefore read "<name>. Printed on demand and shipped
 * from the US.", which is true, identical across 418 listings, and says nothing about the
 * thing in the photo. A caption is the one surface where there is room to say what the
 * design actually is, and the description already says it.
 *
 * So a caption is three lines, each a fact the catalogue holds:
 *
 *   1. what it is, led by the emoji for whatever is drawn on it
 *   2. what it looks like, which is a sentence the listing page prints too
 *   3. who it is for, which is the audience the seller wrote out
 *
 * Line 2 is dropped when the description holds no sentence that stands on its own, and
 * line 3 names nobody when no rule and no "perfect for" phrase does. Nothing here invents
 * a claim about a design: the worst case is a shorter caption, not a wrong one.
 *
 * Emoji are chosen for meaning rather than decoration. The subject's emoji leads, because
 * that is what a reader sees first and it has to match the photo; the occasion's closes
 * line 1 when it is not already leading it; the product's sits beside the ask, where it
 * stands for the thing being bought.
 */

import {
  OCCASION_EMOJI,
  PRODUCT_CTA,
  PRODUCT_FALLBACK,
  audienceFor,
} from "@/lib/cta";
import { designLine } from "@/lib/design-line";
import { deriveProductType, occasionLabel } from "@/lib/facets";
import { listingName } from "@/lib/slug";
import { matchSubject, subjectFor } from "@/lib/subject";
import type { Listing } from "@/types/etsy";

/**
 * Three angles on the same design, so a card can be posted more than once without
 * repeating itself.
 *
 * Each is a function of facts already in the listing: what it is, what it is for, and
 * that it is new. Nothing claims a design sells well, because the catalogue carries no
 * view or favourite counts to support it.
 */
export type Angle = "design" | "occasion" | "arrival";

/** What the design is printed on, beside the ask. Keyed by `deriveProductType`. */
const PRODUCT_EMOJI: Record<string, string> = {
  "wrapping-paper": "\u{1F381}",
  apparel: "\u{1F455}",
  hat: "\u{1F9E2}",
  ornament: "\u{1F514}",
  drinkware: "☕",
  sticker: "\u{1F3F7}\u{FE0F}",
  tote: "\u{1F45C}",
  stationery: "\u{1F48C}",
  "wall-art": "\u{1F5BC}\u{FE0F}",
  "phone-case": "\u{1F4F1}",
  digital: "⬇\u{FE0F}",
};

/** For a listing whose type no rule names. A shopping bag fits anything on sale. */
const PRODUCT_FALLBACK_EMOJI = "\u{1F6CD}\u{FE0F}";

/** Opens the sentence about what the design looks like. */
const ART = "\u{1F3A8}";

/** Leads line 1 for a design with no subject, no occasion and no product type. */
const SPARKLE = "✨";

/**
 * How long a caption's design sentence can run.
 *
 * Longer than the card's 150, because a caption is a paragraph in a feed rather than type
 * inside a band. Still capped: past this the description's own tail of bullet points and
 * keyword lists starts coming through.
 */
const CAPTION_LINE_MAX = 200;

/** What the post leads with, which is also the TikTok title. */
function openerFor(listing: Listing, angle: Angle, occasion: string | null): string {
  const name = listingName(listing);
  if (angle === "arrival") return `Just added: ${name}`;
  if (angle === "occasion" && occasion) return `${occasionLabel(occasion)} sorted. ${name}`;
  return name;
}

/**
 * The sentence about what the design looks like, or "" when there is none.
 *
 * The card's own line first, since that rule is the stricter of the two and has already
 * been read across the catalogue. Only when a description holds no sentence naming a
 * design, pattern or print does this fall back to the looser read, which takes a sentence
 * that describes the artwork without using any of those words.
 */
export function captionLine(listing: Listing): string {
  return (
    designLine(listing) ||
    designLine(listing, {
      requireDesignWord: false,
      maxChars: CAPTION_LINE_MAX,
      emojiTerminates: true,
    })
  );
}

/**
 * The caption, a line at a time. Line 1 doubles as the TikTok title, so it is returned
 * separately rather than sliced back out of the joined text.
 */
export function captionLines(
  listing: Listing,
  angle: Angle,
  occasion: string | null
): string[] {
  const subject = subjectFor(listing);
  const audience = audienceFor(listing);
  /* The emoji is read with the words beside it, so an audience that names a subject of
     its own wins: a caption about disco went out under a crystal ball otherwise, because
     the description mentions a witch further down. */
  const named = audience ? matchSubject(audience) : null;
  const type = deriveProductType(listing) ?? "";
  const season = OCCASION_EMOJI[occasion ?? ""] ?? "";
  const product = PRODUCT_EMOJI[type] ?? PRODUCT_FALLBACK_EMOJI;

  const lead = (named ?? subject)?.emoji || season || PRODUCT_EMOJI[type] || SPARKLE;
  // The season closes line 1, unless it is already the emoji opening it.
  const tail = season && season !== lead ? ` ${season}` : "";
  const lines = [`${lead} ${openerFor(listing, angle, occasion)}${tail}`];

  const design = captionLine(listing);
  if (design) lines.push(`${ART} ${design}`);

  /* Phrased as the audience rather than as the ask, because Instagram already carries
     the ask on its link sticker and the two sat two rows apart saying the same words. */
  const ask = PRODUCT_CTA[type] ?? PRODUCT_FALLBACK;
  const who = audience || subject?.who || "";
  lines.push(`${product} ${who ? `Made for ${who}` : ask.alone}.`);

  return lines;
}
