/**
 * lib/catalog.ts
 *
 * Local product catalog — the storefront's primary data source.
 *
 * WHY THIS EXISTS:
 * Etsy denied our API v3 application. The public RSS feed (lib/rss.ts) is the only live
 * Etsy source available without a key, and it hands back just the 10 most recent
 * listings. So the full catalog is kept in src/data/catalog.json, populated by
 * `npm run sync:catalog` (RSS drip-feed) or a one-off Etsy CSV export backfill.
 *
 * WHY A BUNDLED JSON IMPORT RATHER THAN fs.readFile:
 * The file is imported so it is bundled at build time. That keeps this module usable
 * from server components and any runtime without filesystem access, and makes lookups
 * free at request time. The tradeoff is that editing catalog.json requires a rebuild —
 * acceptable because the catalog changes when the shop owner publishes a product, not
 * per request, and lib/shop.ts layers the live RSS feed on top for new arrivals.
 *
 * This module implements the same surface as lib/etsy.ts, so callers can swap between
 * them. Nothing here throws; failures come back as ShopResult errors.
 */

import catalogData from "@/data/catalog.json";
import type { Listing, ShopSection } from "@/types/etsy";
import type { CatalogFile, CatalogListing } from "@/types/catalog";
import type { FetchListingsResult, ListingsQueryOptions, ShopResult } from "@/types/shop";
import { makeShopError } from "@/types/shop";
import { listingIdFromUrl } from "./rss-parse.mjs";
import {
  computePriceBands,
  deriveProductType,
  deriveThemes,
  matchesPriceBand,
  productTypeLabel,
  themeLabel,
} from "./facets";
import type { FacetGroups } from "@/types/etsy";

const PAGE_SIZE = 24;

const catalog = catalogData as CatalogFile;

const SHOP_NAME = catalog.shop?.etsyShopName ?? "designthathits";

/**
 * Synthetic IDs start above this. Real Etsy listing IDs are ~10 digits (4.4e9), and
 * Number.MAX_SAFE_INTEGER is 9e15, so 1e15 leaves both ranges far apart: a synthetic ID
 * can never be mistaken for, or collide with, a real one.
 */
const SYNTHETIC_ID_BASE = 1e15;

// ─── Normalisation ────────────────────────────────────────────────────────────

/** FNV-1a. Small, fast, and stable across runs — the same title always maps to the
 *  same ID, so a listing keeps its identity (and React key) between syncs. */
