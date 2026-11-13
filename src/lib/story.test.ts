import { describe, expect, it } from "vitest";
import { getAllListings } from "@/lib/shop";
import { listingName } from "@/lib/slug";
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
} from "@/lib/story";

/* Mid-December: Christmas is in season, so the catalog has plenty to build cards from. */
const DECEMBER = new Date("2026-12-10T12:00:00Z");

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
    The layouts alternate stacked and full-bleed by index, and a card's versions take
    consecutive entries, so any card with more than one version has at least one that the
    video route can animate. Reordering LAYOUTS silently breaks that, which is why it is
    asserted rather than assumed.
  */
  it("alternates stacked and full-bleed layouts", () => {
    expect(LAYOUTS).toEqual(["panel", "banner", "frame", "edge"]);
  });

  it("gives every card a version that can be animated", async () => {
    const cards = await storyCards(DECEMBER);
    for (const card of cards) {
      expect(card.versions.length).toBeGreaterThan(1);
      expect(card.versions.some((_, n) => animatable(card, n))).toBe(true);
    }
  });

  it("never claims a design is printed on what its own name already says", async () => {
    const cards = await storyCards(DECEMBER);
    for (const card of cards) {
      for (const version of card.versions) {
        expect(version.captions.tiktok.text).not.toMatch(
          /wrapping paper.*printed on wrapping paper/i
        );
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
