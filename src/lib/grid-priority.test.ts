import { describe, expect, it } from "vitest";
import { EAGER_CARDS, gridImagePriority } from "@/lib/grid-priority";

describe("gridImagePriority", () => {
  /*
    In Next 16 an eager image is also preloaded, so each extra eager card is another
    top-priority download racing the one that decides LCP.
  */
  it("fetches exactly one card up front", () => {
    expect(EAGER_CARDS).toBe(1);
    const eager = Array.from({ length: 24 }, (_, i) => gridImagePriority(i)).filter((p) => p.eager);
    expect(eager).toHaveLength(1);
    expect(gridImagePriority(0).eager).toBe(true);
    expect(gridImagePriority(1).eager).toBe(false);
  });

  /*
    The point of the whole module. Four full-width phone images at top priority is three
    more than the viewport shows, and they compete with the one that decides LCP.
  */
  it("prioritizes exactly one card, the first", () => {
    const prioritized = Array.from({ length: 24 }, (_, i) => gridImagePriority(i)).filter(
      (p) => p.lcp
    );
    expect(prioritized).toHaveLength(1);
    expect(gridImagePriority(0).lcp).toBe(true);
    expect(gridImagePriority(1).lcp).toBe(false);
  });

  it("honors a caller that wants a wider first row", () => {
    expect(gridImagePriority(1, 2).eager).toBe(true);
    expect(gridImagePriority(2, 2).eager).toBe(false);
    expect(gridImagePriority(0, 2).lcp).toBe(true);
    expect(gridImagePriority(1, 2).lcp).toBe(false);
  });

  /*
    A grid that eagers nothing must not then declare its first card the LCP: the hint
    would ask the browser to rush an image it was also told to defer.
  */
  it("prioritizes nothing when no card loads eagerly", () => {
    expect(gridImagePriority(0, 0)).toEqual({ eager: false, lcp: false });
  });
});
