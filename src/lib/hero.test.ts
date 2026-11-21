import { describe, expect, it } from "vitest";
import { heroPromo, promoBody } from "@/lib/hero";
import { currentTheme } from "@/lib/season";

/** Noon UTC on a given day, which is the same calendar day in the shop's timezone. */
const on = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("heroPromo", () => {
  it("promotes Christmas across the whole shopping run-up", () => {
    for (const day of ["2026-10-01", "2026-11-21", "2026-12-10", "2026-12-25", "2026-12-26"]) {
      expect(heroPromo(on(day))?.slug, day).toBe("christmas");
    }
  });

  it("stops the day the window closes, so the hero cannot sell Christmas in January", () => {
    expect(heroPromo(on("2026-12-27"))).toBeNull();
    expect(heroPromo(on("2027-01-15"))).toBeNull();
    expect(heroPromo(on("2026-07-01"))).toBeNull();
  });

  it("keeps the standing hero for a window nobody has written copy for", () => {
    // September sells Halloween, which has no promo entry; the shop's own hero stands in.
    expect(heroPromo(on("2026-09-15"))).toBeNull();
  });

  it("follows the shopping window, not the palette holiday", () => {
    /*
      These genuinely disagree and the hero has to take the shopping side. On 10 December
      the palette is Hanukkah, because `holidayFor` ranks a holiday that has arrived above
      one still being led up to. What people are buying that day is Christmas.
    */
    expect(currentTheme(on("2026-12-10")).holiday).toBe("hanukkah");
    expect(heroPromo(on("2026-12-10"))?.slug).toBe("christmas");
  });

  it("leads the headline with the occasion rather than burying it", () => {
    const promo = heroPromo(on("2026-12-01"))!;
    expect(`${promo.title.lead} ${promo.title.accent}`).toContain("Christmas");
    expect(promo.eyebrow).toContain("Christmas");
  });

  it("takes the count from the catalogue instead of hard-coding it", () => {
    const promo = heroPromo(on("2026-12-01"))!;
    expect(promo.body).toContain("{count}");
    expect(promoBody(promo, 221)).toContain("221 Christmas designs");
    expect(promoBody(promo, 221)).not.toContain("{count}");
  });
});
