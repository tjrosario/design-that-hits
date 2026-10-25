import { describe, expect, it } from "vitest";
import { fullSizeImageUrl, gridImageUrl } from "@/lib/images";
import { getAllListings } from "@/lib/shop";

const STORED = {
  small: "https://i.etsystatic.com/1/r/il/abc/9/il_570xN.9_a.jpg",
  full: "https://i.etsystatic.com/1/r/il/abc/9/il_fullxfull.9_a.jpg",
  thumb: "https://i.etsystatic.com/1/r/il/abc/9/il_170x135.9_a.jpg",
};

/**
 * Both ends of the stored catalog are wrong for a card: 137 listings carry `il_570xN`,
 * which a phone at 100vw and 2x upscales, and 276 carry `il_fullxfull` at about 2754px,
 * which the optimizer then fetches and resizes for a card never wider than 320px.
 */
describe("gridImageUrl", () => {
  it("raises an undersized variant", () => {
    expect(gridImageUrl(STORED.small)).toBe("https://i.etsystatic.com/1/r/il/abc/9/il_1140xN.9_a.jpg");
    expect(gridImageUrl(STORED.thumb)).toContain("il_1140xN.");
  });

  it("lowers a full-size original", () => {
    expect(gridImageUrl(STORED.full)).toBe("https://i.etsystatic.com/1/r/il/abc/9/il_1140xN.9_a.jpg");
  });

  it("normalizes every stored variant to the same request", () => {
    const urls = Object.values(STORED).map(gridImageUrl);
    expect(new Set(urls).size).toBe(1);
  });

  it("leaves a URL with no Etsy variant token alone", () => {
    const other = "https://example.com/photo.jpg";
    expect(gridImageUrl(other)).toBe(other);
  });

  // The card is at most 100vw on a phone; at 3x that is still under 1140.
  it("is not smaller than the widest request the grid can make", () => {
    expect(Number(/il_(\d+)xN/.exec(gridImageUrl(STORED.small))![1])).toBeGreaterThanOrEqual(1080);
  });

  it("rewrites every image in the catalog", async () => {
    const listings = (await getAllListings()).filter((l) => l.image);
    expect(listings.length).toBeGreaterThan(400);
    for (const l of listings) {
      expect(gridImageUrl(l.image!.url), String(l.id)).toContain("/il_1140xN.");
    }
  });
});

describe("fullSizeImageUrl", () => {
  it("raises any stored variant to full size", () => {
    for (const url of Object.values(STORED)) {
      expect(fullSizeImageUrl(url)).toContain("/il_fullxfull.");
    }
  });

  // Share cards, the product photo, the feed and the pin image all depend on this, and
  // a thumbnail in any of them is a visibly broken card.
  it("leaves no listing on a small variant", async () => {
    for (const l of (await getAllListings()).filter((x) => x.image)) {
      expect(fullSizeImageUrl(l.image!.url), String(l.id)).not.toMatch(/il_\d+x/);
    }
  });
});
