import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/designs/[slug]/pin-image/route";
import { getAllListings } from "@/lib/shop";
import { listingSlug } from "@/lib/slug";

/* A real 1x1 PNG, so the render path runs without reaching Etsy from CI. */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

function stubPhoto(response: () => Response) {
  vi.stubGlobal("fetch", vi.fn(async () => response()));
}

afterEach(() => vi.unstubAllGlobals());

/**
 * The guards on an expensive route.
 *
 * Rendering one pin costs a remote fetch of a multi-megabyte photo plus a megabyte of
 * PNG encoding, and the route is reachable by anyone for any slug. `idFromSlug` reads
 * only the trailing digits, so before these guards every prefix of every id was a
 * distinct URL, a distinct CDN entry and a distinct render of the same image.
 */
const call = (slug: string, search = "") =>
  GET(new Request(`https://designthathits.com/designs/${slug}/pin-image${search}`), {
    params: Promise.resolve({ slug }),
  });

describe("pin-image guards", () => {
  it("refuses a non-canonical slug that resolves to a real listing", async () => {
    const [listing] = await getAllListings();
    const canonical = listingSlug(listing);

    for (const slug of [`x-${listing.id}`, `${listing.id}`, `cachebust-9281-${listing.id}`]) {
      expect(slug).not.toBe(canonical);
      expect((await call(slug)).status, slug).toBe(404);
    }
  });

  it("refuses any query string", async () => {
    const [listing] = await getAllListings();
    expect((await call(listingSlug(listing), "?cb=1")).status).toBe(404);
  });

  it("refuses a slug with no id and an id in no catalog", async () => {
    expect((await call("no-id-here")).status).toBe(404);
    expect((await call("x-999999999")).status).toBe(404);
  });

  // A 404 that the CDN caches would be as hard to clear as a bad image.
  it("never lets a refusal be cached", async () => {
    const response = await call("no-id-here");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("accepts the canonical slug the save button actually emits", async () => {
    stubPhoto(() => new Response(PIXEL, { headers: { "content-type": "image/png" } }));
    const [listing] = await getAllListings();
    const response = await call(listingSlug(listing));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toContain("s-maxage=86400");
  });

  /*
    The failure this route exists to avoid. satori renders a missing image as an empty
    hole and still returns 200; cached for a day and copied by Pinterest at save time,
    that blank becomes permanent on someone's board. A failed photo must not be a 200,
    and must not be cacheable.
  */
  it("fails loudly and uncacheably when the photo cannot be fetched", async () => {
    const [listing] = await getAllListings();

    for (const broken of [
      () => new Response("", { status: 404 }),
      () => new Response("<!doctype html>", { headers: { "content-type": "text/html" } }),
      () => new Response(Buffer.from([1, 2, 3]), { headers: { "content-type": "image/png" } }),
    ]) {
      stubPhoto(broken);
      const response = await call(listingSlug(listing));
      expect(response.status).toBe(502);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("content-type")).not.toBe("image/png");
    }
  });
});