function hashTitle(title: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < title.length; i++) {
    hash ^= title.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * Etsy's CSV export has no listing URLs, so products imported from it cannot link
 * directly. A shop-scoped search for the exact title is the closest thing that needs no
 * curation: it lands the buyer inside this shop with the product filtered.
 * sync-catalog replaces this with the real listing URL whenever the RSS feed reveals it.
 */
function shopSearchUrl(title: string): string {
  return `https://www.etsy.com/shop/${SHOP_NAME}?search_query=${encodeURIComponent(title)}`;
}

/**
 * Converts a catalog entry into the app's Listing shape.
 * Returns null only for entries with no title, which cannot be displayed at all.
 */
function normaliseListing(entry: CatalogListing): Listing | null {
  const title = entry.title?.trim();
  if (!title) return null;

  const rawUrl = entry.url?.trim();
  const url = rawUrl || shopSearchUrl(title);

  const id =
    (entry.id && entry.id > 0 ? entry.id : null) ??
    (rawUrl ? listingIdFromUrl(rawUrl) : null) ??
    SYNTHETIC_ID_BASE + hashTitle(title);

  const createdAt = entry.createdAt ?? Math.floor(Date.now() / 1000);

  const listing: Listing = {
    id,
    title,
    description: entry.description ?? "",
    url,
    price: Number.isFinite(entry.price) ? (entry.price as number) : 0,
    currency: entry.currency ?? "USD",
    // rank.ts reads numFavorers/views; the catalog names them favorites/views because
    // that is what the seller sees in Etsy's own UI.
    numFavorers: entry.favorites ?? 0,
    views: entry.views ?? 0,
    createdAt,
    updatedAt: entry.updatedAt ?? createdAt,
    sectionId: entry.sectionId ?? null,
    tags: entry.tags ?? [],
    image: entry.image?.url
      ? { url: entry.image.url, altText: entry.image.altText ?? title }
      : null,
  };

  // Facets are derived from the finished Listing so the rules see the same title and
  // tags the shopper searches against.
  listing.productType = deriveProductType(listing);
  listing.themes = deriveThemes(listing);

  return listing;
}

// Normalised once per process. The catalog is static within a build, so repeating this
// per request would be pure waste.
let _listings: Listing[] | null = null;

function allListings(): Listing[] {
  if (_listings) return _listings;

  const entries = catalog.listings ?? [];
  const normalised: Listing[] = [];
  let skipped = 0;

  for (const entry of entries) {
    const listing = normaliseListing(entry);
    if (listing) normalised.push(listing);
    else skipped++;
  }

  if (skipped > 0) {
    console.warn(
      `[catalog] Skipped ${skipped} catalog entr${skipped === 1 ? "y" : "ies"} with no title. ` +
        `Re-run \`npm run sync:catalog\` to rebuild src/data/catalog.json.`
    );
  }

  _listings = normalised;
  return _listings;
}

/**
 * True when a listing's ID came from Etsy rather than being synthesised from its title.
 *
 * Structured data uses this to decide whether it can publish an identifier: a synthetic
 * ID is an internal hash that means nothing outside this codebase, and quoting one as a
 * product `sku` would be inventing an identifier rather than reporting one.
 */
export function hasRealEtsyId(listing: Listing): boolean {
  return listing.id > 0 && listing.id < SYNTHETIC_ID_BASE;
}

/** Exposed for lib/shop.ts, which merges live RSS results over the catalog. */
export function getCatalogListings(): Listing[] {
  return allListings();
}

// ─── Sections ─────────────────────────────────────────────────────────────────

export function getShopSectionsSync(): ShopSection[] {
  const listings = allListings();

  // Counts are recomputed here rather than trusted from the file, so a hand-edited
  // catalog cannot show "12 designs" on a category holding three.
  const counts = new Map<number, number>();
  for (const listing of listings) {
    if (listing.sectionId === null) continue;
    counts.set(listing.sectionId, (counts.get(listing.sectionId) ?? 0) + 1);
  }

  return (catalog.sections ?? []).map((section) => ({
    id: section.id,
    title: section.title,
    count: counts.get(section.id) ?? 0,
  }));
}

export async function getShopSections(): Promise<ShopSection[]> {
  return getShopSectionsSync();
}

// ─── Query engine ─────────────────────────────────────────────────────────────

/**
 * Multi-term AND search over title, description and tags.
 *
 * Note this is a genuine improvement over the Etsy-backed path it replaces: because
 * the whole catalog is in memory we filter *before* paginating, so `total` and the
 * page contents are consistent. The Etsy version could only filter the current page
 * when more than one section was selected.
 */
function matchesQuery(listing: Listing, terms: string[]): boolean {
  if (terms.length === 0) return true;

  const haystack = `${listing.title}\n${listing.description}\n${listing.tags.join("\n")}`.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function tokenise(q: string): string[] {
  return q
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

/**
 * Applies search plus every filter group.
 *
 * Semantics: AND across groups, OR within a group. Ticking "Cats" and "Dogs" widens the
 * results; ticking "Cats" and then a price band narrows them. That is what shoppers
 * expect from faceted navigation, and it means an empty group is "no constraint" rather
 * than "match nothing".
 */
export function filterListings(
  listings: Listing[],
  opts: Pick<
    ListingsQueryOptions,
    "q" | "sectionIds" | "types" | "themes" | "priceBands"
  >,
  bands = computePriceBands(listings)
): Listing[] {
  const terms = tokenise(opts.q ?? "");
  const sections = opts.sectionIds?.length ? new Set(opts.sectionIds) : null;
  const types = opts.types?.length ? new Set(opts.types) : null;
  const themes = opts.themes?.length ? new Set(opts.themes) : null;

  // Resolve band ids once rather than per listing.
  const selectedBands = opts.priceBands?.length
    ? bands.filter((band) => opts.priceBands!.includes(band.id))
    : null;

  return listings.filter((listing) => {
    if (sections && (listing.sectionId === null || !sections.has(listing.sectionId))) {
      return false;
    }
    if (types && !(listing.productType && types.has(listing.productType))) {
      return false;
    }
    if (themes && !(listing.themes ?? []).some((theme) => themes.has(theme))) {
      return false;
    }
    if (selectedBands && !selectedBands.some((band) => matchesPriceBand(listing, band))) {
      return false;
    }
    return matchesQuery(listing, terms);
  });
}

/**
 * Builds the secondary filter groups with counts.
 *
 * Counts are computed over the whole catalog rather than the current result set, so an
 * option never silently disappears mid-browse and the numbers stay stable as a shopper
 * ticks boxes. Options with a zero count are omitted entirely.
 */
export function getFacetGroups(listings: Listing[] = allListings()): FacetGroups {
  const typeCounts = new Map<string, number>();
  const themeCounts = new Map<string, number>();

  for (const listing of listings) {
    if (listing.productType) {
      typeCounts.set(listing.productType, (typeCounts.get(listing.productType) ?? 0) + 1);
    }
    for (const theme of listing.themes ?? []) {
      themeCounts.set(theme, (themeCounts.get(theme) ?? 0) + 1);
    }
  }

  const bands = computePriceBands(listings);
  const bandCounts = bands.map((band) => ({
    id: band.id,
    label: band.label,
    count: listings.filter((listing) => matchesPriceBand(listing, band)).length,
  }));

  const byCountDesc = (a: { count: number }, b: { count: number }) => b.count - a.count;

  return {
    productTypes: [...typeCounts.entries()]
      .map(([id, count]) => ({ id, label: productTypeLabel(id), count }))
      .filter((o) => o.count > 0)
      .sort(byCountDesc),
    themes: [...themeCounts.entries()]
      .map(([id, count]) => ({ id, label: themeLabel(id), count }))
      .filter((o) => o.count > 0)
      .sort(byCountDesc),
    // Price bands stay in ascending price order; sorting by count would scramble them.
    priceBands: bandCounts.filter((o) => o.count > 0),
  };
}

function sortListings(
  listings: Listing[],
  sortOn: ListingsQueryOptions["sortOn"],
  sortOrder: ListingsQueryOptions["sortOrder"]
): Listing[] {
  const direction = sortOrder === "asc" ? 1 : -1;
  const sorted = [...listings];

  if (sortOn === "price") {
    // Ties fall back to newest so the order is stable rather than arbitrary.
    sorted.sort((a, b) => (a.price - b.price) * direction || b.createdAt - a.createdAt);
  } else {
    sorted.sort((a, b) => (a.createdAt - b.createdAt) * direction || a.id - b.id);
  }

  return sorted;
}

/**
 * Fetches listings from the local catalog.
 *
 * Mirrors getListings() in lib/etsy.ts, including the ShopResult return, so callers
 * do not care which source they are talking to.
 */
export async function getListings(
  opts: ListingsQueryOptions = {},
  source?: Listing[]
): Promise<ShopResult<FetchListingsResult>> {
  const listings = source ?? allListings();

  if (listings.length === 0) {
    return {
      ok: false,
      error: makeShopError(
        "CATALOG_EMPTY",
        "No listings in src/data/catalog.json. Run `npm run sync:catalog`."
      ),
    };
  }

  const limit = Math.max(1, Math.min(opts.limit ?? PAGE_SIZE, 100));
  const page = Math.max(1, opts.page ?? 1);

  const filtered = filterListings(listings, opts);
  const sorted = sortListings(filtered, opts.sortOn ?? "created", opts.sortOrder ?? "desc");

  const start = (page - 1) * limit;

  return {
    ok: true,
    data: { listings: sorted.slice(start, start + limit), total: sorted.length },
  };
}

/**
 * Returns the full filtered set for client-side trending/best-seller ranking.
 * Degrades to an empty array so the UI shows an empty state rather than crashing.
 */
export async function getListingsForRanking(
  opts: Pick<ListingsQueryOptions, "q" | "sectionIds" | "types" | "themes" | "priceBands"> = {},
  source?: Listing[]
): Promise<Listing[]> {
  const listings = source ?? allListings();
  return filterListings(listings, opts);
}

export { PAGE_SIZE };
