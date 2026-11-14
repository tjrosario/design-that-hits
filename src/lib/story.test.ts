import { describe, expect, it } from "vitest";
import { NEW_ARRIVALS_DAYS } from "@/lib/arrivals";
import { deriveProductType, occasionLabel } from "@/lib/facets";
import { getAllListings } from "@/lib/shop";
import { shopToday, toISODate } from "@/lib/shop-time";
import { listingName, listingSlug } from "@/lib/slug";
import {
  LAYOUTS,
  MAX_CARDS,
  STORY_FORMATS,
  TIKTOK_TITLE_MAX,
  clampCaption,
  platforms,
  storyCards,
  storyVersion,
  toHashtag,
  animatable,
  shopDayStart,
} from "@/lib/story";

/* Mid-December: Christmas is in season, so the catalog has plenty to build cards from. */
const DECEMBER = new Date("2026-12-10T12:00:00Z");
/* Mid-July: no dated window is open, so `relevantOccasions` falls back to birthday. That
   fallback covers about 141 days a year and is where the occasion bugs showed up. */
const JULY = new Date("2026-07-14T12:00:00Z");

describe("toHashtag", () => {
  it("drops everything a tag cannot carry", () => {
    expect(toHashtag("Valentine's Day")).toBe("#valentinesday");
    expect(toHashtag("Coastal & Nautical")).toBe("#coastalnautical");
    expect(toHashtag("Wrapping Paper")).toBe("#wrappingpaper");
  });

  it("returns an empty string rather than a bare hash", () => {
    expect(toHashtag("&")).toBe("");
    expect(toHashtag("")).toBe("");
  });
});

describe("clampCaption", () => {
  it("leaves anything inside the limit alone", () => {
    expect(clampCaption("Short enough", 40)).toBe("Short enough");
  });

  it("cuts on a word boundary, not mid-word", () => {
    const full = "Beach Christmas Wrapping Paper for the holidays";
    const cut = clampCaption(full, 24);
    expect(cut.length).toBeLessThanOrEqual(24);
    expect(cut.endsWith("…")).toBe(true);
    // The kept text is a prefix of the original, and the original breaks right after it.
    const kept = cut.slice(0, -1);
    expect(full.startsWith(kept)).toBe(true);
    expect(full[kept.length]).toBe(" ");
  });
});

