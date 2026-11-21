/**
 * lib/hero.ts
 *
 * What the home page hero is selling today.
 *
 * Driven by the shopping window in lib/seasonal.ts, not by the palette holiday in
 * lib/season.ts. Those answer different questions and genuinely disagree: on 10 December
 * the palette is Hanukkah, because a holiday that has arrived outranks one still being
 * led up to, while the thing people are actually shopping for is Christmas. The hero
 * sells; the palette decorates.
 *
 * An occasion with no entry here keeps the shop's standing hero, which is the right
 * outcome for a window nobody has written copy for yet.
 */

import { relevantOccasions } from "@/lib/seasonal";

export interface HeroPromo {
  /** The occasion slug, which is also its collection path segment. */
  slug: string;
  eyebrow: string;
  /** Split so the accent half can be styled without parsing the string in the view. */
  title: { lead: string; accent: string };
  /** `count` is substituted with the collection's live size, never written in by hand. */
  body: string;
  cta: string;
}

const PROMOS: Record<string, HeroPromo> = {
  christmas: {
    slug: "christmas",
    // True for the whole window, including the day after Christmas, when "coming" is not.
    eyebrow: "Shop Christmas",
    title: { lead: "Make It a", accent: "Christmas to Remember" },
    /*
      Over half the catalogue is Christmas, and of that nine in ten is wrapping paper, so
      the copy leads with it rather than implying an even spread across the other three.
    */
    body: "{count} Christmas designs, led by wrapping paper that steals the photo, with ornaments and shirts alongside. Printed on demand and shipped from our Etsy shop.",
    cta: "Shop Christmas designs",
  },
};

/**
 * The promo for today, or null to keep the standing hero.
 *
 * `relevantOccasions` returns the open windows with the one closing soonest first, so a
 * day that sells two occasions promotes the more urgent of them.
 */
export function heroPromo(now: Date = new Date()): HeroPromo | null {
  for (const slug of relevantOccasions(now)) {
    const promo = PROMOS[slug];
    if (promo) return promo;
  }
  return null;
}

/** The body copy with the collection's live size in it, so the number cannot go stale. */
export function promoBody(promo: HeroPromo, count: number): string {
  return promo.body.replace("{count}", String(count));
}
