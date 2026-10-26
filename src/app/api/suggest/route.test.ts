import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/suggest/route";
import { MAX_QUERY_CHARS } from "@/lib/suggest-contract";
import { getAllListings } from "@/lib/shop";
import { listingName } from "@/lib/slug";

const call = (query: string) =>
  GET(new NextRequest(`https://designthathits.com/api/suggest${query}`));

describe("GET /api/suggest", () => {
  it("answers with suggestions for a real query", async () => {
    const response = await call("?q=chris");
    expect(response.status).toBe(200);

    const { suggestions } = await response.json();
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]).toHaveProperty("href");
    expect(suggestions[0]).toHaveProperty("kind");
  });

  it("returns an empty list rather than an error for a short or missing query", async () => {
    for (const query of ["", "?q=", "?q=c", "?q=%20%20"]) {
      const response = await call(query);
      expect(response.status, query).toBe(200);
      expect((await response.json()).suggestions, query).toEqual([]);
    }
  });

  /*
    Every distinct query string is its own CDN key. Caching empty answers would let
    anyone pin unbounded edge entries with junk prefixes, and an empty answer costs one
    pass over the catalog to rebuild, so it is never worth storing.
  */
  it("does not let an empty answer be cached", async () => {
    for (const query of ["?q=c", "?q=zzzznotathing", `?q=${"a".repeat(5000)}`]) {
      const response = await call(query);
      expect((await response.clone().json()).suggestions, query).toEqual([]);
      expect(response.headers.get("cache-control"), query).toBe("no-store");
    }
  });

  it("lets a real answer be cached at the edge", async () => {
    const cache = (await call("?q=chris")).headers.get("cache-control");
    expect(cache).toContain("s-maxage=600");
  });

  it("keeps suggestions out of the index", async () => {
    expect((await call("?q=chris")).headers.get("x-robots-tag")).toBe("noindex");
  });

  /*
    Asserting the cap where it is observable. A query of 5000 junk characters returns an
    empty list with or without the cap, so testing that proves nothing. Taking a real
    product name and padding it past 64 does: the truncated prefix still matches, so the
    query row comes back, and its label is the 64-character prefix rather than what was
    sent.
  */
  it("truncates a long query rather than working through it", async () => {
    const listings = await getAllListings();
    const long = listings.map(listingName).find((name) => name.length >= MAX_QUERY_CHARS);
    expect(long, "no display name long enough to exercise the cap").toBeDefined();

    const prefix = long!.slice(0, MAX_QUERY_CHARS);
    const sent = `${prefix}${"z".repeat(20)}`;
    const { suggestions } = await (await call(`?q=${encodeURIComponent(sent)}`)).json();

    const query = suggestions.find((s: { kind: string }) => s.kind === "query");
    expect(query, "the truncated prefix should still match").toBeDefined();
    expect(query.label).toBe(prefix.trim());
    expect(query.label.length).toBeLessThanOrEqual(MAX_QUERY_CHARS);
  });

  it("answers an absurdly long junk query with an uncacheable empty list", async () => {
    const response = await call(`?q=${"a".repeat(5000)}`);
    expect(response.status).toBe(200);
    expect((await response.json()).suggestions).toEqual([]);
  });

  // An extra parameter is ignored but is still part of the CDN key, so it must not be
  // able to mint edge entries.
  it("refuses to cache a URL carrying anything but q", async () => {
    const response = await call("?q=chris&cb=12345");
    expect((await response.clone().json()).suggestions.length).toBeGreaterThan(0);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("handles a query that is only punctuation", async () => {
    const response = await call("?q=%26%26%26");
    expect(response.status).toBe(200);
    expect(Array.isArray((await response.json()).suggestions)).toBe(true);
  });
});
