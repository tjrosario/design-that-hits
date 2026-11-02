import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { getCatalogListings } from "@/lib/catalog";

/**
 * Only the copy that carries the ranking is submitted.
 *
 * Listing a URL that canonicalises elsewhere sends Google two contradictory hints, which
 * is the state this site was already in. The filter is one `.filter` in a block that gets
 * edited often, so nothing but this test stops it being dropped during a refactor.
 */
describe("sitemap duplicate handling", () => {
  const DUPLICATES = [4415243885, 4415238112, 4396574071];
  const PRIMARIES = [4408182930, 4408195937, 4396573340];
  const DISTINCT = [4490472396, 4490014655];

  it("submits every listing except the three that defer to another copy", async () => {
    const entries = await sitemap();
    const products = entries.filter((e) => e.url.includes("/designs/"));
    expect(products).toHaveLength(getCatalogListings().length - DUPLICATES.length);
  });

  it("leaves out the duplicates and keeps the pages they point at", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    const has = (id: number) => urls.some((u) => u.endsWith(`-${id}`));

    for (const id of DUPLICATES) expect(has(id), `duplicate ${id}`).toBe(false);
    for (const id of PRIMARIES) expect(has(id), `primary ${id}`).toBe(true);
    // Different designs that merely share a title, so both must still be submitted.
    for (const id of DISTINCT) expect(has(id), `distinct ${id}`).toBe(true);
  });
});
