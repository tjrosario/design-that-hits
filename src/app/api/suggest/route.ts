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
import { MIN_QUERY_CHARS, suggest } from "@/lib/suggest";

export const runtime = "nodejs";

/** Past this nothing in the catalog can match, so it is only a way to waste work. */
const MAX_QUERY_CHARS = 64;

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("q") ?? "";
  const q = raw.slice(0, MAX_QUERY_CHARS).trim();

  if (q.length < MIN_QUERY_CHARS) {
    return NextResponse.json({ suggestions: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  const [listings, collections] = await Promise.all([getAllListings(), getCollections()]);

  return NextResponse.json(
    { suggestions: suggest(q, listings, collections) },
    {
      headers: {
        // The catalog only moves on a sync, so a repeated prefix is worth caching. Short
        // enough that a new product shows up the same day it lands.
        "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate=3600",
        // Suggestions are not pages and have no business in an index.
        "X-Robots-Tag": "noindex",
      },
    }
  );
}
