import { describe, expect, it } from "vitest";
import { generateMetadata } from "@/app/designs/[slug]/page";
import { getCatalogListings } from "@/lib/catalog";
import { listingSlug } from "@/lib/slug";

/**
 * The canonical tag is the whole mechanism, and it is one `await` in a page module that
 * no other test touches. Reverting it to the page's own URL has to go red here.
 */
const catalog = getCatalogListings();
const slugFor = (id: number) => {
  const listing = catalog.find((l) => l.id === id);
  if (!listing) throw new Error(`${id} is not in the catalog`);
  return listingSlug(listing);
};

const canonicalOf = async (id: number) => {
  const meta = await generateMetadata({ params: Promise.resolve({ slug: slugFor(id) }) });
  return String(meta.alternates?.canonical ?? "");
};

describe("product page canonical", () => {
  it("points a duplicate at the copy that carries the ranking", async () => {
    expect(await canonicalOf(4415243885)).toMatch(/-4408182930$/);
    expect(await canonicalOf(4415238112)).toMatch(/-4408195937$/);
    expect(await canonicalOf(4396574071)).toMatch(/-4396573340$/);
  });

  it("leaves every other page canonicalising to itself", async () => {
    for (const id of [4408182930, 4408195937, 4396573340, 4490472396, 4490014655]) {
      expect(await canonicalOf(id), String(id)).toMatch(new RegExp(`-${id}$`));
    }
  });

  /*
    og:url follows the canonical so a share of a duplicate resolves to the ranking copy,
    while the page's own URL stays out of it.
  */
  it("sends the same URL to og:url", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: slugFor(4415243885) }),
    });
    expect(String(meta.openGraph?.url)).toMatch(/-4408182930$/);
  });
});
