import { describe, expect, it } from "vitest";
import { primaryOccasion, primaryTheme, deriveOccasions, deriveThemes, deriveProductType } from "@/lib/facets";
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

describe("primaryTheme", () => {
  it("always returns one of the listing's own themes", async () => {
    for (const l of await getAllListings()) {
      const chosen = primaryTheme(l);
      if (chosen === null) expect(deriveThemes(l)).toHaveLength(0);
      else expect(deriveThemes(l)).toContain(chosen);
    }
  });

  /*
    The property, not a hardcoded answer: whichever theme the title names earliest wins.
    Rule order would hand "Elegant Ornamental Christmas ... Vintage Scrollwork" its first
    derived theme, which on real data is gothic via a dark_green_wrap tag; the title says
    Elegant at character zero.
  */
  it("prefers the theme the title names earliest, not rule order", () => {
    const base = {
      id: 1, description: "", url: "", price: 1, currency: "USD", numFavorers: 0,
      views: 0, createdAt: 0, updatedAt: 0, sectionId: null, image: null,
    };
    const elegantFirst = { ...base, title: "Elegant Vintage Wrapping Paper", tags: [] };
    const vintageFirst = { ...base, title: "Vintage Elegant Wrapping Paper", tags: [] };

    expect(deriveThemes(elegantFirst)).toEqual(deriveThemes(vintageFirst));
    expect(primaryTheme(elegantFirst)).toBe("glam");
    expect(primaryTheme(vintageFirst)).toBe("retro");
  });

  it("falls back to a tag-only match when the title names no theme", () => {
    const tagOnly = {
      id: 2, title: "Plain Wrapping Paper", description: "", url: "", price: 1,
      currency: "USD", numFavorers: 0, views: 0, createdAt: 0, updatedAt: 0,
      sectionId: null, image: null, tags: ["dark_green_wrap"],
    };
    expect(primaryTheme(tagOnly)).toBe(deriveThemes(tagOnly)[0] ?? null);
  });
});

/*
  Golf is the one theme whose vocabulary collides with another's: a birdie is also a bird,
  and a bogey is not a bogeyman. Precision is checked against each listing's description,
  which the rules never read, so that direction cannot pass by agreeing with the pattern.
  Recall is checked on written-out titles instead, because the catalog syncs from a live
  feed and a shirt whose description omits the word would otherwise turn this red.
*/
describe("golf theme", () => {
  const base = {
    id: 3, title: "", description: "", url: "", price: 1, currency: "USD",
    numFavorers: 0, views: 0, createdAt: 0, updatedAt: 0, sectionId: null,
    image: null, tags: [] as string[],
  };

  it("never files a design under golf unless its own description says golf", async () => {
    const themed = (await getAllListings()).filter((l) => deriveThemes(l).includes("golf"));
    // Deleting the rule empties this, so the real catalog still answers for the rule.
    expect(themed.length, "no golf design in the catalog to check").toBeGreaterThan(0);
    for (const l of themed) expect(l.description ?? "", l.title).toMatch(/\bgolf/i);
  });

  it("reaches the whole golf vocabulary", () => {
    const titles = [
      "Golfer Gift Tee",
      "Golfing Dad Shirt",
      "Birdies & Bourbon Club Shirt",
      "Bogeys & Brews Society Shirt",
      "Country Club Wrapping Paper",
    ];
    for (const title of titles) {
      expect(deriveThemes({ ...base, title }), title).toContain("golf");
    }
  });

  /* `deriveThemes` returns rule order, and the Pinterest feed labels a listing with its
     first theme. Two ties to hold: "Vintage" names retro, and "Birdies" is also a bird,
     which matches at the same index as golf so only the rule order separates them. */
  it("leads a golf design with golf, over both retro and wildlife", () => {
    const vintage = { ...base, title: "Vintage Golf Shirt" };
    expect(deriveThemes(vintage)).toContain("retro");
    expect(deriveThemes(vintage)[0]).toBe("golf");

    const birdies = { ...base, title: "Birdies & Bourbon Club Shirt" };
    expect(deriveThemes(birdies)).toContain("wildlife");
    expect(deriveThemes(birdies)[0]).toBe("golf");
  });

  it("keeps the near-misses out", () => {
    for (const title of ["Bogeyman Halloween Tee", "Social Club Wrapping Paper", "Bird Feeder Sticker"]) {
      expect(deriveThemes({ ...base, title }), title).not.toContain("golf");
    }
  });

  /* Holds the precision test above honest: it is only independent while the rules read the
     title and the tags, so a description-only match must stay invisible to them. */
  it("reads the title and the tags, never the description", () => {
    const described = { ...base, title: "Plain Wrapping Paper", description: "A golf course at dawn." };
    expect(deriveThemes(described)).not.toContain("golf");
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
