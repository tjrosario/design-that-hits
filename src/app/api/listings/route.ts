/**
 * app/api/listings/route.ts
 *
 * Proxies Etsy listing fetches server-side, keeping ETSY_API_KEY out of the client.
 * etsy.ts never throws — it returns EtsyResult<T>. We map error codes to appropriate
 * HTTP responses so the client UI can show the right degraded state.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getListings, getListingsForRanking } from "@/lib/shop";
import type { ShopErrorCode } from "@/lib/shop";
import { parseQuery } from "@/lib/query";
import { rankBestSellers, rankTrending } from "@/lib/rank";

const PAGE_SIZE = 24;

export const runtime = "nodejs";

/** Map internal error codes to HTTP status codes */
function httpStatusFor(code: ShopErrorCode): number {
  switch (code) {
    case "MISSING_API_KEY": return 503; // Service misconfigured
    case "CATALOG_EMPTY":   return 503; // Catalog never populated — see npm run sync:catalog
    case "RATE_LIMITED":    return 429;
    case "NOT_FOUND":       return 404;
    case "NETWORK_ERROR":   return 502; // Bad gateway — upstream unreachable
    case "API_ERROR":       return 502;
    default:                return 500;
  }
}

/** User-facing messages — never expose internal details */
function userMessageFor(code: ShopErrorCode): string {
  switch (code) {
    case "MISSING_API_KEY":
    case "CATALOG_EMPTY":
      return "The shop is temporarily unavailable. Please check back soon.";
    case "RATE_LIMITED":
      return "We're receiving a lot of traffic. Please wait a moment and try again.";
    case "NOT_FOUND":
      return "This collection couldn't be found.";
    case "NETWORK_ERROR":
    case "API_ERROR":
      return "Couldn't reach the shop right now. Please try refreshing.";
    default:
      return "Something went wrong loading the shop. Please try again.";
  }
}

export async function GET(req: NextRequest) {
  try {
    const rawParams: Record<string, string> = {};
    req.nextUrl.searchParams.forEach((v, k) => { rawParams[k] = v; });

    const { q, sectionIds, types, themes, priceBands, sort, pill, page } =
      parseQuery(rawParams);
    const needsRanking = pill === "best" || pill === "trending";

    // Every filter group, forwarded identically down both paths below.
    const filters = {
      q: q || undefined,
      sectionIds: sectionIds.length > 0 ? sectionIds : undefined,
      types: types.length > 0 ? types : undefined,
      themes: themes.length > 0 ? themes : undefined,
      priceBands: priceBands.length > 0 ? priceBands : undefined,
    };

    // ── Trending / Best Sellers path ─────────────────────────────────────────
    if (needsRanking) {
      // Filtering (including the search term) happens inside getListingsForRanking, so
      // the ranking sees exactly the set the shopper narrowed to.
      const filtered = await getListingsForRanking(filters);

      const ranked = pill === "best" ? rankBestSellers(filtered) : rankTrending(filtered);
      const total  = ranked.length;
      const start  = (page - 1) * PAGE_SIZE;
      const listings = ranked.slice(start, start + PAGE_SIZE);

      return NextResponse.json({ listings, total, page, pageSize: PAGE_SIZE });
    }

    // ── Standard fetch path ───────────────────────────────────────────────────
    const sortOn: "created" | "price" =
      sort === "price_asc" || sort === "price_desc" ? "price" : "created";
    const sortOrder: "asc" | "desc" =
      sort === "price_asc" ? "asc" : "desc";

    const result = await getListings({
      ...filters,
      sortOn,
      sortOrder,
      page,
      limit: PAGE_SIZE,
    });

    if (!result.ok) {
      const status  = httpStatusFor(result.error.code);
      const message = userMessageFor(result.error.code);
      // Log the real error server-side, return a safe message to the client
      console.error(`[/api/listings] ${result.error.code}: ${result.error.message}`);
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json({
      listings: result.data.listings,
      total:    result.data.total,
      page,
      pageSize: PAGE_SIZE,
    });

  } catch (err) {
    // Unexpected — e.g. a bug in parseQuery or rank logic
    console.error("[/api/listings] Unexpected error:", err);
    return NextResponse.json(
      { error: "Something went wrong loading the shop. Please try again." },
      { status: 500 }
    );
  }
}