describe("storyCards", () => {
  it("builds cards, capped so the page stays a shortlist", async () => {
    const cards = await storyCards(DECEMBER);
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.length).toBeLessThanOrEqual(MAX_CARDS);
  });

  it("shows each design once, however many lists it qualifies for", async () => {
    const cards = await storyCards(DECEMBER);
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
  });

  it("leads with what is in season, because that window closes", async () => {
    const cards = await storyCards(DECEMBER);
    expect(cards[0].reason).toMatch(/^In season/);
  });

  it("only offers designs that have a photo to build on", async () => {
    const cards = await storyCards(DECEMBER);
    for (const card of cards) expect(card.photo).toBeTruthy();
  });

  /*
    Full-bleed layouts sit at the even indices and a version's layout is `start*2 + i`,
    so version 0 always lands on one and every card offers an animated story even when it
    has a single version. Reordering LAYOUTS silently breaks that.
  */
  it("puts the full-bleed layouts at the even indices", () => {
    expect(LAYOUTS).toEqual(["banner", "panel", "edge", "frame"]);
  });

  it("gives every card a first version that can be animated", async () => {
    for (const when of [DECEMBER, JULY]) {
      const cards = await storyCards(when);
      for (const card of cards) expect(animatable(card, 0)).toBe(true);
    }
  });

  it("never repeats a version, since posting both would post the same caption twice", async () => {
    for (const when of [DECEMBER, JULY]) {
      const cards = await storyCards(when);
      for (const card of cards) {
        const said = card.versions.map((v) => `${v.eyebrow}|${v.captions.tiktok.text}`);
        expect(new Set(said).size, `${card.id} repeats itself`).toBe(said.length);
      }
    }
  });

  /*
    Product type labels are plural categories, not materials: "T-Shirts & Apparel",
    "Digital Downloads". Saying a design is printed on one produced "Golf Shirt, printed
    on t-shirts & apparel" and told shoppers a digital download ships from the US.
  */
  it("never says a design is printed on a product category", async () => {
    for (const when of [DECEMBER, JULY]) {
      const cards = await storyCards(when);
      for (const card of cards) {
        for (const version of card.versions) {
          expect(version.captions.tiktok.text).not.toMatch(/printed on .*&/i);
          expect(version.captions.tiktok.text).not.toMatch(/printed on digital/i);
        }
      }
    }
  });

  it("only claims a print-and-ship story for wrapping paper, as /contact does", async () => {
    const listings = await getAllListings();
    for (const when of [DECEMBER, JULY]) {
      const cards = await storyCards(when);
      for (const card of cards) {
        const listing = listings.find((l) => listingSlug(l) === card.id)!;
        const wrapping = deriveProductType(listing) === "wrapping-paper";
        for (const version of card.versions) {
          const ships = /shipped from the US/.test(version.captions.tiktok.text);
          expect(ships, `${card.id} (${deriveProductType(listing)})`).toBe(wrapping);
        }
      }
    }
  });

  /*
    The occasion a card is presented as has to be the one it was selected for.
    `deriveOccasions` returns matches in rule order, so re-deriving picked Halloween for
    birthday listings and captioned them "Halloween sorted" in July.
  */
  it("says the same occasion in the chip, the eyebrow and the tags", async () => {
    for (const when of [DECEMBER, JULY]) {
      const cards = await storyCards(when);
      for (const card of cards.filter((c) => c.reason.startsWith("In season"))) {
        expect(card.reason).toBe(`In season · ${occasionLabel(card.occasion!)}`);
        const occasionVersion = card.versions.find(
          (v) => v.eyebrow === occasionLabel(card.occasion!)
        );
        expect(occasionVersion, `${card.id} has no version for its own occasion`).toBeTruthy();
        expect(occasionVersion!.captions.tiktok.text).toContain(
          `${occasionLabel(card.occasion!)} sorted.`
        );
        for (const version of card.versions) {
          expect(version.captions.tiktok.hashtags).toContain(toHashtag(occasionLabel(card.occasion!)));
        }
      }
    }
  });

  it("names no occasion at all rather than guessing one", async () => {
    const cards = await storyCards(JULY);
    for (const card of cards.filter((c) => c.occasion === null)) {
      for (const version of card.versions) {
        expect(version.captions.tiktok.text).not.toMatch(/sorted\./);
      }
    }
  });

  it("keeps every TikTok title inside the limit", async () => {
    const cards = await storyCards(DECEMBER);
    for (const card of cards) {
      for (const version of card.versions) {
        expect(version.captions.tiktok.title!.length).toBeLessThanOrEqual(TIKTOK_TITLE_MAX);
      }
    }
  });

  it("gives each platform five tags and Instagram a link to the design", async () => {
    const cards = await storyCards(DECEMBER);
    for (const card of cards) {
      for (const version of card.versions) {
        for (const platform of platforms) {
          const tags = version.captions[platform].hashtags;
          expect(tags).toHaveLength(5);
          expect(new Set(tags).size).toBe(5);
        }
        expect(version.captions.instagram.link).toContain(`utm_source=instagram`);
        expect(version.captions.instagram.link).toContain(card.id);
      }
    }
  });

  it("names the design, with no product type doubled into the panel", async () => {
    const listings = await getAllListings();
    const cards = await storyCards(DECEMBER);
    for (const card of cards) {
      const listing = listings.find((l) => listingName(l) === card.title);
      expect(listing, `no listing behind ${card.id}`).toBeTruthy();
      for (const version of card.versions) {
        expect(version.lines.length).toBeLessThanOrEqual(1);
        expect(version.lines).not.toContain(version.eyebrow);
      }
    }
  });
});

