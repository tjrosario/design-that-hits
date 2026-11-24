import { describe, expect, it } from "vitest";
import { NEW_ARRIVALS_DAYS } from "@/lib/arrivals";
import { captionLine } from "@/lib/caption";
import { deriveProductType, occasionLabel } from "@/lib/facets";
import { getAllListings } from "@/lib/shop";
import { shopToday, toISODate } from "@/lib/shop-time";
import { listingName, listingSlug } from "@/lib/slug";
import {
  LAYOUTS,
  MAX_CARDS,
  MAX_SHOTS,
  STORY_FORMATS,
  TIKTOK_TITLE_MAX,
  clampCaption,
  platforms,
  storyCards,
  storyVersion,
  toHashtag,
  animatable,
  shopDayStart,
  videoVersion,
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

  /*
    The whole page used to be drawn in one kit. Only three occasions had a palette and
    every other card fell through to the calendar's, so in late November a golf shirt, a
    wedding paper and a goth birthday were the same card in the same orange.
  */
  it("draws the page in more than one kit", async () => {
    for (const when of [DECEMBER, JULY]) {
      const cards = await storyCards(when);
      const kits = new Set(cards.flatMap((c) => c.versions.map((v) => v.palette)));
      expect(kits.size, when.toISOString().slice(0, 10)).toBeGreaterThan(1);
    }
  });

  /* A design for a dated holiday wears that holiday whatever its theme is, because that
     is what a shopper is looking for. A goth Christmas paper is a Christmas paper. */
  it("lets a dated occasion outrank the design's theme", async () => {
    for (const when of [DECEMBER, JULY]) {
      for (const card of await storyCards(when)) {
        if (!card.id.includes("christmas")) continue;
        for (const v of card.versions) expect(v.palette, card.id).toBe("christmas");
      }
    }
  });

  /* Birthday is read only after the theme, so the shop's goth and glam birthday papers
     keep their own look instead of all sharing one party palette. */
  it("lets a theme outrank an undated occasion", async () => {
    const cards = await storyCards(JULY);
    const goth = cards.filter((c) => c.id.includes("goth") && !c.id.includes("christmas"));
    for (const card of goth) {
      for (const v of card.versions) expect(v.palette, card.id).toBe("gothic");
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

  /*
    Every caption used to close on how the design was made, which meant every post the
    shop has ever written ended with the same sentence. It is true and it is useless: it
    reads identically under 418 different designs and says nothing about any of them.
  */
  it("makes no fulfilment claim in a caption, on either platform", async () => {
    for (const when of [DECEMBER, JULY]) {
      const cards = await storyCards(when);
      for (const card of cards) {
        for (const version of card.versions) {
          for (const platform of platforms) {
            const { title, text } = version.captions[platform];
            expect(`${title ?? ""} ${text}`, card.id).not.toMatch(
              /printed on demand|shipped from|ships? from|instant digital download/i
            );
          }
        }
      }
    }
  });

  it("says something about the design itself, taken from its own description", async () => {
    const listings = await getAllListings();
    for (const when of [DECEMBER, JULY]) {
      const cards = await storyCards(when);
      for (const card of cards) {
        const listing = listings.find((l) => listingSlug(l) === card.id)!;
        const line = captionLine(listing);
        for (const version of card.versions) {
          // Only when the description holds one. A caption is shorter, never invented.
          if (line) expect(version.captions.tiktok.text, card.id).toContain(line);
          // No usable sentence leaves the opener and the ask, and no empty line between.
          else expect(version.captions.tiktok.text.split("\n"), card.id).toHaveLength(2);
        }
      }
    }
  });

  it("opens every caption with an emoji, so a post is never a bare product name", async () => {
    for (const when of [DECEMBER, JULY]) {
      const cards = await storyCards(when);
      for (const card of cards) {
        for (const version of card.versions) {
          for (const platform of platforms) {
            const { title, text } = version.captions[platform];
            expect(text, card.id).toMatch(/^\p{Extended_Pictographic}/u);
            if (title) expect(title, card.id).toMatch(/^\p{Extended_Pictographic}/u);
          }
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

  it("gives every card shots to animate, led by the photo the still uses", async () => {
    const cards = await storyCards(DECEMBER);
    for (const card of cards) {
      expect(card.photos.length, card.id).toBeGreaterThan(0);
      expect(card.photos.length, card.id).toBeLessThanOrEqual(MAX_SHOTS);
      // The video's first shot has to be the image the card already shows.
      expect(card.photos[0]).toBe(card.photo);
      // A repeated URL would read as a stall in the middle of the clip.
      expect(new Set(card.photos).size).toBe(card.photos.length);
    }
  });

  /** A photo's own id in an Etsy URL, which is the same across its sizes. */
  const photoId = (url: string) => /il_[a-z0-9]+x[a-z0-9]+\.(\d+)/i.exec(url)?.[1] ?? url;

  it("animates every mockup the listing has, not a slice of them", async () => {
    const listings = await getAllListings();
    const cards = await storyCards(DECEMBER);
    let fullSets = 0;
    for (const card of cards) {
      const listing = listings.find((l) => listingSlug(l) === card.id);
      expect(listing, `no listing behind ${card.id}`).toBeTruthy();
      // Every distinct photo the listing holds, counted by id so two sizes count once.
      const available = new Set(
        [listing!.image!.url, ...(listing!.images ?? [])].map(photoId)
      );
      expect(new Set(card.photos.map(photoId)), card.id).toEqual(available);
      if (card.photos.length >= 8) fullSets++;
    }
    // Most of the catalogue carries a full set, so a capped slice would show up here.
    expect(fullSets).toBeGreaterThan(cards.length / 2);
  });

  it("never animates one photo twice, even when two sizes of it arrive", async () => {
    /*
      The feed gives the primary photo as `il_570xN` and the mockup export gives the same
      photo as `il_fullxfull`. Compared as strings they look like two mockups.
    */
    const cards = await storyCards(DECEMBER);
    for (const card of cards) {
      const ids = card.photos.map(photoId);
      expect(new Set(ids).size, `${card.id}: ${card.photos.join(" ")}`).toBe(ids.length);
    }
  });

  it("leads with the largest copy the catalogue holds, not a listing-card thumbnail", async () => {
    /*
      570px cannot fill a 1080-wide frame without being upscaled. The feed hands over the
      primary photo at that size, and the mockup export hands over the same photo whole,
      so wherever both have arrived the card has to take the whole one. A listing synced
      before its next mockup export has only the small copy, and keeps it.
    */
    const listings = await getAllListings();
    const cards = await storyCards(DECEMBER);
    for (const card of cards) {
      if (!card.photo.includes("il_570xN")) continue;
      const listing = listings.find((l) => listingSlug(l) === card.id);
      const larger = (listing!.images ?? []).filter(
        (url) => photoId(url) === photoId(card.photo) && !url.includes("il_570xN")
      );
      expect(larger, `${card.id} kept a thumbnail it could replace`).toHaveLength(0);
    }
  });

  it("re-renders a cached video when a card's mockups change", async () => {
    const cards = await storyCards(DECEMBER);
    /*
      A card the catalogue holds more than one mockup for. Taking the first card instead
      made this pass by luck: a listing published since the last mockup export carries
      only its primary photo, and reversing a list of one changes nothing. The catalogue
      gained exactly such a listing, and it sorts to the front in December.
    */
    const card = cards.find((c) => c.photos.length > 1);
    if (!card) throw new Error("no card on the page has more than one mockup");
    const before = videoVersion(card, 0);
    const swapped = { ...card, photos: [...card.photos].reverse() };
    expect(videoVersion(swapped, 0)).not.toBe(before);
    // The still draws only `photo`, so its own hash must not churn for the extra shots.
    expect(storyVersion(swapped, 0, "story")).toBe(storyVersion(card, 0, "story"));
  });

  it("quotes no price anywhere, since a post outlives the one it was made from", async () => {
    const cards = await storyCards(DECEMBER);
    for (const card of cards) {
      for (const version of card.versions) {
        for (const platform of platforms) {
          const { title, text } = version.captions[platform];
          expect(`${title ?? ""} ${text}`).not.toMatch(/[$£€]\s?\d|\d+\.\d\d/);
        }
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
        /*
          At most one line, and a listing whose description holds no usable sentence gets
          none. Never a price, because the pixels outlive it, and never the eyebrow's own
          words, which sit two lines above it.
        */
        expect(version.lines.length).toBeLessThanOrEqual(1);
        expect(version.lines).not.toContain(version.eyebrow);
        if (version.lines[0]) {
          expect(version.lines[0]).not.toMatch(/[$£€]\s?\d|\d+\.\d\d/);
        }
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
