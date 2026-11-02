import { describe, it, expect } from "vitest";
import { getCatalogListings } from "@/lib/catalog";
import {
  canonicalIdFor,
  deferredPrimaryId,
  defersToAnother,
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

const DUPLICATES = [4415243885, 4415238112, 4396574071];
const PRIMARIES = [4408182930, 4408195937, 4396573340];
const DISTINCT = [4490472396, 4490014655];

describe("duplicate groups", () => {
  it("points each duplicate at its primary and leaves everything else alone", () => {
    expect(canonicalIdFor(listing(4415243885))).toBe(4408182930);
    expect(canonicalIdFor(listing(4415238112))).toBe(4408195937);
    expect(canonicalIdFor(listing(4396574071))).toBe(4396573340);

    for (const primary of PRIMARIES) {
      expect(canonicalIdFor(listing(primary)), String(primary)).toBeNull();
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
    const deferring = catalog.filter((l) => defersToAnother(l, catalog));
    expect(deferring.map((l) => l.id).sort()).toEqual([...DUPLICATES].sort());
    for (const d of deferring) {
      const primary = canonicalIdFor(d);
      expect(primary).not.toBeNull();
      expect(listing(primary!).title.trim()).toBe(d.title.trim());
    }
  });

  /*
    A delisted primary leaves its copy as the only page for that product. The copy has to
    stop deferring everywhere at once, or it self-canonicalises while staying out of the
    sitemap and the Pinterest feed.
  */
  it("stops deferring when the primary leaves the catalog", () => {
    const orphan = listing(4415243885);
    expect(deferredPrimaryId(orphan, () => true)).toBe(4408182930);
    expect(deferredPrimaryId(orphan, () => false)).toBeNull();

    const withoutPrimary = catalog.filter((l) => l.id !== 4408182930);
    expect(defersToAnother(orphan, withoutPrimary)).toBe(false);
    expect(defersToAnother(orphan, catalog)).toBe(true);
  });
});

/*
  4490472396 and 4490014655 share a title and a description on Etsy but are different
  designs: diploma scrolls on light blue, and graduation caps on olive. Merging them would
  drop one out of search, so both stay indexable and the fix belongs on Etsy.
*/
describe("listings that share a title without being the same product", () => {
  it("leaves both graduation designs indexable", () => {
    for (const id of DISTINCT) {
      expect(defersToAnother(listing(id), catalog), String(id)).toBe(false);
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
  const ids = (groups: Listing[][]) => groups.map((g) => g.map((l) => l.id).sort());

  it("reports no unreviewed title collisions in the current catalog", () => {
    const described = unreviewedTitleCollisions(catalog).map(
      (group) => `"${group[0].title.slice(0, 60)}" -> ${group.map((l) => l.id).join(", ")}`
    );
    expect(described).toEqual([]);
  });

  it("notices a collision involving a listing nobody has looked at", () => {
    const [a] = catalog;
    const stranger = { ...a, id: 1 } as Listing;
    expect(ids(unreviewedTitleCollisions([...catalog, stranger])).flat()).toContain(1);
  });

  it("notices a third listing joining a group that was already reviewed", () => {
    const joiner = { ...listing(4396573340), id: 2 } as Listing;
    const groups = ids(unreviewedTitleCollisions([...catalog, joiner]));
    expect(groups).toContainEqual([2, 4396573340, 4396574071].sort((a, b) => a - b));
  });

  /*
    The case a flat set of reviewed ids cannot see: two listings that were each reviewed in
    a different group, brought together by an Etsy retitle. Both would stay indexable and
    nothing would report that they now compete for one query.
  */
  it("notices two already-reviewed primaries colliding after a retitle", () => {
    const retitled = catalog.map((l) =>
      l.id === 4408195937 ? ({ ...l, title: listing(4396573340).title } as Listing) : l
    );
    const groups = ids(unreviewedTitleCollisions(retitled));
    expect(groups).toContainEqual([4396573340, 4396574071, 4408195937].sort((a, b) => a - b));
  });

  /*
    Matching on the exact normalized title is all this does, so a relisting whose copy was
    retyped slips past. Pinned so the limit is known rather than assumed.
  */
  it("does not catch a duplicate whose title was retyped", () => {
    const reworded = { ...listing(4396573340), id: 3, title: `${listing(4396573340).title} Set` };
    expect(unreviewedTitleCollisions([...catalog, reworded as Listing])).toEqual([]);
  });
});
