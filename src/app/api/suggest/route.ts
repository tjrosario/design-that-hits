/**
 * Typeahead suggestions for the search box.
 *
 * Server-side so the client never downloads the catalog. 414 product names and 27
 * collection labels would be tens of kilobytes on every page, to answer a question most
 * visitors never ask.
 *
 * Everything it needs is already in memory: the catalog is a bundled import and the
 * collections are derived from it, so a request costs no I/O.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAllListings } from "@/lib/shop";
import { getCollections } from "@/lib/collections";
import { suggest } from "@/lib/suggest";
import { MAX_QUERY_CHARS, MIN_QUERY_CHARS } from "@/lib/suggest-contract";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const raw = params.get("q") ?? "";
  const q = raw.slice(0, MAX_QUERY_CHARS).trim();

  /*
    Everything but `q` is ignored here and still part of the CDN cache key, so
    `?q=chris&cb=1 … &cb=N` is an unbounded family of URLs with identical bodies. The
    answer stays correct, it just stops being worth an edge entry. Same reasoning as the
    guard on `designs/[slug]/pin-image`.
  */
  const canonical = [...params.keys()].every((key) => key === "q");

  if (q.length < MIN_QUERY_CHARS) {
    return NextResponse.json({ suggestions: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  const [listings, collections] = await Promise.all([getAllListings(), getCollections()]);
  const suggestions = suggest(q, listings, collections);

  /*
    Only a query that matched something is worth an edge entry. Every distinct string is
    its own cache key, so caching empty answers lets anyone pin unbounded entries with
    junk prefixes, and an empty answer costs one pass over the catalog to rebuild.
  */
  const cache =
    suggestions.length && canonical
      ? "public, max-age=0, s-maxage=600, stale-while-revalidate=3600"
      : "no-store";

  return NextResponse.json(
    { suggestions },
    {
      headers: {
        // The catalog only moves on a sync, so a repeated prefix is worth caching. Short
        // enough that a new product shows up the same day it lands.
        "Cache-Control": cache,
        // Suggestions are not pages and have no business in an index.
        "X-Robots-Tag": "noindex",
      },
    }
  );
}
