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

import { getAllListings } from "@/lib/shop";
import { listingName, listingPath } from "@/lib/slug";
import { occasionLabel, productTypeLabel, themeLabel } from "@/lib/facets";
import { hasPrice } from "@/lib/price";
import { shareImageUrl } from "@/lib/share-image";
import type { Listing } from "@/types/etsy";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designthathits.com";

// Six hours, matching the catalog sync. Pinterest wants a feed no more than 24h stale.
export const revalidate = 21600;

/*
  Google's product taxonomy, which Pinterest reuses for relevance. Only the types whose
  category is unambiguous are mapped; the field is optional, so a guess is worse than
  omitting it. Digital downloads and music are deliberately absent.
*/
const GOOGLE_CATEGORY: Record<string, string> = {
  "wrapping-paper": "Arts & Entertainment > Party & Celebration > Gift Giving > Gift Wrapping Paper",
  apparel: "Apparel & Accessories > Clothing > Shirts & Tops",
  hat: "Apparel & Accessories > Clothing Accessories > Hats",
  tote: "Apparel & Accessories > Handbags, Wallets & Cases > Handbags",
  ornament: "Home & Garden > Decor > Seasonal & Holiday Decorations > Christmas Tree Ornaments",
  drinkware: "Home & Garden > Kitchen & Dining > Tableware > Drinkware",
  "phone-case": "Electronics > Communications > Telephony > Mobile Phone Accessories > Mobile Phone Cases",
  "wall-art": "Home & Garden > Decor > Artwork > Posters, Prints & Visual Artwork",
  sticker: "Office Supplies > General Office Supplies > Seals & Stickers",
  stationery: "Office Supplies > Stationery",
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
  treats a quote as special only at the start of a field, and would then swallow the
  following tabs. 117 descriptions contain inch marks like 30"x36" and none currently
  start with one, so this only guards against a future sync.
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
  The spec-and-care block repeats on 333 of 398 listings and always sits in the last
  third of the description, so cutting at its heading leaves the copy that is actually
  about this design. Pinterest allows 10,000 characters; the cap here is about keeping
  the pin readable, not about the limit.
*/
const BOILERPLATE_HEADING = /\s*(?:Product features|Care instructions)\b/i;

function feedDescription(listing: Listing): string {
  const unique = (listing.description ?? "").split(BOILERPLATE_HEADING)[0];
  const text = cell(unique) || cell(listing.description ?? "");
  // Last resort is the full Etsy title, which carries the keyword phrases the short
  // display name drops.
  return truncate(text || cell(listing.title), 2000);
}

/*
  87 listings share 31 display names, because `listingName` is the first pipe-delimited
  block of the Etsy title and seven products are all called "Gothic Christmas Wrapping
  Paper". Seven identically titled pins read as spam, so a colliding name borrows the
  next phrase from its own title. Feed-local: the site's own titles are unchanged.
*/
function feedTitles(listings: Listing[]): Map<number, string> {
  const counts = new Map<string, number>();
  for (const listing of listings) {
    const name = cell(listingName(listing));
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  const titles = new Map<number, string>();
  for (const listing of listings) {
    const name = cell(listingName(listing));
    const qualifier = listing.title
      .split("|")
      .slice(1)
      .map((part) => cell(part))
      .find((part) => part.length > 0 && part.toLowerCase() !== name.toLowerCase());

    const unique = (counts.get(name) ?? 0) > 1 && qualifier ? `${name} - ${qualifier}` : name;
    titles.set(listing.id, truncate(unique, 150));
  }
  return titles;
}

/* "Wrapping Paper > Christmas > Gothic & Dark", skipping whichever axis is unknown. */
function productType(listing: Listing): string {
  const parts = [
    listing.productType ? productTypeLabel(listing.productType) : null,
    listing.occasions?.[0] ? occasionLabel(listing.occasions[0]) : null,
    listing.themes?.[0] ? themeLabel(listing.themes[0]) : null,
  ].filter((part): part is string => Boolean(part));
  return parts.join(" > ");
}

function row(listing: Listing, title: string): string {
  const image = listing.image;
  if (!image) return "";

  const values: Record<(typeof COLUMNS)[number], string> = {
    id: String(listing.id),
    // The display name, not the full Etsy title. The pipe-delimited original reads as
    // keyword stuffing, which Pinterest's feed policy treats as a quality problem.
    title,
    description: feedDescription(listing),
    // utm so Pinterest traffic is attributable. The product page canonicalises to the
    // clean URL, so the parameters cannot create a duplicate.
    link: `${SITE_URL}${listingPath(listing)}?utm_source=pinterest&utm_medium=social&utm_campaign=catalog`,
    // Pinterest wants at least 1000px on the primary image; the stored URL is often
    // Etsy's 570px thumbnail, so ask for the full-size variant.
    image_link: shareImageUrl(image.url),
    price: `${listing.price.toFixed(2)} ${listing.currency}`,
    availability: "in stock",
    condition: "new",
    brand: "Design That Hits",
    product_type: productType(listing),
    google_product_category: listing.productType ? GOOGLE_CATEGORY[listing.productType] ?? "" : "",
    custom_label_0: listing.occasions?.[0] ? occasionLabel(listing.occasions[0]) : "",
    custom_label_1: listing.themes?.[0] ? themeLabel(listing.themes[0]) : "",
  };

  return COLUMNS.map((column) => values[column]).join("\t");
}

export async function GET() {
  let listings: Listing[];
  try {
    listings = await getAllListings();
  } catch {
    /*
      503, never an empty feed. Pinterest treats a product missing from the feed as
      delisted and removes its pin, so serving a header-only file on a transient catalog
      failure would wipe the whole catalog off Pinterest. A 503 makes Pinterest keep the
      last good copy and retry.
    */
    return new Response("catalog unavailable\n", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "3600" },
    });
  }

  /*
    A row needs a price and a photo. One listing in the catalog carries a zero price and
    an empty currency; Pinterest requires the feed price to match the landing page within
    5%, and the page itself shows "See price on Etsy" for that listing, so it has no
    price to match and is better left out than published wrong.
  */
  const sellable = listings.filter((listing) => hasPrice(listing) && listing.image);
  const titles = feedTitles(sellable);
  const rows = sellable.map((listing) => row(listing, titles.get(listing.id) ?? "")).filter(Boolean);

  if (rows.length === 0) {
    return new Response("catalog empty\n", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "3600" },
    });
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
