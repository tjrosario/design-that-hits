/**
 * Etsy image URLs, upgraded to the full-size variant.
 *
 * The catalog carries whatever variant the CSV export or the shop-grid scrape produced,
 * mostly `il_fullxfull` but a quarter of it smaller, down to `il_170x135`. A 170x135
 * thumbnail is below Facebook's 200x200 floor and X's 300x157 one, so those pages render
 * a text-only card, and anything under 600x315 gets Facebook's small side-thumbnail
 * instead of the large card. `il_570xN` also means 570 wide with the height unconstrained,
 * so those range from 0.67 to 1.83 aspect and `summary_large_image` crops them hard.
 *
 * The size token is just a path segment, so asking for `il_fullxfull` returns the same
 * photo at 1024-2048px, against 570 for the stored variant on about a quarter of the
 * catalog.
 *
 * Used wherever one image is rendered large: share cards, the feed, the hero and the
 * product page photo. The grid keeps the stored source, because fetching 2048px originals
 * for 24 cards at once is what the LCP work tuned away. That is a deliberate trade rather
 * than a claim the cards are big enough; on a phone a card is nearly the full viewport
 * width, so the grid is the next thing worth measuring.
 */
const ETSY_VARIANT = /\/il_[^./]+\./;

export function fullSizeImageUrl(url: string): string {
  return url.replace(ETSY_VARIANT, "/il_fullxfull.");
}

/**
 * The variant a grid card should load.
 *
 * The stored URL is whatever the export produced: 276 listings carry `il_fullxfull` at
 * around 2754px, 137 carry `il_570xN`, and one carries a 170px thumbnail. Both ends are
 * wrong for a card. The 570px ones are upscaled, because a phone at 100vw and 2x asks
 * the optimizer for about 828px; the full-size ones make the optimizer fetch and resize
 * a 2754px original for a card that is never wider than 320px on a desktop.
 *
 * 1140 is the largest Etsy variant below full size and covers the widest real request,
 * so it sharpens a third of the grid and cuts the origin fetch for the rest.
 */
export function gridImageUrl(url: string): string {
  return url.replace(ETSY_VARIANT, "/il_1140xN.");
}

/**
 * The brand card, for pages with no product of their own.
 *
 * `src/app/opengraph-image.png` only applies to the segment that owns it, and only while
 * that segment's own `openGraph` has no `images` key. Every page here declares one, so
 * until this was referenced explicitly `/`, `/about` and `/contact` emitted no og:image.
 */
export const SITE_SHARE_IMAGE = {
  // The .png extension matters: this was a generated route at /opengraph-image and is now
  // a static file, so the extensionless path 404s.
  url: "/opengraph-image.png",
  alt: "Design That Hits — print-on-demand gifts, wrapping paper and party designs",
  width: 1200,
  height: 630,
} as const;
