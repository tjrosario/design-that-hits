import { describe, expect, it } from "vitest";
import { primaryOccasion } from "@/lib/facets";
import { musicFor } from "@/lib/music";
import { getAllListings } from "@/lib/shop";
import { SUBJECTS } from "@/lib/subject";
import type { Listing } from "@/types/etsy";

/** Only the title and description steer the terms, so the rest is filled in once. */
function listing(title: string, description = ""): Listing {
  return { id: 1, title, description, tags: [] } as unknown as Listing;
}

describe("musicFor", () => {
  it("leads with the design's own subject", () => {
    const casino = listing(
      "Lucky Christmas Wrapping Paper",
      "Retro casino illustrations, slot machines and poker chips."
    );
    expect(musicFor(casino, "christmas").slice(0, 2)).toEqual(["vegas lounge", "rat pack swing"]);
  });

  it("ends with the format the post takes, whatever else matched", () => {
    /*
      The reason the format term is held back rather than queued. This design matches a
      subject, a season and a mood, which between them used to fill every slot.
    */
    const terms = musicFor(
      listing("Guinea Pig Christmas Wrapping Paper", "A playful design with fluffy guinea pigs."),
      "christmas"
    );
    expect(terms).toHaveLength(5);
    expect(terms.at(-1)).toBe("gift wrapping asmr");
    expect(terms).toContain("cute pet music");
  });

  it("spends only one slot on the season when the design has a subject of its own", () => {
    // Two seasonal terms plus two subject terms and a mood would push the format term out.
    const terms = musicFor(
      listing("Guinea Pig Christmas Wrapping Paper", "A playful design with fluffy guinea pigs."),
      "christmas"
    );
    expect(terms).toContain("christmas jazz");
    expect(terms).not.toContain("cozy christmas");
  });

  it("gives a design with no subject the second seasonal term instead", () => {
    const plain = listing("Plain Christmas Wrapping Paper", "Simple stripes.");
    const terms = musicFor(plain, "christmas");
    expect(terms).toContain("christmas jazz");
    expect(terms).toContain("cozy christmas");
  });

  it("takes the strongest mood word rather than the first one in the text", () => {
    // Descriptions routinely call a design both elegant and dark; dark decides the tempo.
    const both = listing("A design", "An elegant, refined and altogether dark pattern.");
    expect(musicFor(both, null)).toContain("moody cinematic");
    expect(musicFor(both, null)).not.toContain("elegant piano");
  });

  it("repeats no term, even when two sources suggest the same one", () => {
    const terms = musicFor(listing("Cowgirl Horse Wrapping Paper", "Rodeo horses."), null);
    expect(new Set(terms).size).toBe(terms.length);
  });

  it("still gives something to search when nothing else matches", () => {
    expect(musicFor(listing("Unclassifiable", ""), null)).toEqual(["trending audio"]);
  });

  it("keeps every subject to a pair of terms, which is what makes the list fit", () => {
    /*
      The precondition behind the arithmetic above. Two per subject, plus one season and
      one mood, leaves the fifth slot for the format. A third would quietly take it.
    */
    for (const subject of SUBJECTS) {
      expect(subject.music.length, subject.who).toBeGreaterThan(0);
      expect(subject.music.length, subject.who).toBeLessThanOrEqual(2);
    }
  });

  describe("across the real catalogue", () => {
    it("gives every listing terms short enough to be a search", async () => {
      const listings = await getAllListings();
      for (const l of listings) {
        const terms = musicFor(l, primaryOccasion(l));
        expect(terms.length, l.title).toBeGreaterThan(0);
        expect(terms.length, l.title).toBeLessThanOrEqual(5);
        expect(new Set(terms).size, terms.join(" · ")).toBe(terms.length);
        for (const term of terms) {
          // A query, not a description of a song.
          expect(term, l.title).toMatch(/^[a-z][a-z ]{2,28}$/);
        }
      }
    });

    it("gives most listings something more specific than the season", async () => {
      const listings = await getAllListings();
      const seasonal = new Set(["christmas jazz", "cozy christmas", "spooky halloween"]);
      let specific = 0;
      for (const l of listings) {
        if (musicFor(l, primaryOccasion(l)).some((t) => !seasonal.has(t) && t !== "trending audio")) {
          specific++;
        }
      }
      expect(specific).toBeGreaterThan(listings.length * 0.9);
    });
  });
});
