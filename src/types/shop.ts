/**
 * types/shop.ts
 *
 * The shared result contract for every product data source.
 *
 * Originally these lived in lib/etsy.ts. They moved here when the Etsy API stopped
 * being the only source (Etsy denied our API application), so that lib/catalog.ts and
 * lib/rss.ts could speak the same error language without importing the Etsy client.
 */

export type ShopErrorCode =
  | "MISSING_API_KEY" // Etsy source: ETSY_API_KEY env var not set
  | "CATALOG_EMPTY" // Catalog source: no usable listings in src/data/catalog.json
  | "RATE_LIMITED" // 429 after all retries
  | "NOT_FOUND" // 404 — shop/section doesn't exist
  | "API_ERROR" // Other non-2xx from upstream
  | "NETWORK_ERROR" // fetch() threw (DNS, timeout, etc.)
  | "UNKNOWN"; // Unexpected

export interface ShopError {
  code: ShopErrorCode;
  message: string;
  /** HTTP status if available */
  status?: number;
}

export type ShopResult<T> = { ok: true; data: T } | { ok: false; error: ShopError };

export function makeShopError(
  code: ShopErrorCode,
  message: string,
  status?: number
): ShopError {
  return { code, message, status };
}

/** Query options accepted by every listings source. */
export interface ListingsQueryOptions {
  q?: string;
  sectionIds?: number[];
  /** Secondary facet ids from lib/facets.ts. Empty or absent means no constraint. */
  types?: string[];
  themes?: string[];
  priceBands?: string[];
  sortOn?: "created" | "price" | "score";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface FetchListingsResult {
  listings: import("./etsy").Listing[];
  total: number;
}
