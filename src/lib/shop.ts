/**
 * lib/shop.ts
 *
 * The single entry point every page and route handler uses to get products.
 * It picks a data source and hides the choice from callers.
 *
 * BACKGROUND:
 * The storefront was built against Etsy API v3. Etsy denied the API application, so
 * there is no key to authenticate with. This module keeps that from being a rewrite:
 * the app-level `Listing` / `ShopSection` contract is unchanged, and only the source
 * behind it swapped.
 *
 * SOURCES
 *   catalog (default) — src/data/catalog.json, the complete hand-maintainable catalog,
 *                       populated by `npm run sync:catalog`. See lib/catalog.ts.
 *   rss               — the public Etsy shop feed, layered over the catalog so listings
 *                       published since the last sync still show up without a redeploy.
 *                       Only ever the 10 newest items. See lib/rss.ts.
 *   etsy              — the original API v3 client, dormant unless ETSY_API_KEY is set.
 *                       If Etsy ever approves the application, set the key and this
 *                       module switches back with no other code change.
 *
 * CONFIGURATION
 *   SHOP_DATA_SOURCE  "auto" (default) | "catalog" | "etsy"
 *                     auto = etsy when ETSY_API_KEY is present, catalog otherwise.
 *   SHOP_DISABLE_RSS  set to "1" to skip the live RSS overlay (useful offline/in CI).
 */

import type { FacetGroups, Listing, ShopSection } from "@/types/etsy";
import type { FetchListingsResult, ListingsQueryOptions, ShopResult } from "@/types/shop";
import * as catalogSource from "./catalog";
import * as etsySource from "./etsy";
import { fetchRssListings } from "./rss";

export type { ShopErrorCode, ShopError, ShopResult, ListingsQueryOptions, FetchListingsResult } from "@/types/shop";

export type ShopDataSource = "catalog" | "etsy";

export function resolveDataSource(): ShopDataSource {
  const configured = process.env.SHOP_DATA_SOURCE?.trim().toLowerCase();

  if (configured === "etsy") return "etsy";
  if (configured === "catalog") return "catalog";

  // auto / unset: the Etsy client is only usable with a key, so fall back to the catalog.
  return process.env.ETSY_API_KEY ? "etsy" : "catalog";
}

function rssEnabled(): boolean {
  return process.env.SHOP_DISABLE_RSS !== "1";
}

// ─── RSS overlay ──────────────────────────────────────────────────────────────

/**
 * Merges the live RSS feed over the catalog.
 *
 * Precedence is deliberate and asymmetric:
 *   - Volatile fields (title, price, image, description) come from RSS when present,
 *     because the feed reflects what Etsy is showing buyers right now.
 *   - Curated fields (sectionId, tags, favourites, views) come from the catalog,
 *     because the feed simply does not carry them and a blind overwrite would erase
 *     the category filters and ranking inputs.
 *   - Listings in the feed but not the catalog are appended: those are new products
 *     published since the last `sync:catalog` run, and showing them beats hiding them.
 */
export function mergeRssOverCatalog(catalogListings: Listing[], rssListings: Listing[]): Listing[] {
  if (rssListings.length === 0) return catalogListings;

  const byId = new Map(catalogListings.map((listing) => [listing.id, listing]));
  const merged: Listing[] = [];

  for (const fresh of rssListings) {
    const existing = byId.get(fresh.id);

    if (!existing) {
      merged.push(fresh);
      continue;
    }

    byId.set(fresh.id, {
      ...existing,
      title: fresh.title || existing.title,
      description: fresh.description || existing.description,
      url: fresh.url || existing.url,
      price: fresh.price > 0 ? fresh.price : existing.price,
      currency: fresh.currency || existing.currency,
      image: fresh.image ?? existing.image,
      updatedAt: Math.max(fresh.updatedAt, existing.updatedAt),
    });
  }

  // Array.from rather than spread — tsconfig targets ES5 iteration semantics.
  return [...Array.from(byId.values()), ...merged];
}

/**
 * The catalog with the RSS overlay applied. Falls back to the bare catalog whenever
 * the feed is unreachable — a storefront that renders slightly stale products beats
 * one that renders an error.
 */
async function getMergedListings(): Promise<Listing[]> {
  const catalogListings = catalogSource.getCatalogListings();

  if (!rssEnabled()) return catalogListings;

  const rss = await fetchRssListings();
  if (!rss.ok) {
    console.warn(`[shop] RSS overlay unavailable (${rss.error.code}); serving catalog only.`);
    return catalogListings;
  }

  return mergeRssOverCatalog(catalogListings, rss.data);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getShopSections(): Promise<ShopSection[]> {
  if (resolveDataSource() === "etsy") return etsySource.getShopSections();
  return catalogSource.getShopSections();
}

export async function getListings(
  opts: ListingsQueryOptions = {}
): Promise<ShopResult<FetchListingsResult>> {
  if (resolveDataSource() === "etsy") return etsySource.getListings(opts);
  return catalogSource.getListings(opts, await getMergedListings());
}

export async function getListingsForRanking(
  opts: Pick<ListingsQueryOptions, "q" | "sectionIds" | "types" | "themes" | "priceBands"> = {}
): Promise<Listing[]> {
  // The Etsy API can only narrow by section; the richer facets are a local-catalog
  // capability, so that path just ignores them.
  if (resolveDataSource() === "etsy") {
    return etsySource.getListingsForRanking(opts.sectionIds);
  }
  return catalogSource.getListingsForRanking(opts, await getMergedListings());
}

/**
 * A random selection of listings that have images.
 *
 * The randomness lives here rather than in a component because React 19 treats render as
 * pure and rejects `Math.random()` inside it (react-hooks/purity). Data loading is the
 * right place for a non-deterministic choice: the caller receives a plain array and its
 * render stays a pure function of that input.
 *
 * Uses Fisher-Yates rather than `sort(() => Math.random() - 0.5)`, which is not a uniform
 * shuffle — comparator-based shuffles bias heavily toward the original order.
 */
export async function getRandomListings(count: number): Promise<Listing[]> {
  const result = await getListings({ limit: 60 });
  const pool = (result.ok ? result.data.listings : []).filter((l) => l.image);

  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count);
}

/** Secondary filter groups with counts, for the filter UI. */
export async function getFacetGroups(): Promise<FacetGroups> {
  if (resolveDataSource() === "etsy") {
    // No catalog to derive facets from, so the UI renders sections only.
    return { productTypes: [], themes: [], priceBands: [] };
  }
  return catalogSource.getFacetGroups(await getMergedListings());
}
