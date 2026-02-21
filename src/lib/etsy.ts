/**
 * lib/etsy.ts
 *
 * Etsy API v3 client.
 *
 * Auth: Etsy API v3 supports keystring (API key) for public read-only access.
 * Set ETSY_API_KEY in your environment. No OAuth required for reading public shop data.
 *
 * Caching strategy:
 * - We use Next.js fetch() caching with revalidate: 1800 (30 min) for shop/sections.
 * - Listings are cached for 600s (10 min) and keyed by query params.
 * - In production on Vercel, ISR handles this automatically.
 * - Tradeoff: stale data up to revalidate period. For real-time freshness, reduce
 *   revalidate or use on-demand revalidation via webhooks (Etsy doesn't provide these,
 *   so periodic revalidation is the practical choice).
 *
 * Error handling philosophy:
 * - No function in this module throws. All return Result<T> = { ok: true, data } | { ok: false, error }.
 * - Callers decide how to degrade: show empty state, partial data, or a user-facing message.
 * - Error codes are typed so callers can distinguish e.g. config errors from transient failures.
 */

import type {
  EtsyShop,
  EtsyShopSection,
  EtsyListing,
  EtsyListingsResponse,
  EtsySectionsResponse,
  Listing,
  ShopSection,
} from "@/types/etsy";

const BASE_URL = "https://openapi.etsy.com/v3/application";
const SHOP_NAME = "designthathits";
const PAGE_SIZE = 24;

// ─── Result type ──────────────────────────────────────────────────────────────

export type EtsyErrorCode =
  | "MISSING_API_KEY"   // ETSY_API_KEY env var not set
  | "RATE_LIMITED"      // 429 after all retries
  | "NOT_FOUND"         // 404 — shop/section doesn't exist
  | "API_ERROR"         // Other non-2xx from Etsy
  | "NETWORK_ERROR"     // fetch() threw (DNS, timeout, etc.)
  | "UNKNOWN";          // Unexpected

export interface EtsyError {
  code: EtsyErrorCode;
  message: string;
  /** HTTP status if available */
  status?: number;
}

export type EtsyResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: EtsyError };

function makeError(code: EtsyErrorCode, message: string, status?: number): EtsyError {
  return { code, message, status };
}

// ─── Internal fetch with retry/backoff ───────────────────────────────────────

