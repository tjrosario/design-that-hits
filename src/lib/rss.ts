/**
 * lib/rss.ts
 *
 * Etsy public shop RSS feed client — the live Etsy data source that needs no API key.
 *
 * WHY THIS EXISTS:
 * Etsy denied our API v3 application, so `lib/etsy.ts` has no key to authenticate with.
 * Every Etsy shop still publishes a public RSS feed at /shop/<name>/rss that requires no
 * credentials and no OAuth.
 *
 * HARD LIMIT — READ THIS BEFORE BUILDING ON IT:
 * The feed returns only the 10 most recently listed items. There is no pagination
 * parameter, no section filter, and no search. It is a freshness signal, NOT a catalog.
 * The full catalog lives in src/data/catalog.json (see lib/catalog.ts).
 *
 * FIELDS THE FEED PROVIDES (verified against the live feed):
 *   title, listing URL (→ listing ID), pubDate (→ createdAt), image URL, price, description
 *
 * FIELDS IT DOES NOT PROVIDE — these come from catalog.json instead:
 *   shop_section_id, tags, num_favorers, views, quantity, updated_timestamp
 *
 * Parsing lives in ./rss-parse.mjs so the sync script can share it without a TS loader.
 * Error handling matches lib/etsy.ts: nothing here throws, everything returns a Result.
 */

import type { Listing } from "@/types/etsy";
import { parseRssFeed as parseRssFeedRaw, listingIdFromUrl } from "./rss-parse.mjs";

export const SHOP_NAME = "designthathits";
export const RSS_URL = `https://www.etsy.com/shop/${SHOP_NAME}/rss`;

// Etsy fronts the feed with a bot filter that 403s bare fetch clients.
const USER_AGENT =
  "Mozilla/5.0 (compatible; DesignThatHitsStorefront/1.0; +https://designthathits.com)";

export type RssErrorCode = "NETWORK_ERROR" | "HTTP_ERROR" | "PARSE_ERROR";

export interface RssError {
  code: RssErrorCode;
  message: string;
  status?: number;
}

export type RssResult<T> = { ok: true; data: T } | { ok: false; error: RssError };

/**
 * Parses a raw RSS document into Listings.
 * Thin typed wrapper over the shared JS parser.
 */
export function parseRssFeed(xml: string): RssResult<Listing[]> {
  const result = parseRssFeedRaw(xml) as
    | { ok: true; data: Listing[] }
    | { ok: false; error: { code: string; message: string } };

  if (result.ok) return { ok: true, data: result.data };
  return {
    ok: false,
    error: { code: "PARSE_ERROR", message: result.error.message },
  };
}

/**
 * Fetches the 10 most recent listings from the public shop feed.
 *
 * `revalidate` is passed to the Next.js fetch cache. Default 900s (15 min) — the feed
 * only changes when the shop owner lists something new, so polling harder buys nothing.
 */
export async function fetchRssListings(revalidate = 900): Promise<RssResult<Listing[]>> {
  let res: Response;

  try {
    res = await fetch(RSS_URL, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/rss+xml, application/xml, text/xml",
      },
      next: { revalidate },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[rss] Network error fetching shop feed: ${message}`);
    return { ok: false, error: { code: "NETWORK_ERROR", message } };
  }

  if (!res.ok) {
    console.warn(`[rss] Shop feed returned HTTP ${res.status}`);
    return {
      ok: false,
      error: {
        code: "HTTP_ERROR",
        message: `Shop feed returned ${res.status}`,
        status: res.status,
      },
    };
  }

  let xml: string;
  try {
    xml = await res.text();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: { code: "PARSE_ERROR", message } };
  }

  return parseRssFeed(xml);
}

export { listingIdFromUrl };
