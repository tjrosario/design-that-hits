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
import type { FetchListingsResult, ListingsQueryOptions, ShopErrorCode, ShopResult } from "@/types/shop";
import { isPermanentShopError } from "@/types/shop";
import * as catalogSource from "./catalog";
import * as etsySource from "./etsy";
import { fetchRssListings } from "./rss";

export type { ShopErrorCode, ShopError, ShopResult, ListingsQueryOptions, FetchListingsResult } from "@/types/shop";

/** Re-exported so pages import listing helpers from one module rather than two. */
export { hasRealEtsyId } from "./catalog";

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

// ─── Etsy circuit breaker ─────────────────────────────────────────────────────

/**
 * The Etsy API is treated as an enhancement, never a single point of failure.
 *
 * This exists because of a real outage: a stale ETSY_API_KEY left over in the deploy
 * environment made `auto` resolve to the Etsy source, every request failed against the
 * denied key, and /api/listings returned 502 — even though a complete local catalog was
 * sitting right there. Falling back is strictly better than erroring when we hold the
 * data ourselves.
 *
 * The cooldown matters as much as the fallback. etsyFetch retries with backoff, so
 * without it every single request would burn several seconds discovering the same
 * failure before serving the catalog. One failure parks the source for five minutes,
 * long enough to stay fast and short enough to recover from a transient outage on its
 * own.
 */
const ETSY_COOLDOWN_MS = 5 * 60_000;
let etsyDownUntil = 0;
/** Set for errors that retrying cannot fix, so the source is never attempted again. */
let etsyDisabled = false;

function etsyUsable(): boolean {
  if (etsyDisabled) return false;
  return resolveDataSource() === "etsy" && Date.now() >= etsyDownUntil;
}

