import { describe, expect, it } from "vitest";
import { mergeRssOverCatalog } from "@/lib/shop";
import type { Listing } from "@/types/etsy";

/** The synthetic ID lib/catalog.ts gives a CSV row, which has no Etsy ID of its own. */
const SYNTHETIC = 1e15 + 4094443890;

function listing(over: Partial<Listing> = {}): Listing {
  return {
    id: 123456789,
    title: "Raccoon Christmas Wrapping Paper | Funny Trash Panda Gift Wrap",
    description: "Mischievous trash pandas in Santa hats.",
    url: "https://www.etsy.com/listing/123456789/raccoon-christmas-wrapping-paper",
    price: 12,
    currency: "USD",
    numFavorers: 0,
    views: 0,
    createdAt: 1_760_000_000,
    updatedAt: 1_760_000_000,
    sectionId: null,
    tags: [],
    image: { url: "https://i.etsystatic.com/a/il_fullxfull.1.jpg", altText: "" },
    ...over,
  };
}

describe("mergeRssOverCatalog", () => {
  it("leaves the catalog alone when the feed is empty", () => {
    const catalog = [listing()];
    expect(mergeRssOverCatalog(catalog, [])).toBe(catalog);
  });

  it("refreshes a listing the feed and the catalog share an ID for", () => {
    const merged = mergeRssOverCatalog(
      [listing({ price: 12, title: "Old title" })],
      [listing({ price: 14, updatedAt: 1_770_000_000 })]
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].price).toBe(14);
    expect(merged[0].title).toContain("Raccoon");
    expect(merged[0].updatedAt).toBe(1_770_000_000);
  });

  it("appends a listing published since the last sync", () => {
    const merged = mergeRssOverCatalog(
      [listing()],
      [listing({ id: 999, title: "Guinea Pig Christmas Wrapping Paper" })]
    );

    expect(merged).toHaveLength(2);
    expect(merged.map((l) => l.id)).toContain(999);
  });

  /*
    The whole point of the title index. A CSV import leaves hundreds of listings holding a
    synthetic ID, and a feed item for one of them must land on it rather than beside it.
  */
  it("matches a CSV-imported listing by title rather than duplicating it", () => {
    const csvRow = listing({
      id: SYNTHETIC,
      url: "https://www.etsy.com/shop/designthathits?search_query=Raccoon",
      price: 0,
    });
    const fromFeed = listing({ id: 123456789, price: 14 });

    const merged = mergeRssOverCatalog([csvRow], [fromFeed]);

    expect(merged).toHaveLength(1);
    // The page is already built and linked under the entry's own ID, so that ID stays.
    expect(merged[0].id).toBe(SYNTHETIC);
    // The direct listing link is the upgrade the feed brings.
    expect(merged[0].url).toBe(fromFeed.url);
    expect(merged[0].price).toBe(14);
  });

  it("ignores whitespace and case when matching a CSV row by title", () => {
    const csvRow = listing({ id: SYNTHETIC, title: "  RACCOON   Christmas Paper ", url: "" });

    const merged = mergeRssOverCatalog([csvRow], [listing({ title: "Raccoon Christmas Paper" })]);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe(SYNTHETIC);
  });

  /*
    Two entries that each name a real Etsy listing are different products however similar
    their titles, which is why only search-linked entries are claimable by title.
  */
  it("never merges a feed listing onto a different product with the same title", () => {
    const merged = mergeRssOverCatalog(
      [listing({ id: 111, url: "https://www.etsy.com/listing/111/raccoon" })],
      [listing({ id: 222, url: "https://www.etsy.com/listing/222/raccoon" })]
    );

    expect(merged).toHaveLength(2);
    expect(merged.map((l) => l.id).sort()).toEqual([111, 222]);
  });

  it("lets one CSV row be claimed once, so same-title feed items stay distinct", () => {
    const csvRow = listing({ id: SYNTHETIC, url: "" });

    const merged = mergeRssOverCatalog(
      [csvRow],
      [listing({ id: 111 }), listing({ id: 222 })]
    );

    expect(merged).toHaveLength(2);
    expect(merged.map((l) => l.id).sort((a, b) => a - b)).toEqual([222, SYNTHETIC]);
  });
});
