/**
 * lib/cta.ts
 *
 * The Instagram call to action, derived from the listing's own description.
 *
 * "Shop this design" reads the same under a pug as under a slot machine, and asks for
 * nothing in particular. What a design is about is written down in one place only: the
 * description the shop already published. Titles and tags are keyword-stuffed, and the
 * theme facets built from them answer a different question. They file a vintage Vegas
 * Christmas paper under "retro" because the word "vintage" appears in its title, which is
 * true about its styling and says nothing about the casino on the paper.
 *
 * So the subject comes from the description, two ways. Sellers usually write the audience
 * out themselves ("perfect for poker players, casino enthusiasts, card game lovers"), and
 * that phrase is used whenever it is short and specific enough to print. When it is not,
 * a subject matched in the description stands in. A design with neither keeps the
 * season's emoji and a plain ask, which is never wrong, only plain.
 */

import { deriveProductType } from "@/lib/facets";
import { matchSubject, subjectFor } from "@/lib/subject";
import type { Listing } from "@/types/etsy";

const EMOJI = /[\p{Extended_Pictographic}\p{Default_Ignorable_Code_Point}\p{Me}]/gu;

/*
  Runs to the end of the sentence: a character cap here cuts words in half. The colon is
  allowed because "PERFECT FOR:" is a heading sellers write above a bulleted audience.
*/
const CUE = /\b(?:perfect|ideal|great|made|a must)\s+for\b[:\s]+([^.!?\n]+)/gi;

/*
  Sits between the cue and the audience, or joins this item to the one before it. The
  bullet marker is there because sellers write "Perfect for:" as a heading over a list,
  and the cue's own whitespace then runs on to the first bullet.
*/
const LEAD_IN =
  /^(?:[-\u2022*\u2023\u25AA\u25CF\u2043\u2713\u2714:]\s*)?(?:and|or|also|gifting to|giving to|giving|gifting|gifts? for|use on|wrapping)?\s*/i;

/**
 * Words that mean the phrase names a person rather than an event or an object.
 *
 * This is the whole filter. An explicit list of generic phrases sat beside it for a
 * while, rejecting "Christmas presents" and "any occasion", until a run across the
 * catalogue showed it never rejected anything this had not already: none of those name
 * a person either.
 */
const PEOPLE =
  /\b(lovers?|fans?|players?|enthusiasts?|collectors?|golfers?|travell?ers?|owners?|parents?|moms?|dads?|kids?|teens?|women|men|families|households?|anyone|someone|people|those who|girls|boys|grandparents?)\b/i;

/** Longest audience that still leaves the CTA an ask rather than a sentence. */
const MAX_AUDIENCE = 44;

/** Carries the emoji for a design whose subject no rule names, but which has a season. */
const OCCASION_EMOJI: Record<string, string> = {
  christmas: "\u{1F384}",
  halloween: "\u{1F383}",
  birthday: "\u{1F382}",
  valentines: "\u{1F498}",
  graduation: "\u{1F393}",
};

const GIFT = "\u{1F381}";

/*
  What the thing is. `buy` is phrased to take "for <audience>" after it, and `alone` is
  the whole ask for a design with no audience to name.
*/
const PRODUCT_CTA: Record<string, { buy: string; alone: string }> = {
  "wrapping-paper": { buy: "Wrap a gift", alone: "Wrap something in it" },
  apparel: { buy: "Grab a tee", alone: "Wear the design" },
  hat: { buy: "Grab a cap", alone: "Wear it out" },
  ornament: { buy: "Grab an ornament", alone: "Hang it on the tree" },
  drinkware: { buy: "Grab a mug", alone: "Fill it up" },
  sticker: { buy: "Grab a sticker", alone: "Stick it somewhere good" },
  tote: { buy: "Grab a tote", alone: "Take it everywhere" },
  stationery: { buy: "Grab a card", alone: "Send it to someone" },
  "wall-art": { buy: "Grab a print", alone: "Put it on the wall" },
  "phone-case": { buy: "Grab a case", alone: "Dress your phone" },
  digital: { buy: "Download it", alone: "Download it today" },
};

const PRODUCT_FALLBACK = { buy: "Grab this design", alone: "Shop this design" };

/*
  Spaces and tabs collapse, newlines survive. The cue regex stops at a line break, and
  without that a heading ran into the sentence under it: "PERFECT FOR CASINO & CHRISTMAS
  LOVERS Great for gifting to poker players" came back as one 60-character audience.
*/
function clean(text: string): string {
  return text
    .replace(EMOJI, " ")
    .replace(/\*\*/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

/**
 * The audience the seller wrote, when one of them is short and specific enough to print.
 *
 * A description often carries several "perfect for" sentences, and the useful one is
 * rarely the first: the casino paper opens with "perfect for Christmas presents" and only
 * later says "poker players, casino enthusiasts, card game lovers". So every one is read
 * and the best is kept.
 */
export function audienceFor(listing: Listing): string {
  const picks: { item: string; score: number }[] = [];

  for (const match of clean(listing.description ?? "").matchAll(CUE)) {
    let phrase = match[1].trim();
    // An all-caps section heading, such as "PERFECT FOR CASINO & CHRISTMAS LOVERS".
    if (phrase === phrase.toUpperCase() && /[A-Z]{3}/.test(phrase)) phrase = phrase.toLowerCase();

    /* Split on commas only. Splitting on "and" as well tore "women who love golf and
       good friends" into two halves that each read as the whole audience. */
    phrase.split(/\s*,\s*/).forEach((part, index) => {
      const item = part
        .replace(LEAD_IN, "")
        // Debris from the end of a list: "...and nature lovers alike".
        .replace(/\s+(?:alike|too|as well|and more)$/i, "")
        .replace(/[.;:]+$/, "")
        .trim();
      if (item.length < 5 || item.length > MAX_AUDIENCE) return;
      if (!PEOPLE.test(item)) return;
      /* A lone singular noun needs an article this phrasing cannot give it: a list of
         "a parent, grandparent, or friend" otherwise yields "for grandparent". */
      if (!item.includes(" ") && !item.endsWith("s")) return;
      /* The first item of a list is the primary audience and the rest are its long tail,
         and a shorter one leaves more of the CTA as the ask. */
      picks.push({ item, score: 100 - index * 10 - item.length / 10 });
    });
  }

  picks.sort((a, b) => b.score - a.score);
  return picks[0]?.item ?? "";
}

export function ctaFor(listing: Listing, occasion: string | null): string {
  const product = PRODUCT_CTA[deriveProductType(listing) ?? ""] ?? PRODUCT_FALLBACK;
  const subject = subjectFor(listing);

  // The seller's own words first, then the subject, then an ask with nobody named.
  const audience = audienceFor(listing) || subject?.who || "";

  /*
    The emoji is read together with the words beside it, so the audience picks it whenever
    it names a subject of its own. Without this a card captioned "for someone who loves
    disco" went out under a crystal ball, because the description also mentions a witch.
  */
  const named = audience ? matchSubject(audience) : null;
  const emoji = (named ?? subject)?.emoji ?? OCCASION_EMOJI[occasion ?? ""] ?? GIFT;

  return audience ? `${emoji} ${product.buy} for ${audience}` : `${emoji} ${product.alone}`;
}
