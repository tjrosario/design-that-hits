import type { Listing } from "@/types/etsy";

/**
 * Zero means the feed carried no price rather than a free product: `lib/rss-parse.mjs`
 * defaults a missing price to 0. A zero must never reach the copy, the offer or the tags.
 */
export function hasPrice(listing: Listing): boolean {
  return listing.price > 0;
}

/** Falls back to a bare amount when the feed carried no currency code either. */
export function formatPrice(price: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${price.toFixed(2)} ${currency}`.trim();
  }
}

/** What a card or a product page shows when there is no usable price. */
export const PRICE_UNAVAILABLE = "See price on Etsy";
