import { describe, expect, it } from "vitest";
import { designLine } from "@/lib/design-line";
import { getAllListings } from "@/lib/shop";
import type { Listing } from "@/types/etsy";

/** Only the description matters here, so the rest of a listing is filled in once. */
function listing(description: string): Listing {
  return { id: 1, title: "A design", description } as Listing;
}

describe("designLine", () => {
  it("takes the sentence that describes the design", () => {
    expect(
      designLine(
        listing(
          "Feeling festive?\n\nThis playful design features charming little hedgehogs getting into the holiday spirit."
        )
      )
    ).toBe("This playful design features charming little hedgehogs getting into the holiday spirit.");
  });

  it("leaves the heading above a paragraph out of the sentence", () => {
    /*
      A heading with no bullet under it stays inside the paragraph, so the sentences have
      to be split line by line. Split as one string, this comes back welded together as
      "Vintage Sporting Club Style The detailed birds...".
    */
    expect(
      designLine(
        listing(
          "Vintage Sporting Club Style\nThe detailed birds, crossed clubs and oak leaves give this design a timeless feel."
        )
      )
    ).toBe("The detailed birds, crossed clubs and oak leaves give this design a timeless feel.");
  });

  it("splits where an emoji stands in for a full stop, and prints no emoji", () => {
    // The first emoji ends a sentence; the second sits inside the one that gets picked.
    expect(
      designLine(
        listing(
          "Wrap your gifts in elegance 🤍✨ This design features a delicate floral pattern 🌿 in soft cream tones."
        )
      )
    ).toBe("This design features a delicate floral pattern in soft cream tones.");
  });

  it("skips a sentence whose subject the card never introduced", () => {
    // "him" is Santa, named a paragraph earlier, which a card does not show.
    expect(
      designLine(
        listing(
          "One playful illustration features him relaxing in a striped beach chair with a coconut drink."
        )
      )
    ).toBe("");
  });

  it("skips fulfilment, dimensions and anything that is not the design", () => {
    expect(
      designLine(listing("This design is printed on premium 120gsm paper and ships within a day."))
    ).toBe("");
  });

  it("skips a clause that reads as a cut-off sentence on its own", () => {
    expect(
      designLine(listing("Set against a rich deep forest green background, this design glows."))
    ).toBe("");
  });

  it("skips a line the seller never finished with a full stop", () => {
    expect(designLine(listing("This design features soft cream tones and delicate gold accents"))).toBe(
      ""
    );
  });

  it("skips a sentence that names the design without describing it", () => {
    expect(designLine(listing("Birthday details are incorporated throughout the pattern."))).toBe(
      ""
    );
  });

  it("prefers the describing sentence over the vague one before it", () => {
    // Both clear every filter, so only the ranking decides which one a card prints.
    expect(
      designLine(
        listing(
          "This design brings a great deal to the table for everyone.\nThe pattern features snow-covered mushrooms and frosted ferns in deep red."
        )
      )
    ).toBe("The pattern features snow-covered mushrooms and frosted ferns in deep red.");
  });

  it("cuts a long sentence where it stops describing, leaving a whole sentence", () => {
    expect(
      designLine(
        listing(
          "This playful coastal pattern is packed with tropical holiday favourites, including Santa in a beach chair, surfing Santa, sandy snowmen, seashells, starfish and plenty of festive red and green details."
        )
      )
    ).toBe("This playful coastal pattern is packed with tropical holiday favourites.");
  });

  it("returns nothing rather than a line it cannot stand behind", () => {
    expect(designLine(listing(""))).toBe("");
    expect(designLine(listing("Hello!\n\nThanks for visiting the shop."))).toBe("");
  });

  describe("across the real catalogue", () => {
    it("never returns a fragment, a price or more than a card holds", async () => {
      const listings = await getAllListings();
      let found = 0;
      for (const l of listings) {
        const line = designLine(l);
        if (!line) continue;
        found++;
        // A card has room for three lines of prose, and not a character more.
        expect(line.length, line).toBeLessThanOrEqual(150);
        // A whole sentence, so a card never shows one that was cut off mid-clause.
        expect(line, line).toMatch(/[.!?]$/);
        expect(line, line).not.toMatch(/[$£€]\s?\d|\d+\.\d\d/);
        // satori has no font for these, so one that slipped through would draw as tofu.
        expect(line, line).not.toMatch(/\p{Extended_Pictographic}/u);
      }
      // A guard against a refactor that quietly stops matching anything at all.
      expect(found).toBeGreaterThan(listings.length / 3);
    });
  });
});
