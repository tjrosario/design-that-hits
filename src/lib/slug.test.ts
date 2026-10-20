import { describe, expect, it } from "vitest";
import { withDisplayNames, listingName, listingSlug, idFromSlug } from "@/lib/slug";
import { getAllListings } from "@/lib/shop";
import type { Listing } from "@/types/etsy";

const stub = (id: number, title: string): Listing => ({
  id, title, description: "", url: "", price: 1, currency: "USD",
  numFavorers: 0, views: 0, createdAt: 0, updatedAt: 0, sectionId: null, tags: [], image: null,
});

describe("withDisplayNames", () => {
  it("leaves a name alone when nothing collides", () => {
    const [a] = withDisplayNames([stub(1, "Unique Thing | Extra Words")]);
    expect(a.displayName).toBeUndefined();
    expect(listingName(a)).toBe("Unique Thing");
  });

  it("disambiguates a collision from the listing's own title", () => {
    const out = withDisplayNames([
      stub(1, "Gothic Christmas Wrapping Paper | Black Rose Gift Wrap"),
      stub(2, "Gothic Christmas Wrapping Paper | Skull & Ornament Gift Wrap"),
    ]);
    const names = out.map(listingName);
    expect(new Set(names).size).toBe(2);
    expect(names.every((n) => n.startsWith("Gothic Christmas Wrapping Paper - "))).toBe(true);
  });

  // A stale name is worse than no name: it would contradict the title it sits beside.
  it("clears a name that no longer collides", () => {
    const once = withDisplayNames([
      stub(1, "Shared Name | Alpha Variant"),
      stub(2, "Shared Name | Beta Variant"),
    ]);
    expect(once[0].displayName).toBeDefined();
    const again = withDisplayNames([once[0]]);
    expect(again[0].displayName).toBeUndefined();
  });

  it("is idempotent over the real catalog", async () => {
    const listings = await getAllListings();
    const once = withDisplayNames(listings).map(listingName);
    const twice = withDisplayNames(withDisplayNames(listings)).map(listingName);
    expect(twice).toEqual(once);
  });

  // The whole point: slugs are derived from the raw title, so disambiguation must not
  // move a single URL.
  it("never changes a slug", async () => {
    const listings = await getAllListings();
    const before = listings.map(listingSlug);
    const after = withDisplayNames(listings).map(listingSlug);
    expect(after).toEqual(before);
  });

  it("keeps every display name inside the title budget", async () => {
    for (const l of withDisplayNames(await getAllListings())) {
      expect(listingName(l).length).toBeLessThanOrEqual(150);
    }
  });
});

describe("idFromSlug", () => {
  it("round-trips every listing", async () => {
    for (const l of await getAllListings()) {
      expect(idFromSlug(listingSlug(l))).toBe(l.id);
    }
  });
});
