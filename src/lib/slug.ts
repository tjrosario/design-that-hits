/**
 * lib/slug.ts
 *
 * URL slugs for product pages.
 *
 * The slug carries the listing ID as a suffix rather than relying on the title alone.
 * Two reasons, both learned from this catalogue:
 *
 *   - Titles are not unique. Four pairs of listings share a title exactly (variants of
 *     the same design published separately), so a title-only slug would collide and one
 *     product would be unreachable.
 *   - Titles change. Etsy titles get rewritten for SEO all the time; keying on the ID
 *     means an edited title changes the slug's words but the page still resolves, and
 *     lookup never depends on text matching.
 */

import type { Listing } from "@/types/etsy";

/** Longest readable portion of the title to keep in the URL. */
const MAX_TITLE_CHARS = 70;

/**
 * The readable product name.
 *
 * Etsy titles are pipe-separated keyword blocks written for Etsy's own search — the
 * first block is the actual product name and the rest are keyword variants. The raw
 * title runs 150+ characters, which is unusable as an <h1>, a <title> (Google truncates
 * around 60) or a breadcrumb label. The full title still goes to Etsy and stays in the
 * page copy, so nothing is lost for keyword coverage.
 */
export function listingName(listing: Listing): string {
  const first = listing.title.split("|")[0].trim();
  return first || listing.title.trim();
}

function slugifyTitle(title: string): string {
  return (
    title
      .toLowerCase()
      // Same first-block rule as listingName above.
      .split("|")[0]
      .normalize("NFKD")
      // Strip diacritics so "Quinceañera" becomes "quinceanera" rather than dropping a letter.
      .replace(/[̀-ͯ]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, MAX_TITLE_CHARS)
      .replace(/-+$/g, "")
  );
}

export function listingSlug(listing: Listing): string {
  const words = slugifyTitle(listing.title);
  return words ? `${words}-${listing.id}` : String(listing.id);
}

/**
 * Pulls the listing ID back out of a slug.
 *
 * Reads the trailing numeric segment, so any amount of title drift in the leading words
 * still resolves. Returns null when the slug carries no ID, which the page turns into a
 * 404 rather than guessing.
 */
export function idFromSlug(slug: string): number | null {
  const match = /(\d+)$/.exec(slug);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function listingPath(listing: Listing): string {
  return `/designs/${listingSlug(listing)}`;
}
