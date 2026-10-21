import { describe, expect, it } from "vitest";
import { getAllListings } from "@/lib/shop";
import { listingName, listingPath } from "@/lib/slug";
import {
  PIN_DESCRIPTION_MAX,
  cell,
  clampName,
  pinDescription,
  pinImageUrl,
  pinItUrl,
  pinterestLink,
  truncate,
} from "@/lib/pinterest";
import type { Listing } from "@/types/etsy";

function listing(over: Partial<Listing> = {}): Listing {
  return {
    id: 123,
    title: "Gothic Skull Birthday Wrapping Paper | Black Rose Gift Wrap",
    description: "Celebrate another year on the beautifully dark side.",
    url: "https://www.etsy.com/listing/123/x",
    price: 21.83,
    currency: "USD",
    createdAt: 0,
    updatedAt: 0,
    favorites: 0,
    views: 0,
    image: { url: "https://i.etsystatic.com/1/r/il/abc/9/il_570xN.9_a.jpg" },
    ...over,
  } as Listing;
}

describe("pinItUrl", () => {
  /*
    The contract this button rests on, verified against the live endpoint: Pinterest's
    compose page reads `url`, `media` and `description` as query parameters. Encoding
    them by hand is what breaks it, so this asserts they survive a round trip through
    URLSearchParams rather than that the string merely contains them.
  */
  it("passes the page, image and description as readable parameters", () => {
    const l = listing();
    const url = new URL(pinItUrl(l)!);

    expect(url.origin + url.pathname).toBe("https://www.pinterest.com/pin/create/button/");
    expect(url.searchParams.get("url")).toBe(pinterestLink(l, "save-button"));
    expect(url.searchParams.get("media")).toBe(pinImageUrl(l));
    expect(url.searchParams.get("description")).toBe(pinDescription(l));
  });

  /*
    A save pins the generated 2:3 composite, not the square Etsy photo. Pinterest's grid
    is vertical, so a square is passed over for a pin that fills the column.
  */
  it("pins the generated 2:3 image rather than the Etsy photo", () => {
    const media = new URL(pinItUrl(listing())!).searchParams.get("media")!;
    expect(media).toBe("https://designthathits.com/designs/gothic-skull-birthday-wrapping-paper-123/pin-image");
    expect(media).not.toContain("etsystatic");
  });

  // Pinterest fetches this from its own servers, so a relative path would resolve
  // against pinterest.com and 404.
  it("gives the image as an absolute URL", () => {
    expect(pinImageUrl(listing())).toMatch(/^https:\/\/designthathits\.com\//);
    expect(pinImageUrl(listing())).toBe(`https://designthathits.com${listingPath(listing())}/pin-image`);
  });

  it("renders nothing to pin when the listing has no photo", () => {
    expect(pinItUrl(listing({ image: undefined }))).toBeNull();
  });

  // Without the campaign tag a save and a feed pin are indistinguishable in analytics,
  // which is the only way to tell whether this button earned anything.
  it("tags the destination so saves are attributable", () => {
    const url = new URL(new URL(pinItUrl(listing())!).searchParams.get("url")!);
    expect(url.searchParams.get("utm_source")).toBe("pinterest");
    expect(url.searchParams.get("utm_campaign")).toBe("save-button");
    expect(url.pathname).toBe(listingPath(listing()));
  });
});

describe("pinDescription", () => {
  it("leads with the product name, which is the phrase Pinterest indexes", () => {
    expect(pinDescription(listing())).toBe(
      "Gothic Skull Birthday Wrapping Paper. Celebrate another year on the beautifully dark side."
    );
  });

  // The name is prepended, so a description already at the ceiling would overflow it.
  it("never exceeds Pinterest's ceiling", async () => {
    const long = listing({ description: "word ".repeat(400) });
    expect(pinDescription(long).length).toBeLessThanOrEqual(PIN_DESCRIPTION_MAX);

    for (const l of await getAllListings()) {
      expect(pinDescription(l).length, listingName(l)).toBeLessThanOrEqual(PIN_DESCRIPTION_MAX);
    }
  });

  it("does not repeat the name when the copy already opens with it", () => {
    const l = listing({ description: "Gothic Skull Birthday Wrapping Paper is here." });
    expect(pinDescription(l)).toBe("Gothic Skull Birthday Wrapping Paper is here.");
  });

  it("falls back to the title when there is no description", () => {
    expect(pinDescription(listing({ description: "" }))).toContain("Gothic Skull");
  });

  // Tabs and newlines are what shift a TSV column; the same text goes to both surfaces.
  it("flattens whitespace", () => {
    const l = listing({ description: "Line one.\n\tLine  two." });
    expect(pinDescription(l)).not.toMatch(/[\t\r\n]|\s{2,}/);
  });
});

/*
  Both cases below survived a mutation run: the threshold could be moved and the quote
  strip deleted with all ten other tests still green.
*/
describe("truncate", () => {
  // A space below the threshold is ignored, because breaking there would throw away most
  // of the text to avoid one partial word.
  it("cuts hard when the only space falls too early", () => {
    expect(truncate("aaaa bbbbbbbbbbbbbbbbbbbbbbbbbbbb", 20)).toBe("aaaa bbbbbbbbbbbbbbb…");
  });

  it("breaks on a space that falls late enough", () => {
    expect(truncate("aaaaaaaaaaaaaaa bbbbbbbbbbbbbbbb", 20)).toBe("aaaaaaaaaaaaaaa…");
  });

  it("leaves text within the limit alone", () => {
    expect(truncate("short", 20)).toBe("short");
  });
});

describe("cell", () => {
  // Descriptions carry inch marks like 30"x36", so a value starting with a quote is
  // reachable, and an RFC-4180 parser would then swallow the tabs after it.
  it("strips a leading quote but keeps inner ones", () => {
    expect(cell('"30"x36" print')).toBe('30"x36" print');
  });

  it("strips a run of leading quotes", () => {
    expect(cell('""x')).toBe("x");
  });
});

describe("clampName", () => {
  it("leaves a name the panel can hold", () => {
    expect(clampName("Gothic Skull Birthday Wrapping Paper")).toBe(
      "Gothic Skull Birthday Wrapping Paper"
    );
  });

  // The pin panel holds three lines; past that the text would run under the brand line.
  it("cuts a long name at a word boundary", () => {
    const out = clampName(
      "Glam Lips Christmas Wrapping Paper - Glitter Lips, Stars & Lightning Holiday Wrap"
    );
    expect(out.length).toBeLessThan(70);
    expect(out.endsWith("…")).toBe(true);
  });

  // "Stars &…" reads as a typo rather than a truncation.
  it("drops a stranded connector before the ellipsis", () => {
    const out = clampName(
      "Glam Lips Christmas Wrapping Paper - Glitter Lips, Stars & Lightning Holiday Wrap"
    );
    expect(out).toBe("Glam Lips Christmas Wrapping Paper - Glitter Lips, Stars…");
    expect(out).not.toMatch(/[,&+-]…$/);
  });

  it("never strands a connector on any name in the catalog", async () => {
    for (const l of await getAllListings()) {
      expect(clampName(listingName(l)), listingName(l)).not.toMatch(/[\s,&+-]…$/);
    }
  });
});

describe("every pinnable listing", () => {
  it("produces a valid absolute compose URL", async () => {
    const listings = await getAllListings();
    expect(listings.length).toBeGreaterThan(0);

    for (const l of listings) {
      const href = pinItUrl(l);
      if (!l.image) {
        expect(href, listingName(l)).toBeNull();
        continue;
      }
      expect(() => new URL(href!), listingName(l)).not.toThrow();
      expect(new URL(href!).searchParams.get("description"), listingName(l)).toBeTruthy();
    }
  });
});