async function etsyFetch<T>(
  path: string,
  options: RequestInit & { next?: { revalidate?: number; tags?: string[] } } = {},
  retries = 3
): Promise<EtsyResult<T>> {
  const apiKey = process.env.ETSY_API_KEY;

  if (!apiKey) {
    // Log server-side only — never expose config issues to the client
    console.error("[etsy] ETSY_API_KEY is not set");
    return {
      ok: false,
      error: makeError("MISSING_API_KEY", "Etsy API key is not configured"),
    };
  }

  const url = `${BASE_URL}${path}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    let res: Response;

    try {
      res = await fetch(url, {
        ...options,
        headers: {
          "x-api-key": apiKey,
          "Accept": "application/json",
          ...(options.headers ?? {}),
        },
        next: options.next ?? { revalidate: 600 },
      });
    } catch (err) {
      // Network-level failure (DNS, timeout, socket reset, etc.)
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt < retries) {
        const delay = Math.min(500 * Math.pow(2, attempt), 4000);
        await sleep(delay);
        continue;
      }
      console.error(`[etsy] Network error after ${retries + 1} attempts: ${msg}`);
      return { ok: false, error: makeError("NETWORK_ERROR", `Network error: ${msg}`) };
    }

    if (res.status === 429) {
      if (attempt < retries) {
        // Respect Retry-After header if present, else exponential backoff
        const retryAfter = res.headers.get("Retry-After");
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.min(1000 * Math.pow(2, attempt), 8000);
        await sleep(delay);
        continue;
      }
      console.warn("[etsy] Rate limited after all retries");
      return { ok: false, error: makeError("RATE_LIMITED", "Etsy API rate limit exceeded. Please try again shortly.", 429) };
    }

    if (res.status === 404) {
      return { ok: false, error: makeError("NOT_FOUND", `Resource not found: ${path}`, 404) };
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "(unreadable)");
      // Retry on 5xx server errors from Etsy
      if (res.status >= 500 && attempt < retries) {
        const delay = Math.min(500 * Math.pow(2, attempt), 4000);
        await sleep(delay);
        continue;
      }
      console.error(`[etsy] API error ${res.status}: ${body}`);
      return { ok: false, error: makeError("API_ERROR", `Etsy API error (${res.status})`, res.status) };
    }

    try {
      const data = await res.json() as T;
      return { ok: true, data };
    } catch {
      return { ok: false, error: makeError("UNKNOWN", "Failed to parse Etsy API response") };
    }
  }

  // Should be unreachable but TypeScript needs this
  return { ok: false, error: makeError("UNKNOWN", "Etsy fetch failed unexpectedly") };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Shop ID ──────────────────────────────────────────────────────────────────

// Module-level cache — lives for the lifetime of the Node.js process / lambda warm instance.
// Combined with Next.js fetch() cache, this avoids redundant calls across requests.
let _shopId: number | null = null;

export async function getShopId(): Promise<EtsyResult<number>> {
  if (_shopId !== null) return { ok: true, data: _shopId };

  const result = await etsyFetch<EtsyShop>(`/shops/${SHOP_NAME}`, {
    next: { revalidate: 86400 }, // 24 hours
  });

  if (!result.ok) return result;

  _shopId = result.data.shop_id;
  return { ok: true, data: _shopId };
}

// ─── Sections ─────────────────────────────────────────────────────────────────

export async function getShopSections(): Promise<ShopSection[]> {
  const shopResult = await getShopId();

  if (!shopResult.ok) {
    console.warn(`[etsy] getShopSections: could not resolve shop ID (${shopResult.error.code}). Returning empty sections.`);
    return [];
  }

  const result = await etsyFetch<EtsySectionsResponse>(
    `/shops/${shopResult.data}/sections`,
    { next: { revalidate: 1800 } } // 30 min
  );

  if (!result.ok) {
    console.warn(`[etsy] getShopSections failed (${result.error.code}): ${result.error.message}. Returning empty sections.`);
    return [];
  }

  return result.data.results.map((s: EtsyShopSection) => ({
    id: s.shop_section_id,
    title: s.title,
    count: s.active_listing_count,
  }));
}

// ─── Listings ─────────────────────────────────────────────────────────────────

export interface ListingsQueryOptions {
  q?: string;
  sectionIds?: number[];
  sortOn?: "created" | "price" | "score";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface FetchListingsResult {
  listings: Listing[];
  total: number;
}

function mapListing(raw: EtsyListing): Listing {
  const primaryImage = raw.images?.[0] ?? null;
  return {
    id: raw.listing_id,
    title: raw.title,
    description: raw.description ?? "",
    url: raw.url,
    price: raw.price.amount / raw.price.divisor,
    currency: raw.price.currency_code,
    numFavorers: raw.num_favorers ?? 0,
    views: raw.views ?? 0,
    createdAt: raw.created_timestamp,
    updatedAt: raw.updated_timestamp,
    sectionId: raw.shop_section_id ?? null,
    tags: raw.tags ?? [],
    image: primaryImage
      ? {
          url: primaryImage.url_570xN,
          altText: primaryImage.alt_text ?? raw.title,
        }
      : null,
  };
}

/**
 * Fetches active listings for the shop.
 *
 * Returns { ok: false } on any failure — callers should show an empty/error state
 * rather than crashing. The error code helps distinguish transient vs config issues.
 */
export async function getListings(
  opts: ListingsQueryOptions = {}
): Promise<EtsyResult<FetchListingsResult>> {
  const shopResult = await getShopId();
  if (!shopResult.ok) return shopResult;

  const limit = opts.limit ?? PAGE_SIZE;
  const page = opts.page ?? 1;
  const offset = (page - 1) * limit;

  const params = new URLSearchParams({
    limit: String(Math.min(limit, 100)),
    offset: String(offset),
    includes: "Images",
  });

  if (opts.sortOn)   params.set("sort_on",    opts.sortOn);
  if (opts.sortOrder) params.set("sort_order", opts.sortOrder);
  if (opts.q)         params.set("keywords",   opts.q);

  const singleSection =
    opts.sectionIds && opts.sectionIds.length === 1 ? opts.sectionIds[0] : null;
  if (singleSection) params.set("shop_section_id", String(singleSection));

  const result = await etsyFetch<EtsyListingsResponse>(
    `/shops/${shopResult.data}/listings/active?${params.toString()}`,
    { next: { revalidate: 600 } }
  );

  if (!result.ok) return result;

  let listings = result.data.results.map(mapListing);

  // Multi-section filter (Etsy only supports one section_id param at a time)
  if (opts.sectionIds && opts.sectionIds.length > 1) {
    const set = new Set(opts.sectionIds);
    listings = listings.filter((l) => l.sectionId !== null && set.has(l.sectionId));
  }

  return {
    ok: true,
    data: { listings, total: result.data.count },
  };
}

/**
 * Fetches a larger batch of listings for client-side trending/best-seller ranking.
 * Degrades to an empty array on any failure so the UI shows an empty state.
 */
export async function getListingsForRanking(
  sectionIds?: number[]
): Promise<Listing[]> {
  const shopResult = await getShopId();
  if (!shopResult.ok) {
    console.warn(`[etsy] getListingsForRanking: shop ID unavailable (${shopResult.error.code})`);
    return [];
  }

  const params = new URLSearchParams({
    limit: "100",
    offset: "0",
    includes: "Images",
    sort_on: "created",
    sort_order: "desc",
  });

  const result = await etsyFetch<EtsyListingsResponse>(
    `/shops/${shopResult.data}/listings/active?${params.toString()}`,
    { next: { revalidate: 600 } }
  );

  if (!result.ok) {
    console.warn(`[etsy] getListingsForRanking failed (${result.error.code}): ${result.error.message}`);
    return [];
  }

  let listings = result.data.results.map(mapListing);

  if (sectionIds && sectionIds.length > 0) {
    const set = new Set(sectionIds);
    listings = listings.filter((l) => l.sectionId !== null && set.has(l.sectionId));
  }

  return listings;
}
