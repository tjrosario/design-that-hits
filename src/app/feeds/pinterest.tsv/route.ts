/**
 * Pinterest catalog feed.
 *
 * Pinterest ingests a product feed and creates a Product Pin per row, refreshing them on
 * its own schedule. Pins rank inside Pinterest search on their own merits rather than on
 * the domain's authority, which is the point: this site has no backlinks, so a feed
 * reaches an audience that organic search will not for a long while.
 *
 * TSV rather than XML. Pinterest documents the column names unambiguously, where its
 * XML tag names are only given by example, and tab-delimited sidesteps the quoting that
 * descriptions full of commas would otherwise need.
 *
 * The feed must stay reachable and fresh: Pinterest pauses a catalog it has not fetched
 * in 48 hours and drops the pins with it. See the 503 below for why a failed catalog read
 * must not serve an empty feed.
 */

import { getCatalogListings } from "@/lib/catalog";
import { getAllListings } from "@/lib/shop";
import { listingName, listingPath } from "@/lib/slug";
import { occasionLabel, primaryOccasion, productTypeLabel, themeLabel } from "@/lib/facets";
import { hasPrice } from "@/lib/price";
import { fullSizeImageUrl } from "@/lib/images";
import type { Listing } from "@/types/etsy";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designthathits.com";

/*
  A ceiling, not the effective figure: the RSS overlay's own fetch revalidate is lower and
  wins, so the origin re-renders more often than this. The catalog itself only changes on
  a redeploy, because it is a bundled import.
*/
export const revalidate = 21600;

/*
  Google's product taxonomy, which Pinterest reuses for relevance. Every string below is
  a leaf copied from Google's published taxonomy-with-ids.en-US.txt; Pinterest drops the
  field silently when it does not match exactly, so a near miss is the same as a guess.
  Types whose correct leaf is ambiguous are absent on purpose.
*/
const GOOGLE_CATEGORY: Record<string, string> = {
  "wrapping-paper": "Arts & Entertainment > Party & Celebration > Gift Giving > Gift Wrapping > Wrapping Paper",
  apparel: "Apparel & Accessories > Clothing > Shirts & Tops",
  hat: "Apparel & Accessories > Clothing Accessories > Hats",
  tote: "Apparel & Accessories > Handbags, Wallets & Cases > Handbags",
  ornament: "Home & Garden > Decor > Seasonal & Holiday Decorations > Holiday Ornaments",
  drinkware: "Home & Garden > Kitchen & Dining > Tableware > Drinkware",
  "phone-case": "Electronics > Communications > Telephony > Mobile Phone Accessories > Mobile Phone Cases",
  "wall-art": "Home & Garden > Decor > Artwork > Posters, Prints, & Visual Artwork",
  sticker:
    "Arts & Entertainment > Hobbies & Creative Arts > Arts & Crafts > Art & Crafting Materials > Embellishments & Trims > Decorative Stickers",
  stationery: "Office Supplies > General Office Supplies > Paper Products > Stationery",
};

const COLUMNS = [
  "id",
  "title",
  "description",
  "link",
  "image_link",
  "price",
  "availability",
  "condition",
  "brand",
  "product_type",
  "google_product_category",
  "custom_label_0",
  "custom_label_1",
] as const;

