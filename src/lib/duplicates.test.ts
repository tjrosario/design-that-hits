import { describe, it, expect } from "vitest";
import { getCatalogListings } from "@/lib/catalog";
import {
  canonicalIdFor,
  isDuplicate,
  reviewedIds,
  unreviewedTitleCollisions,
} from "@/lib/duplicates";
import type { Listing } from "@/types/etsy";

const catalog = getCatalogListings();
const byId = new Map(catalog.map((l) => [l.id, l]));
const listing = (id: number): Listing => {
  const found = byId.get(id);
  if (!found) throw new Error(`${id} is not in the catalog`);
  return found;
};

describe("duplicate groups", () => {
  it("points each duplicate at its primary and leaves everything else alone", () => {
    expect(canonicalIdFor(listing(4415243885))).toBe(4408182930);
    expect(canonicalIdFor(listing(4415238112))).toBe(4408195937);
    expect(canonicalIdFor(listing(4396574071))).toBe(4396573340);

    for (const primary of [4408182930, 4408195937, 4396573340]) {
      expect(canonicalIdFor(listing(primary)), String(primary)).toBeNull();
      expect(isDuplicate(listing(primary)), String(primary)).toBe(false);
    }
  });

  /*
    A primary that is itself a duplicate would canonicalise a page to another page that
    canonicalises somewhere else, which Google follows for one hop and then ignores.
  */
  it("never chains one canonical into another", () => {
    for (const l of catalog) {
      const primaryId = canonicalIdFor(l);
      if (primaryId === null) continue;
      expect(canonicalIdFor(listing(primaryId)), `${l.id} -> ${primaryId}`).toBeNull();
    }
  });

  /*
    A dangling id means a listing was delisted and the map was not updated, which would
    canonicalise a live page to a 404.
  */
  it("references only listings that are still in the catalog", () => {
    for (const id of reviewedIds()) {
      expect(byId.has(id), `${id} missing from catalog`).toBe(true);
    }
  });

  it("keeps exactly one indexable page per duplicate group", () => {
    const duplicates = catalog.filter(isDuplicate);
    expect(duplicates).toHaveLength(3);
    for (const d of duplicates) {
      const primary = canonicalIdFor(d);
      expect(primary).not.toBeNull();
      expect(listing(primary!).title.trim()).toBe(d.title.trim());
    }
  });
});

/*
  4490472396 and 4490014655 share a title and a description on Etsy but are different
  designs: diploma scrolls on light blue, and graduation caps on olive. Merging them would
  drop one out of search, so both stay indexable and the fix belongs on Etsy.
*/
describe("listings that share a title without being the same product", () => {
  it("leaves both graduation designs indexable", () => {
    for (const id of [4490472396, 4490014655]) {
      expect(isDuplicate(listing(id)), String(id)).toBe(false);
      expect(canonicalIdFor(listing(id)), String(id)).toBeNull();
    }
  });
});

/*
  The catalog resyncs daily and new designs keep arriving, so another title collision will
  turn up. It needs the same comparison of the artwork that the reviewed ones got, because
  nothing in the metadata separates a real duplicate from two designs sharing a title.
*/
describe("the review guard", () => {
  it("reports no unreviewed title collisions in the current catalog", () => {
    const collisions = unreviewedTitleCollisions(catalog);
    const described = collisions.map(
      (group) => `"${group[0].title.slice(0, 60)}" -> ${group.map((l) => l.id).join(", ")}`
    );
    expect(described).toEqual([]);
  });

  it("notices a collision involving a listing nobody has looked at", () => {
    const [a] = catalog;
    const stranger = { ...a, id: 1, title: a.title } as Listing;
    const groups = unreviewedTitleCollisions([...catalog, stranger]);
    expect(groups.flat().map((l) => l.id)).toContain(1);
  });

  it("stays quiet about collisions that have already been reviewed", () => {
    const reviewed = reviewedIds();
    for (const group of unreviewedTitleCollisions(catalog)) {
      expect(group.every((l) => reviewed.has(l.id))).toBe(false);
    }
  });
});
