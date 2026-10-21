/**
 * Shared Pinterest text handling and the save-link builder.
 *
 * The catalog feed and the on-page save button describe the same products to the same
 * surface, so they share one description so a saved pin and a feed pin read alike.
 */

import { listingName, listingPath } from "@/lib/slug";
import { fullSizeImageUrl } from "@/lib/images";
import type { Listing } from "@/types/etsy";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designthathits.com";

/**
 * Flattens a value to a single line with no leading quote.
 *
 * A tab or newline inside a TSV cell would shift every column after it. The leading
 * double quote matters too: the feed is unquoted, but an RFC-4180 parser treats a quote
 * as special only at the start of a field and would then swallow the following tabs.
 * Descriptions carry inch marks like 30"x36", so this is reachable.
 */
export function cell(value: string): string {
  return value
    .replace(/[\t\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/^"+/, "");
}

export function truncate(text: string, max: number): string {
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

/** Pinterest's own ceiling on a feed row's description. */
export const FEED_DESCRIPTION_MAX = 2000;

/**
 * Our cap on a pin description, not Pinterest's.
 *
 * The compose endpoint accepts more: a 597-character description came back echoed in
 * full. 500 is the figure the Pinterest tooling ecosystem agrees on and the grid shows
 * only the opening 50-60 characters anyway, so this keeps the prefill inside what the
 * save form is known to handle rather than betting on an undocumented ceiling.
 */
export const PIN_DESCRIPTION_MAX = 500;

/** The seller's own copy, stripped of the boilerplate block and capped. */
export function pinterestDescription(listing: Listing, max: number): string {
  const full = cell(listing.description ?? "");
  const trimmed = cell(full.split(BOILERPLATE_HEADING)[0]);
  const keep = trimmed.length >= MIN_KEPT_CHARS && trimmed.length >= full.length * MIN_KEPT_FRACTION;
  // Last resort is the full Etsy title, which carries the keyword phrases the short
  // display name drops.
  return truncate((keep ? trimmed : full) || cell(listing.title), max);
}

/**
 * The text a saved pin carries.
 *
 * Led by the product name because Pinterest indexes the description for search and the
 * name is already the keyword phrase. The body is the seller's own copy, so nothing here
 * is written about a design this file has not read.
 */
export function pinDescription(listing: Listing): string {
  const name = cell(listingName(listing));
  const body = pinterestDescription(listing, PIN_DESCRIPTION_MAX);
  if (!body || body.toLowerCase().startsWith(name.toLowerCase())) {
    return truncate(body || name, PIN_DESCRIPTION_MAX);
  }
  return truncate(`${name}. ${body}`, PIN_DESCRIPTION_MAX);
}

/** Tags a destination so Pinterest traffic is attributable in analytics. */
export function pinterestLink(listing: Listing, campaign: string): string {
  return `${SITE_URL}${listingPath(listing)}?utm_source=pinterest&utm_medium=social&utm_campaign=${campaign}`;
}

/**
 * The Pinterest compose URL for a listing, or null when it has no photo to pin.
 *
 * A plain link, so the button costs no third-party script and works before hydration.
 * `media` asks for the full-size Etsy variant because Pinterest wants at least 1000px
 * and the stored URL is often a 570px thumbnail.
 */
export function pinItUrl(listing: Listing): string | null {
  if (!listing.image) return null;

  const params = new URLSearchParams({
    url: pinterestLink(listing, "save-button"),
    media: fullSizeImageUrl(listing.image.url),
    description: pinDescription(listing),
  });

  return `https://www.pinterest.com/pin/create/button/?${params.toString()}`;
}