/*
  A tab or a newline inside a cell would shift every column after it.

  The leading double quote matters too: this file is unquoted, but an RFC-4180 parser
  treats a quote as special only at the start of a field and would then swallow the
  following tabs. Descriptions carry inch marks like 30"x36", so this is reachable.
*/
function cell(value: string): string {
  return value
    .replace(/[\t\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/^"+/, "");
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const clipped = text.slice(0, max);
  const lastSpace = clipped.lastIndexOf(" ");
  // Only break on a space if one falls late enough to keep most of the text.
  const body = lastSpace > max * 0.6 ? clipped.slice(0, lastSpace) : clipped;
  return `${body.trimEnd()}…`;
}

/*
  A spec-and-care block repeats across most listings, in the last third of the text, so
  cutting at its heading leaves the copy that is actually about this design.

  The match is unanchored, so a listing whose opening sentence happens to mention care
  instructions would otherwise be cut to nothing. Keep the cut only when enough survives.
*/
const BOILERPLATE_HEADING = /\s*(?:Product features|Care instructions)\b/i;
const MIN_KEPT_CHARS = 120;
const MIN_KEPT_FRACTION = 0.3;

function feedDescription(listing: Listing): string {
  const full = cell(listing.description ?? "");
  const trimmed = cell(full.split(BOILERPLATE_HEADING)[0]);
  const keep = trimmed.length >= MIN_KEPT_CHARS && trimmed.length >= full.length * MIN_KEPT_FRACTION;
  // Last resort is the full Etsy title, which carries the keyword phrases the short
  // display name drops.
  return truncate((keep ? trimmed : full) || cell(listing.title), 2000);
}

/* "Wrapping Paper > Christmas > Gothic & Dark", skipping whichever axis is unknown. */
function productType(listing: Listing, occasion: string | null): string {
  const parts = [
    listing.productType ? productTypeLabel(listing.productType) : null,
    occasion ? occasionLabel(occasion) : null,
    listing.themes?.[0] ? themeLabel(listing.themes[0]) : null,
  ].filter((part): part is string => Boolean(part));
  return parts.join(" > ");
}

function row(listing: Listing): string {
  const image = listing.image;
  if (!image) return "";

  /*
    Not `occasions[0]`, which is only the first matching rule in OCCASION_RULES order.
    `primaryOccasion` takes the one the title leads with, and is what the landing page
    files the product under, so the pin's category and the page agree.
  */
  const occasion = primaryOccasion(listing);

  const values: Record<(typeof COLUMNS)[number], string> = {
    id: String(listing.id),
    // The display name, not the full Etsy title. The pipe-delimited original reads as
    // keyword stuffing, which Pinterest's feed policy treats as a quality problem.
    // `withDisplayNames` has already resolved names that collide across the catalog.
    title: truncate(cell(listingName(listing)), 150),
    description: feedDescription(listing),
    // utm so Pinterest traffic is attributable. The product page canonicalises to the
    // clean URL, so the parameters cannot create a duplicate.
    link: `${SITE_URL}${listingPath(listing)}?utm_source=pinterest&utm_medium=social&utm_campaign=catalog`,
    // Pinterest wants at least 1000px on the primary image; the stored URL is often
    // Etsy's 570px thumbnail, so ask for the full-size variant.
    image_link: fullSizeImageUrl(image.url),
    price: `${listing.price.toFixed(2)} ${listing.currency}`,
    availability: "in stock",
    condition: "new",
    brand: "Design That Hits",
    product_type: productType(listing, occasion),
    google_product_category: listing.productType ? GOOGLE_CATEGORY[listing.productType] ?? "" : "",
    custom_label_0: occasion ? occasionLabel(occasion) : "",
    custom_label_1: listing.themes?.[0] ? themeLabel(listing.themes[0]) : "",
  };

  return COLUMNS.map((column) => values[column]).join("\t");
}

/*
  A short feed is worse than no feed, because Pinterest treats a product that has
  vanished from the feed as delisted and removes its pin. So the row count is checked
  against the committed catalog rather than only against zero: a data source that silently
  returns a subset, such as the Etsy API branch in `shop.ts` with its unpaginated limit of
  100, would otherwise ship a 200 that delists everything it left out.
*/
const MIN_ROW_FRACTION = 0.95;

export async function GET() {
  const listings = await getAllListings();

  /*
    A row needs a price and a photo. One listing carries a zero price and an empty
    currency; Pinterest requires the feed price to match the landing page within 5%, and
    the page shows "See price on Etsy" for it, so it has no price to match and is better
    left out than published wrong.
  */
  const sellable = listings.filter((listing) => hasPrice(listing) && listing.image);
  const rows = sellable.map(row).filter(Boolean);

  /*
    Thrown, not returned as a 503.

    Next keeps the previous good cache entry when a revalidation throws, and serves it to
    the requester; a *returned* 5xx replaces that entry and is then served from cache. A
    throw also fails `next build`, where a returned 503 would merely drop the route from
    the prerender and let a broken feed deploy. That matters because the catalog sync
    workflow's only gate is that the build succeeds.
  */
  const floor = Math.floor(getCatalogListings().length * MIN_ROW_FRACTION);
  if (rows.length < floor) {
    throw new Error(`Pinterest feed has ${rows.length} rows, below the floor of ${floor}; refusing to publish it`);
  }

  return new Response(`${[COLUMNS.join("\t"), ...rows].join("\n")}\n`, {
    headers: {
      "Content-Type": "text/tab-separated-values; charset=utf-8",
      // Not a page. Keeping it out of the index also keeps it out of the sitemap's job.
      "X-Robots-Tag": "noindex",
      "Cache-Control": "public, max-age=0, s-maxage=21600, stale-while-revalidate=86400",
    },
  });
}
