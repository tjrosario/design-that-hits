import { describe, expect, it } from "vitest";
import { audienceFor, ctaFor } from "@/lib/cta";
import { primaryOccasion } from "@/lib/facets";
import { getAllListings } from "@/lib/shop";
import type { Listing } from "@/types/etsy";

/** Only the title and description steer a CTA, so the rest is filled in once. */
function listing(title: string, description = ""): Listing {
  return { id: 1, title, description, tags: [] } as unknown as Listing;
}

describe("audienceFor", () => {
  it("takes the audience the seller wrote", () => {
    expect(
      audienceFor(listing("A design", "Perfect for tarot lovers and witchy souls."))
    ).toBe("tarot lovers and witchy souls");
  });

  it("skips the generic opener and keeps the specific one further down", () => {
    /*
      The real shape of these descriptions: a throwaway "perfect for" near the top, and
      the one that names somebody several paragraphs later.
    */
    const d =
      "Perfect for Christmas presents.\n\nPERFECT FOR CASINO & CHRISTMAS LOVERS\n\nGreat for gifting to poker players, casino enthusiasts, card game lovers.";
    expect(audienceFor(listing("Lucky Christmas Wrapping Paper", d))).toBe("poker players");
  });

  it("ignores a phrase that names an occasion or a thing rather than a person", () => {
    expect(audienceFor(listing("A design", "Perfect for Christmas."))).toBe("");
    expect(audienceFor(listing("A design", "Ideal for any occasion."))).toBe("");
    // Names neither an occasion nor a person, so there is still nobody to address.
    expect(
      audienceFor(listing("A design", "Perfect for beautifully wrapped presents under the tree."))
    ).toBe("");
  });

  it("keeps a clause whole rather than splitting it at 'and'", () => {
    expect(
      audienceFor(listing("Golf", "Perfect for women who love golf and good friends."))
    ).toBe("women who love golf and good friends");
  });

  it("leaves out a lone singular noun it cannot give an article to", () => {
    // "Wrap a gift for grandparent" is not a sentence; "for a parent" is.
    expect(audienceFor(listing("A design", "Perfect for grandparent."))).toBe("");
    expect(audienceFor(listing("A design", "Perfect for a parent, grandparent."))).toBe("a parent");
  });

  it("drops the debris at the end of a list", () => {
    expect(
      audienceFor(listing("A design", "Perfect for children and nature lovers alike."))
    ).toBe("children and nature lovers");
  });

  it("reads a bulleted list under a heading", () => {
    // Sellers write "Perfect for:" as a heading and then bullet the audience under it.
    expect(audienceFor(listing("A design", "PERFECT FOR:\n- Cat owners and pet parents"))).toBe(
      "Cat owners and pet parents"
    );
  });

  it("leaves out an audience too long to print", () => {
    const long = "Perfect for anyone whose guinea pigs are unquestionably part of the family celebrations.";
    expect(audienceFor(listing("Guinea Pig Wrapping Paper", long))).toBe("");
  });

  it("drops a capital the seller's title-casing left mid-sentence", () => {
    // "Wrap a gift for Casino lovers" reads as a typo wherever the phrase is used.
    const d = "Perfect for Casino lovers. The casino tables are drawn in gold.";
    expect(audienceFor(listing("Casino Wrapping Paper", d))).toBe("casino lovers");
  });

  it("keeps the capital on a word the description never writes in lower case", () => {
    /*
      The test that stops the rule above from writing "for vegas lovers". The word earns
      its lowercase only by appearing that way in the seller's own running prose, and a
      proper noun never does.
    */
    const d = "Perfect for Vegas lovers and high rollers. Vegas nights, drawn in neon.";
    expect(audienceFor(listing("Vegas Wrapping Paper", d))).toBe("Vegas lovers and high rollers");
  });
});

describe("ctaFor", () => {
  it("names what the description is about, not what the title is styled like", () => {
    /*
      The case this module exists for. The title says "vintage", so the theme facets file
      this under retro and a CTA built from them asked the nostalgic to buy it. The casino
      is only ever mentioned in the description.
    */
    const casino = listing(
      "Lucky Christmas Wrapping Paper | Vintage Vegas Christmas Paper",
      "Featuring retro casino illustrations, slot machines and poker chips. Great for gifting to casino enthusiasts."
    );
    expect(ctaFor(casino, "christmas")).toBe("\u{1F3B0} Wrap a gift for casino enthusiasts");
  });

  it("falls back to the subject when the seller's audience is unusable", () => {
    // No printable "perfect for" phrase, but the description says what it is.
    const pigs = listing(
      "Guinea Pig Christmas Wrapping Paper",
      "A cheerful holiday design featuring fluffy guinea pigs getting into festive trouble."
    );
    expect(ctaFor(pigs, "christmas")).toBe("\u{1F439} Wrap a gift for small pet owners");
  });

  it("reads a golf design as golf, not as birds", () => {
    // "Birdies" is a golf score, and the themed facets lead this shirt with golf too.
    const golf = listing(
      "Birdies & Bourbon Golf Club Shirt",
      "Vintage birds perched above crossed golf clubs, for the course and the clubhouse."
    );
    expect(ctaFor(golf, null)).toMatch(/^\u{26F3} Grab a tee for /u);
  });

  it("takes the thing to buy from the product type", () => {
    const d = "A gothic skull design. Perfect for horror lovers.";
    expect(ctaFor(listing("Gothic Skull Wrapping Paper", d), null)).toBe(
      "\u{1F5A4} Wrap a gift for horror lovers"
    );
    expect(ctaFor(listing("Gothic Skull T-Shirt", d), null)).toBe(
      "\u{1F5A4} Grab a tee for horror lovers"
    );
  });

  it("puts an emoji that agrees with the words beside it", () => {
    /*
      The description mentions a witch, which would otherwise hand a crystal ball to a
      caption about disco.
    */
    const disco = listing(
      "Disco Halloween Wrapping Paper",
      "Glitter balls and a witch on the dance floor. Perfect for someone who loves disco."
    );
    expect(ctaFor(disco, "halloween")).toBe("\u{1FAA9} Wrap a gift for someone who loves disco");
  });

  it("falls back to the season, then to the gift, naming nobody it cannot", () => {
    expect(ctaFor(listing("Plain Wrapping Paper", "A nice pattern."), "christmas")).toBe(
      "\u{1F384} Wrap something in it"
    );
    expect(ctaFor(listing("Plain Wrapping Paper", "A nice pattern."), null)).toBe(
      "\u{1F381} Wrap something in it"
    );
    expect(ctaFor(listing("Something Unclassifiable", ""), null)).toBe(
      "\u{1F381} Shop this design"
    );
  });

  describe("across the real catalogue", () => {
    it("gives every listing an ask, and most of them someone to give it to", async () => {
      const listings = await getAllListings();
      let named = 0;
      for (const l of listings) {
        const cta = ctaFor(l, primaryOccasion(l));
        // An emoji, then words. A bare emoji is not an ask.
        expect(cta, l.title).toMatch(/^\p{Extended_Pictographic}\S* \w/u);
        // Short enough to sit under a caption rather than become one.
        expect(cta.length, cta).toBeLessThanOrEqual(72);
        if (cta.includes(" for ")) named++;
      }
      expect(named).toBeGreaterThan(listings.length * 0.75);
    });
  });
});
