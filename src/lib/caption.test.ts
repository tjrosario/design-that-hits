import { describe, expect, it } from "vitest";
import { captionLine, captionLines } from "@/lib/caption";
import { getAllListings } from "@/lib/shop";
import type { Listing } from "@/types/etsy";

/** Only the title and description steer a caption, so the rest is filled in once. */
function listing(title: string, description = ""): Listing {
  return { id: 1, title, description, tags: [] } as unknown as Listing;
}

/** Every emoji in a string, so a test can say which ones a caption chose. */
const emoji = (text: string) => text.match(/\p{Extended_Pictographic}/gu) ?? [];

const CASINO = listing(
  "Casino Christmas Wrapping Paper",
  "Deal yourself a win.\n\nThis festive design features vintage slot machines, playing cards and roulette wheels on a deep green background.\n\nPerfect for poker players, casino enthusiasts, card game lovers."
);

describe("captionLines", () => {
  it("says what it is, what it looks like and who it is for", () => {
    const lines = captionLines(CASINO, "design", "christmas");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("Casino Christmas Wrapping Paper");
    expect(lines[1]).toContain("vintage slot machines");
    expect(lines[2]).toContain("poker players");
  });

  it("leads with the emoji for what is drawn on the design, not with a generic one", () => {
    /*
      The whole point of the rewrite. Before this the caption was the design's name and a
      fulfilment sentence, which read identically under a slot machine and under a pug.
    */
    expect(emoji(captionLines(CASINO, "design", "christmas")[0])[0]).toBe("\u{1F3B0}");
    const dog = listing("Dog Christmas Paper", "This design features happy golden retrievers.");
    expect(emoji(captionLines(dog, "design", "christmas")[0])[0]).toBe("\u{1F436}");
  });

  it("closes the first line with the season, and never twice", () => {
    const lines = captionLines(CASINO, "design", "christmas");
    expect(lines[0].endsWith("\u{1F384}")).toBe(true);

    /* A design with no subject leads with the season instead, and the line must not then
       open and close on the same emoji. */
    const plain = listing("Vintage Christmas Paper", "A design with stripes and gold accents.");
    const first = captionLines(plain, "design", "christmas")[0];
    expect(emoji(first)).toEqual(["\u{1F384}"]);
  });

  it("names the occasion on the occasion angle and the arrival on the arrival angle", () => {
    expect(captionLines(CASINO, "occasion", "christmas")[0]).toContain("Christmas sorted.");
    expect(captionLines(CASINO, "arrival", "christmas")[0]).toContain("Just added:");
    // The design angle is the design's own name, with no framing in front of it.
    expect(captionLines(CASINO, "design", "christmas")[0]).not.toMatch(/sorted|Just added/);
  });

  it("carries the emoji for what the design is printed on beside the ask", () => {
    expect(captionLines(CASINO, "design", "christmas")[2]).toContain("\u{1F381}");
    const shirt = listing(
      "Golf Shirt",
      "This design features crossed clubs and oak leaves on a deep green ground. Perfect for golfers."
    );
    expect(captionLines(shirt, "design", null)[2]).toContain("\u{1F455}");
  });

  it("falls back to the subject's own audience when the seller wrote none", () => {
    // No "perfect for" anywhere, so the only audience available is the subject's.
    const hedgehog = listing(
      "Hedgehog Wrapping Paper",
      "This design features charming little hedgehogs on a soft cream background."
    );
    expect(captionLines(hedgehog, "design", null)[2]).toContain("Made for hedgehog lovers");
  });

  it("takes the lead emoji from the audience when it names a subject of its own", () => {
    /*
      The disco card went out under a crystal ball, because the description mentions a
      witch further down and the subject rules put witchcraft above disco. What the
      seller wrote the design was for is the better evidence of what is drawn on it.
    */
    const disco = listing(
      "Disco Birthday Wrapping Paper",
      "A witch hat hides in the pattern. This design features mirror balls and sparkle. Perfect for disco lovers, party people."
    );
    expect(emoji(captionLines(disco, "design", null)[0])[0]).toBe("\u{1FAA9}");
  });

  it("falls back to what the design is printed on before falling back to a sparkle", () => {
    // No subject and no occasion, so the product is the most specific thing left to say.
    const plain = listing(
      "Striped Wrapping Paper",
      "This design features gold stripes on soft cream."
    );
    expect(emoji(captionLines(plain, "design", null)[0])[0]).toBe("\u{1F381}");
  });

  it("asks for the design itself when the description names nobody", () => {
    const none = listing(
      "Striped Wrapping Paper",
      "This design features gold stripes on soft cream."
    );
    expect(captionLines(none, "design", null)[2]).toContain("Wrap something in it");
  });

  it("drops the design line rather than inventing one", () => {
    const bare = listing("A Paper", "Ships in 3 days. Returns accepted.");
    const lines = captionLines(bare, "design", null);
    expect(lines).toHaveLength(2);
    expect(lines.join("\n")).not.toContain("\u{1F3A8}");
  });

  it("makes no claim about how the design is made or where it ships from", () => {
    /*
      The caption used to close on "Printed on demand and shipped from the US.", which
      was the same sentence under all 418 listings. The description's own words go there
      now, and nothing in this module can put a fulfilment claim back.
    */
    const text = captionLines(CASINO, "design", "christmas").join("\n");
    expect(text).not.toMatch(/printed on demand|shipped from|ships from|instant digital/i);
  });
});

describe("captionLine", () => {
  it("prefers the card's stricter sentence over a longer one the loose read finds", () => {
    /*
      The strict read runs first on purpose. Scored side by side the loose sentence here
      wins on length, so dropping the ordering silently swaps a sentence that names the
      design for one that only sets a scene.
    */
    const d =
      "This design features gold stripes on soft cream. Rich burgundy, muted sage green and soft cream tones complete the look of a timeless, old-fashioned holiday table setting.";
    expect(captionLine(listing("Striped Wrapping Paper", d))).toBe(
      "This design features gold stripes on soft cream."
    );
  });


  it("takes a sentence a seller ended with an emoji instead of a full stop", () => {
    /*
      Some descriptions carry no full stop anywhere: every sentence ends in an emoji. The
      card's stricter read drops all of them, which left those cards with no line at all.
    */
    const d =
      "Wrap your gifts in timeless elegance \u{1F90D} This classic paper features an intricate embossed floral pattern with delicate detailing \u{1F33F}";
    expect(captionLine(listing("Wedding Paper", d))).toBe(
      "This classic paper features an intricate embossed floral pattern with delicate detailing."
    );
  });

  it("takes a sentence that describes the artwork without using the word design", () => {
    const d = "Rich brown, forest green and gold tones complete the vintage sporting-club look.";
    expect(captionLine(listing("Golf Shirt", d))).toBe(d);
  });

  it("still rejects a fulfilment sentence, however it is punctuated", () => {
    const d = "Each sheet is printed on premium 90gsm paper and ships within three days \u{1F381}";
    expect(captionLine(listing("A Paper", d))).toBe("");
  });
});

describe("the catalogue", () => {
  it("gives all but a handful of listings a sentence from their own description", () => {
    /*
      A bound rather than a target: 18 of 418 today, against 222 for the card's stricter
      read. The point is that a regression gutting the description read shows up here,
      instead of quietly shipping captions that say only the design's name.
    */
    return getAllListings().then((listings) => {
      const missing = listings.filter((l) => !captionLine(l));
      expect(missing.length / listings.length).toBeLessThan(0.1);
    });
  });
});
