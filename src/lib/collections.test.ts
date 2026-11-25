import { describe, expect, it } from "vitest";
import { filterListings } from "@/lib/catalog";
import {
  getCollections,
  getIntersections,
  intersectionQuery,
  intersectionSpec,
  belongsTo,
  collectionIntro,
  genericIntro,
  MIN_INTERSECTION_PRODUCTS,
} from "@/lib/collections";
import { getAllListings } from "@/lib/shop";

/**
 * The invariant behind the worst bug this codebase has had.
 *
 * `intersectionSpec` used to compose its query by spreading two objects keyed by facet
 * kind, so a pair of two themes produced `{themes}` twice and the second overwrote the
 * first. Eight pages then published their secondary axis alone: /collections/glam/gothic
 * promised ten products and served all 88 Gothic ones, and three URLs served one
 * identical grid. Every page returned 200, so nothing caught it.
 */
describe("intersection queries", () => {
  /*
    Through `intersectionSpec`, which is the query the page actually runs, not through
    `intersectionQuery` directly. `getIntersections` carries a guard that drops any pair
    whose query disagrees with its count, so asserting only over what it returns passes
    vacuously: reintroduce the bug and the broken pairs are simply absent from the loop.
  */
  it("renders exactly the products each intersection counts", async () => {
    const listings = await getAllListings();
    const intersections = await getIntersections();
    expect(intersections.length).toBeGreaterThan(0);

    for (const i of intersections) {
      const rendered = filterListings(listings, intersectionSpec(i).query);
      expect(
        rendered.length,
        `${i.primary.slug}|${i.secondary.slug} counts ${i.count} but its page renders ${rendered.length}`
      ).toBe(i.count);
    }
  });

  // The guard itself: if it starts refusing pairs, the published count falls and this
  // notices, which the loop above cannot because it only sees survivors.
  it("publishes every pair that has copy and enough products", async () => {
    const published = await getIntersections();
    expect(published.length).toBeGreaterThanOrEqual(32);
  });

  /*
    The wiring, which is where the bug was. `intersectionSpec` composed its query by
    spreading two objects keyed by facet kind; `intersectionQuery` groups them instead.
    Even for a type-by-theme pair the two differ, because the correct version uses the
    AND variant (`allThemes`) where the spread used the OR one (`themes`), so this
    catches the regression without needing a same-kind pair to be published.
  */
  it("builds its query with intersectionQuery", async () => {
    for (const i of await getIntersections()) {
      expect(intersectionSpec(i).query, `${i.primary.slug}|${i.secondary.slug}`).toEqual(
        intersectionQuery(i)
      );
    }
  });

  /*
    Synthetic, because every published pair today is type-by-theme or occasion-by-theme.
    The moment a theme-by-theme entry is added the composition has to be right, and this
    exercises it now rather than waiting for that.
  */
  it.each([
    ["theme x theme", "glam", "gothic"],
    ["occasion x occasion", "halloween", "birthday"],
    ["occasion x type", "christmas", "apparel"],
  ])("narrows a %s pair to the products in both", async (_label, a, b) => {
    const listings = await getAllListings();
    const bySlug = new Map((await getCollections()).map((c) => [c.slug, c]));
    const left = bySlug.get(a);
    const right = bySlug.get(b);
    expect(left, a).toBeDefined();
    expect(right, b).toBeDefined();
    if (!left || !right) return;

    const pair = filterListings(listings, intersectionQuery({ primary: left, secondary: right, label: "t", count: 0 }));
    expect(pair.length).toBeGreaterThan(0);
    expect(pair.length).toBeLessThan(listings.filter((l) => belongsTo(l, left)).length);
    expect(pair.length).toBeLessThan(listings.filter((l) => belongsTo(l, right)).length);
    expect(pair.every((l) => belongsTo(l, left) && belongsTo(l, right))).toBe(true);
  });

  it("publishes nothing below the product threshold", async () => {
    for (const i of await getIntersections()) {
      expect(i.count).toBeGreaterThanOrEqual(MIN_INTERSECTION_PRODUCTS);
    }
  });
});

/*
  A theme with no hand-written intro still renders: it falls back to one generic sentence
  built from its label. That is a thin landing page on a shop whose themed collections are
  the search surface, so every published theme is held to having copy of its own.
*/
describe("collection intros", () => {
  it("writes a real intro for every theme, not the generic fallback", async () => {
    const themes = (await getCollections()).filter((c) => c.kind === "theme");
    expect(themes.length, "no theme collection to check").toBeGreaterThan(0);

    /* Through `genericIntro`, not a copy of its wording: a literal here would stop
       matching the moment the fallback is reworded, and then pass for every theme. */
    for (const c of themes) {
      expect(collectionIntro(c), `${c.slug} has no intro of its own`).not.toBe(
        genericIntro(c.label)
      );
    }
  });
});
