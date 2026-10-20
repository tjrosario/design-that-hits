import { describe, expect, it } from "vitest";
import { primaryOccasion, deriveOccasions, deriveThemes, deriveProductType } from "@/lib/facets";
import { getAllListings } from "@/lib/shop";

describe("primaryOccasion", () => {
  // It picks the occasion the title leads with. Taking occasions[0] meant OCCASION_RULES
  // array order decided, which sent a "Gothic Skull Birthday" wrap to Halloween.
  it("always returns one of the listing's own occasions", async () => {
    for (const l of await getAllListings()) {
      const chosen = primaryOccasion(l);
      if (chosen === null) {
        expect(deriveOccasions(l)).toHaveLength(0);
      } else {
        expect(deriveOccasions(l)).toContain(chosen);
      }
    }
  });

  it("prefers whichever occasion the title names first", async () => {
    const listings = await getAllListings();
    const gothicBirthday = listings.find((l) =>
      /^Gothic Skull Birthday Wrapping Paper/.test(l.title)
    );
    if (gothicBirthday) expect(primaryOccasion(gothicBirthday)).toBe("birthday");
  });
});

describe("facet coverage", () => {
  // A rule edit that starts dropping products on the floor should fail here rather than
  // quietly emptying collection pages, which has happened.
  it("files every listing under a product type", async () => {
    const listings = await getAllListings();
    const typed = listings.filter((l) => deriveProductType(l) !== null);
    expect(typed.length).toBe(listings.length);
  });

  it("keeps theme coverage above 85 percent", async () => {
    const listings = await getAllListings();
    const themed = listings.filter((l) => deriveThemes(l).length > 0);
    expect(themed.length / listings.length).toBeGreaterThan(0.85);
  });

  it("has no rule that swallows most of the catalog", async () => {
    const listings = await getAllListings();
    const counts = new Map<string, number>();
    for (const l of listings) for (const t of deriveThemes(l)) counts.set(t, (counts.get(t) ?? 0) + 1);
    for (const [theme, n] of counts) {
      expect(n / listings.length, `theme "${theme}" matches ${n} of ${listings.length}`).toBeLessThan(0.5);
    }
  });
});
