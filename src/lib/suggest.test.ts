import { describe, expect, it } from "vitest";
import { MIN_QUERY_CHARS, suggest } from "@/lib/suggest";
import { getAllListings } from "@/lib/shop";
import { getCollections } from "@/lib/collections";
import { filterListings } from "@/lib/catalog";

async function fixtures() {
  const [listings, collections] = await Promise.all([getAllListings(), getCollections()]);
  return { listings, collections, run: (q: string) => suggest(q, listings, collections) };
}

describe("suggest", () => {
  it("offers nothing below the query floor", async () => {
    const { run } = await fixtures();
    expect(run("")).toEqual([]);
    expect(run("c")).toEqual([]);
    expect(run("  ".padEnd(MIN_QUERY_CHARS))).toEqual([]);
  });

  /*
    The invariant that makes a suggestion safe to click. A collection or a product is a
    destination, so it cannot lead anywhere empty; the query row is the only one that
    runs a search, and its count has to be the number the results page will show.
  */
  it("never suggests a query that returns nothing", async () => {
    const { listings, run } = await fixtures();
    for (const q of ["chris", "skull", "cat", "wrap", "pride", "zzzznotathing"]) {
      const query = run(q).find((s) => s.kind === "query");
      const actual = filterListings(listings, { q }).length;
      if (actual === 0) expect(query, q).toBeUndefined();
      else expect(query?.count, q).toBe(actual);
    }
  });

  it("puts collections before products", async () => {
    const { run } = await fixtures();
    const kinds = run("chris").map((s) => s.kind);
    expect(kinds[0]).toBe("collection");
    expect(kinds[kinds.length - 1]).toBe("query");
    expect(kinds.indexOf("collection")).toBeLessThan(kinds.indexOf("product"));
  });

  it("prefers a name that starts with the query", async () => {
    const { run } = await fixtures();
    const products = run("cat").filter((s) => s.kind === "product");
    expect(products.length).toBeGreaterThan(0);
    expect(products[0].label.toLowerCase().startsWith("cat")).toBe(true);
  });

  // Two listings can share a display name, and the same words twice reads as a bug.
  it("never repeats a label", async () => {
    const { run } = await fixtures();
    for (const q of ["chris", "wrap", "cat", "gothic"]) {
      const labels = run(q).map((s) => `${s.kind}:${s.label.toLowerCase()}`);
      expect(new Set(labels).size, q).toBe(labels.length);
    }
  });

  it("stays short enough to read", async () => {
    const { run } = await fixtures();
    for (const q of ["chris", "wrap", "a ", "cat", "paper"]) {
      expect(run(q).length, q).toBeLessThanOrEqual(9);
    }
  });

  it("returns nothing at all for a query that matches nothing", async () => {
    const { run } = await fixtures();
    expect(run("zzzznotathing")).toEqual([]);
  });

  // Every href is a real page, so a click cannot 404.
  it("only points at paths the site serves", async () => {
    const { run } = await fixtures();
    for (const q of ["chris", "skull", "cat", "wrap"]) {
      for (const s of run(q)) {
        if (s.kind === "collection") expect(s.href, s.label).toMatch(/^\/collections\/[a-z0-9-]+$/);
        if (s.kind === "product") expect(s.href, s.label).toMatch(/^\/designs\/[a-z0-9-]+-\d+$/);
        if (s.kind === "query") expect(s.href, s.label).toMatch(/^\/\?q=/);
      }
    }
  });

  it("encodes a query with characters that would break the URL", async () => {
    const { run } = await fixtures();
    const query = run("rock & roll").find((s) => s.kind === "query");
    if (query) {
      expect(query.href).not.toContain(" ");
      expect(new URL(query.href, "https://x.test").searchParams.get("q")).toBe("rock & roll");
    }
  });

  it("ignores surrounding whitespace", async () => {
    const { run } = await fixtures();
    expect(run("  cat  ")).toEqual(run("cat"));
  });
});
