/**
 * lib/design-line.ts
 *
 * One sentence about what a design looks like, taken from the listing's own description.
 *
 * A story card has to say something about the design itself, and the only writing this
 * app has about a design is the description the shop already published. Nothing here
 * invents a claim: every line it returns is a sentence the listing page prints too.
 *
 * Etsy descriptions are not written for this, though. They are emoji-heavy marketing
 * prose with the design buried between a hook, a bullet list and a shipping note, and the
 * strongest sentence is rarely the first. So this reads every sentence, discards the ones
 * that cannot stand alone on a card, and keeps the most concrete of what is left. When a
 * description holds nothing that survives it returns "", and the card prints no line,
 * which is the one outcome that can never be wrong.
 */

import { parseDescription } from "@/lib/description";
import type { Listing } from "@/types/etsy";

/**
 * The longest line a card can hold.
 *
 * Three lines of prose under a name that can itself run to three, inside a band that is
 * 45% of the frame on the tightest layout. Past this the sentence either crowds the name
 * or reads as a paragraph, which is not what a story card is for.
 */
const MAX_CHARS = 150;

/** Shortest line still worth printing. Below this a sentence says nothing a title has not. */
const MIN_CHARS = 40;

/* Emoji, the variation selector and zero-width joiner that bind them, and the enclosing
   keycap. Sellers punctuate with these, and satori has no font that draws them. */
const EMOJI = /[\p{Extended_Pictographic}\p{Default_Ignorable_Code_Point}\p{Me}]/gu;

/** The sentence has to be about the design, not about the product or the order. */
const DESIGN = /\b(design|pattern|illustration|artwork|motif|print)s?\b/i;

/* Fulfilment, materials and dimensions. Those belong on the listing, not on a card, and
   the card no longer carries a made-on-demand line for them to duplicate. */
const LOGISTICS =
  /\b(printed on|print-on-demand|ships?|shipping|delivery|order|download|polyester|cotton|fabric|ink|gsm|inch|return|refund|etsy|you'?ll receive|files?|size|sheet)\b/i;

/* Openers that start a dependent clause. Lifted out of their paragraph they read as a
   sentence that was cut off: "Set against a rich deep forest green background." */
const DEPENDENT =
  /^(set against|perfect for|ideal for|whether|great for|wrap |bring |give |add |make |from |each |available|use |simply )/i;

/* Pronouns with no antecedent on a card. The description introduced the subject a
   paragraph earlier; the card shows this sentence alone, where "him" names nobody. */
const DANGLING = /\b(he|him|his|she|her|hers|they|them|their)\b/i;

/* Sentences that mention the design without describing it, such as "Birthday details are
   incorporated throughout the pattern." True, and worth no pixels. */
const EMPTY =
  /\b(doesn'?t just|not just|plenty of room|generous|major part|incorporated throughout|throughout the (pattern|design)|you'?ll love|we love|our favou?rites?)\b/i;

/* Words that mean a sentence is doing real describing: naming colours, motifs or style. */
const CONCRETE =
  /\b(features?|combines?|mixes?|packed with|filled with|blends?|pairs?|scattered|against a|tones?|colou?rs?|palette|hand-drawn|watercolou?r|vintage|retro|seamless|repeat)\b/i;

/* Where a sentence stops describing and starts enumerating or selling. Cutting here
   leaves a whole sentence behind, unlike cutting at an arbitrary comma. */
const TAIL =
  /,\s+(including|featuring|plus|along with|complete with|making it|perfect for|ideal for|so you|all against|and plenty)\b.*$/i;

/** A full stop, or an emoji standing in for one before the next capital letter. */
const BOUNDARY = /(?<=[.!?])\s+|(?<=\p{Extended_Pictographic}\p{Default_Ignorable_Code_Point}?)\s*(?=[A-Z])/u;

/** Strips emoji and the punctuation they leave stranded, plus the odd markdown bold. */
function clean(sentence: string): string {
  return sentence
    .replace(/\*\*/g, "")
    .replace(EMOJI, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/([,;:])\s*(?=[,;:])/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Every prose sentence in a description, bullet lists left out.
 *
 * Split line by line rather than across the whole paragraph. A seller's heading sits on
 * its own line inside a paragraph that `parseDescription` leaves whole, because it only
 * promotes a line to a heading when a bullet follows it. Splitting the paragraph as one
 * string finds no boundary at that newline and welds the heading onto the sentence under
 * it: "Vintage Sporting Club Style The detailed birds...". Split per line, the heading is
 * its own candidate, and the terminal-punctuation guard below drops it.
 *
 * Within a line, split the raw text rather than the cleaned text, because sellers end a
 * sentence with an emoji instead of a full stop often enough that removing those first
 * welds two sentences into one: "...timeless minimalism Soft white tones...".
 */
function sentences(description: string): string[] {
  const out: string[] = [];
  for (const block of parseDescription(description)) {
    if (block.kind !== "paragraph") continue;
    for (const line of block.text.split("\n")) {
      for (const part of line.split(BOUNDARY)) {
        const text = clean(part);
        if (text) out.push(text);
      }
    }
  }
  return out;
}

export function designLine(listing: Listing): string {
  const candidates: { text: string; score: number }[] = [];

  for (const sentence of sentences(listing.description ?? "")) {
    if (!DESIGN.test(sentence)) continue;
    if (LOGISTICS.test(sentence) || DEPENDENT.test(sentence)) continue;
    if (DANGLING.test(sentence) || EMPTY.test(sentence)) continue;
    /* No terminal punctuation means this is a heading or a line the seller never
       finished, not a sentence a card can print. */
    if (!/[.!?]$/.test(sentence)) continue;

    const text = sentence.length <= MAX_CHARS ? sentence : sentence.replace(TAIL, ".");
    if (text.length < MIN_CHARS || text.length > MAX_CHARS) continue;

    // A describing sentence always beats a vague one; among equals, the fuller one wins.
    candidates.push({ text, score: (CONCRETE.test(text) ? 1000 : 0) + text.length });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.text ?? "";
}
