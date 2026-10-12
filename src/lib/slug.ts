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
  if (listing.displayName) return listing.displayName;
  const first = listing.title.split("|")[0].trim();
  return first || listing.title.trim();
}

/**
 * Resolves short names that collide, across the whole catalog.
 *
 * The first title block is not unique: dozens of listings are called "Gothic Christmas
 * Wrapping Paper", so that many product pages shared an `<h1>`, a `<title>` and their
 * image alt text. A colliding name takes the next distinct phrase from its own title,
 * which is where the design's actual subject lives.
 *
 * Slugs are untouched. `slugifyTitle` splits the raw title itself and `idFromSlug`
 * resolves on the trailing id, so no URL moves.
 */
export function withDisplayNames(listings: Listing[]): Listing[] {
  const counts = new Map<string, number>();
  for (const listing of listings) {
    const name = shortName(listing);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return listings.map((listing) => {
    const name = shortName(listing);
    // Deliberately recomputed from the title every time, and the no-collision branch
    // below must clear any name a previous pass left, or a listing whose title changed
    // would keep a qualifier that no longer matches it.
    if ((counts.get(name) ?? 0) < 2) {
      return listing.displayName ? { ...listing, displayName: undefined } : listing;
    }

    const qualifier = bestQualifier(listing.title, name);
    return qualifier ? { ...listing, displayName: `${name} - ${qualifier}` } : listing;
  });
}

/*
  Etsy keyword blocks almost all end in the product noun, so appending one verbatim gives
  "Gothic Christmas Wrapping Paper - Black Rose Gift Wrap": 50 characters to say one new
  word. The noun is dropped, the phrase is cut to a few words, and the shortest surviving
  candidate wins, which keeps the composed name inside the budget this file exists to
  protect.
*/
const PRODUCT_NOUN_TAIL = /[\s,+&-]*(?:gift\s*)?(?:wrap(?:ping)?|wrapper)?(?:\s*paper)?\s*$/i;
const KEYWORD_TAIL = /[\s,+&-]*(?:xmas|holiday|christmas)?\s*(?:decor|decoration|pattern|print|set)\s*$/i;
const MAX_QUALIFIER_WORDS = 4;

function bestQualifier(title: string, name: string): string | null {
  const lowerName = name.toLowerCase();

  const candidates = title
    .split("|")
    .slice(1)
    .map((part) => trimQualifier(part))
    .filter((part) => part.length > 0 && !lowerName.includes(part.toLowerCase()))
    .sort((a, b) => a.length - b.length);

  return candidates[0] ?? null;
}

/* Cutting to a word count can leave a dangling "for" or "&". */
const DANGLING_TAIL = /[\s,+&-]*\b(?:for|with|and|the|in|on|to|of|a|an|your|my)?[\s,+&-]*$/i;

function trimQualifier(part: string): string {
  const withoutNoun = part.trim().replace(KEYWORD_TAIL, "").replace(PRODUCT_NOUN_TAIL, "");
  const capped = withoutNoun.split(/\s+/).filter(Boolean).slice(0, MAX_QUALIFIER_WORDS).join(" ");
  // Only the dangling tail is re-stripped: the cap is what exposes it.
  return capped.replace(DANGLING_TAIL, "").trim();
}

function shortName(listing: Listing): string {
  const first = listing.title.split("|")[0].trim();
  return first || listing.title.trim();
}

/**
 * Alt text for a listing's photo.
 *
 * The catalogue's `altText` defaults to the raw Etsy title whenever the entry has no
 * hand-written one, which is the case for all 366 products today: pipe-separated keyword
 * blocks running a median of 123 characters. As alt text that is keyword stuffing, and it
 * is genuinely hostile to a screen reader reading a grid of two dozen cards.
 *
 * A hand-written alt is respected. Anything that is merely the title falls back to the
 * readable product name.
 */
export function listingAltText(listing: Listing): string {
  const alt = listing.image?.altText?.trim();
  return alt && alt !== listing.title.trim() ? alt : listingName(listing);
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