describe("shopDayStart", () => {
  it("gives one value per shop day, whatever the time of day", () => {
    // 05:00Z on Nov 13 is midnight in New York; 04:59Z on Nov 14 is 23:59 the same day.
    const open = shopDayStart(new Date("2026-11-13T05:00:01Z"));
    expect(shopDayStart(new Date("2026-11-13T18:30:00Z"))).toBe(open);
    expect(shopDayStart(new Date("2026-11-14T04:59:59Z"))).toBe(open);
    // One second later is the next shop day.
    expect(shopDayStart(new Date("2026-11-14T05:00:01Z"))).not.toBe(open);
  });
});

describe("storyCards across a shop day", () => {
  /*
    The whole card set has to be a function of the shop's date, not of the clock. The
    arrivals cutoff used to move by the second, so a listing left the set partway through
    an afternoon while the prerendered page still carried its image and save URLs, and
    every one of those URLs 404d until the page revalidated.

    The days tested are derived from the catalog rather than picked, because a date picked
    by hand tests nothing on a day when no listing happens to expire. These are exactly
    the days on which some listing crosses the 45-day line, so each one straddles a real
    boundary. Fourteen of them move the card set when the cutoff is not quantised.
  */
  const expiryDays = async () => {
    const listings = await getAllListings();
    const days = new Set<string>();
    for (const listing of listings) {
      const at = (listing.createdAt + NEW_ARRIVALS_DAYS * 86400) * 1000;
      days.add(toISODate(shopToday(new Date(at))));
    }
    return [...days].sort();
  };

  /** Every URL the page would hand out for a given instant. */
  const urlsAt = async (when: Date) =>
    (await storyCards(when))
      .flatMap((card) =>
        card.versions.map((_, n) => `${card.id}|${n}|${storyVersion(card, n, "story")}`)
      )
      .join(",");

  it("has days where a listing actually expires, so the sweep below means something", async () => {
    expect((await expiryDays()).length).toBeGreaterThan(0);
  });

  it("hands out the same URLs all day, every day one expires", async () => {
    for (const day of await expiryDays()) {
      // Both instants sit inside the same New York day under either UTC offset.
      const [open, close] = await Promise.all([
        urlsAt(new Date(`${day}T05:00:01Z`)),
        urlsAt(new Date(`${day}T23:59:59Z`)),
      ]);
      expect(close, `the card set moved during ${day}`).toBe(open);
    }
  }, 60_000);
});

describe("storyVersion", () => {
  it("differs per format, so a square cannot be served for a story", async () => {
    const [card] = await storyCards(DECEMBER);
    expect(storyVersion(card, 0, "square")).not.toBe(storyVersion(card, 0, "story"));
  });

  it("differs per version, so one version's URL cannot render another", async () => {
    const [card] = await storyCards(DECEMBER);
    const hashes = card.versions.map((_, n) => storyVersion(card, n, "story"));
    expect(new Set(hashes).size).toBe(hashes.length);
  });

  it("changes when the words on the card change", async () => {
    const [card] = await storyCards(DECEMBER);
    const before = storyVersion(card, 0, "story");
    const edited = {
      ...card,
      versions: card.versions.map((v, i) => (i === 0 ? { ...v, title: `${v.title} (sale)` } : v)),
    };
    expect(storyVersion(edited, 0, "story")).not.toBe(before);
  });

  it("changes when the photo changes, so a relinked design re-renders", async () => {
    const [card] = await storyCards(DECEMBER);
    const before = storyVersion(card, 0, "square");
    expect(storyVersion({ ...card, photo: `${card.photo}?v=2` }, 0, "square")).not.toBe(before);
  });

  it("is empty for a version that does not exist", async () => {
    const [card] = await storyCards(DECEMBER);
    expect(storyVersion(card, 99, "story")).toBe("");
  });
});

describe("formats", () => {
  it("offers the square and the 9:16 story at the sizes the apps want", () => {
    expect(STORY_FORMATS.square).toMatchObject({ width: 1080, height: 1080 });
    expect(STORY_FORMATS.story).toMatchObject({ width: 1080, height: 1920 });
  });
});
