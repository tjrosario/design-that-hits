import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/suggest/route";

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

  // An empty answer is cheap to recompute and would otherwise pin a CDN entry for every
  // one-character prefix anyone types.
  it("does not let an empty answer be cached", async () => {
    expect((await call("?q=c")).headers.get("cache-control")).toBe("no-store");
  });

  it("lets a real answer be cached at the edge", async () => {
    const cache = (await call("?q=chris")).headers.get("cache-control");
    expect(cache).toContain("s-maxage=600");
  });

  it("keeps suggestions out of the index", async () => {
    expect((await call("?q=chris")).headers.get("x-robots-tag")).toBe("noindex");
  });

  // Each request walks 414 listings, so the length has to be bounded by something other
  // than what the caller sends.
  it("caps an absurdly long query instead of working through it", async () => {
    const response = await call(`?q=${"a".repeat(5000)}`);
    expect(response.status).toBe(200);
    expect((await response.json()).suggestions).toEqual([]);
  });

  it("handles a query that is only punctuation", async () => {
    const response = await call("?q=%26%26%26");
    expect(response.status).toBe(200);
    expect(Array.isArray((await response.json()).suggestions)).toBe(true);
  });
});