function markEtsyDown(code: ShopErrorCode, message: string): void {
  // A rejected or missing key will still be rejected in five minutes. Disabling outright
  // stops the retry timer from re-running the same doomed request, and — more visibly —
  // stops it logging once per request and once per page of a static build. lib/etsy.ts
  // has already reported the underlying cause with remediation steps, so nothing more is
  // printed here.
  if (isPermanentShopError(code)) {
    etsyDisabled = true;
    return;
  }

  const firstFailure = Date.now() >= etsyDownUntil;
  etsyDownUntil = Date.now() + ETSY_COOLDOWN_MS;
  if (firstFailure) {
    console.warn(
      `[shop] Etsy API unavailable (${code}: ${message}). Serving the local catalog and ` +
        `retrying in ${ETSY_COOLDOWN_MS / 60_000} minutes.`
    );
  }
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

/*
  In-process memo for the merged catalogue.

  Static generation renders 366 product pages in the same worker, and each one asks for
  the full listing set (once to resolve itself, once to pick related products). Without
  this, that is ~730 RSS round-trips in a single build — slow, and rude to Etsy. The TTL
  keeps the overlay reasonably fresh for long-lived server processes.

  The promise itself is cached, not the resolved value, so concurrent callers share one
  in-flight fetch rather than each starting their own.
*/
const MERGED_TTL_MS = 5 * 60_000;
let mergedCache: { at: number; value: Promise<Listing[]> } | null = null;

/**
 * The catalog with the RSS overlay applied. Falls back to the bare catalog whenever
 * the feed is unreachable — a storefront that renders slightly stale products beats
 * one that renders an error.
 */
function getMergedListings(): Promise<Listing[]> {
  const now = Date.now();
  if (mergedCache && now - mergedCache.at < MERGED_TTL_MS) return mergedCache.value;

  const value = buildMergedListings().catch((err) => {
    // Never cache a rejection: the next caller should be free to retry.
    mergedCache = null;
    throw err;
  });
  mergedCache = { at: now, value };
  return value;
}

async function buildMergedListings(): Promise<Listing[]> {
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
  if (etsyUsable()) {
    const sections = await etsySource.getShopSections();
    // This one returns [] rather than a Result on failure, so an empty list is the only
    // available signal. Falling through costs nothing: if the shop genuinely has no
    // sections, the catalog returns an empty list too.
    if (sections.length > 0) return sections;
  }
  return catalogSource.getShopSections();
}

export async function getListings(
  opts: ListingsQueryOptions = {}
): Promise<ShopResult<FetchListingsResult>> {
  if (etsyUsable()) {
    const result = await etsySource.getListings(opts);
    if (result.ok) return result;
    markEtsyDown(result.error.code, result.error.message);
  }
  return catalogSource.getListings(opts, await getMergedListings());
}

export async function getListingsForRanking(
  opts: Pick<ListingsQueryOptions, "q" | "sectionIds" | "types" | "themes" | "priceBands"> = {}
): Promise<Listing[]> {
  // The Etsy API can only narrow by section; the richer facets are a local-catalog
  // capability, so that path just ignores them.
  if (etsyUsable()) {
    const listings = await etsySource.getListingsForRanking(opts.sectionIds);
    if (listings.length > 0) return listings;
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
/** Every listing, unpaginated. Backs the sitemap and product page generation. */
export async function getAllListings(): Promise<Listing[]> {
  return getListingsForRanking({});
}

/**
 * A single listing by its Etsy ID, or null.
 *
 * Product pages resolve by ID rather than by matching the title, because titles are
 * neither unique in this catalogue nor stable over time. See lib/slug.ts.
 */
export async function getListingById(id: number): Promise<Listing | null> {
  const all = await getAllListings();
  return all.find((l) => l.id === id) ?? null;
}

/**
 * Other products a visitor might want next, preferring the same product type.
 * Falls back to filling from the wider catalogue so the section is never half empty.
 */
export async function getRelatedListings(listing: Listing, count = 4): Promise<Listing[]> {
  const all = (await getAllListings()).filter((l) => l.id !== listing.id && l.image);

  const sameType = all.filter((l) => l.productType && l.productType === listing.productType);
  const themes = new Set(listing.themes ?? []);
  const sameTheme = sameType.filter((l) => (l.themes ?? []).some((t) => themes.has(t)));

  // Closest first: same type and theme, then same type, then anything.
  const ordered = [...sameTheme, ...sameType, ...all];
  const seen = new Set<number>();
  const out: Listing[] = [];
  for (const l of ordered) {
    if (seen.has(l.id)) continue;
    seen.add(l.id);
    out.push(l);
    if (out.length === count) break;
  }
  return out;
}

/** One tile's requirement: any listing whose derived product type is in this list. */
export interface ListingPick {
  /** Product type ids from lib/facets.ts, tried in order of preference. */
  types?: string[];
}

/**
 * Picks one listing per spec, matched to that spec's product types.
 *
 * The About tiles need this because they are labelled by category: a tile that says
 * "Wrapping Paper" showing a t-shirt is simply wrong. Picking from one undifferentiated
 * random pool, as before, made that the common case rather than the exception.
 *
 * Two properties matter beyond the matching itself:
 *   - No repeats. A listing already used by an earlier spec is excluded, so four tiles
 *     never show the same photo.
 *   - Never empty. If a type has no products (or none left after dedupe), the spec falls
 *     back to any unused listing. A tile with a slightly off photo beats a blank one.
 */
export async function getRandomListingsMatching(specs: ListingPick[]): Promise<(Listing | null)[]> {
  // getListingsForRanking, not getListings: the latter is paginated and clamps limit to
  // 100, so it would only ever see the 100 newest products. Smaller categories such as
  // stationery and drinkware are older than that, so every tile but Wrapping Paper
  // silently fell back to an unrelated product.
  const pool = (await getListingsForRanking({})).filter((l) => l.image);

  const used = new Set<number>();
  const pickFrom = (candidates: Listing[]): Listing | null => {
    const available = candidates.filter((l) => !used.has(l.id));
    if (available.length === 0) return null;
    const chosen = available[Math.floor(Math.random() * available.length)];
    used.add(chosen.id);
    return chosen;
  };

  return specs.map((spec) => {
    const matching = spec.types?.length
      ? pool.filter((l) => l.productType && spec.types!.includes(l.productType))
      : pool;
    return pickFrom(matching) ?? pickFrom(pool);
  });
}

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
  // Gated on etsyUsable rather than resolveDataSource so it stays consistent with
  // getListings: the moment Etsy is marked down and catalog listings are being served,
  // the facets that filter them appear too. Facets are a catalog capability — the Etsy
  // API cannot narrow by them — so offering them alongside Etsy results would render
  // controls that silently do nothing.
  if (etsyUsable()) {
    return { productTypes: [], themes: [], priceBands: [] };
  }
  return catalogSource.getFacetGroups(await getMergedListings());
}
