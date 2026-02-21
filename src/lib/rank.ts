/**
 * lib/rank.ts
 *
 * Fallback heuristics for "Best Sellers" and "Trending" when Etsy doesn't
 * provide explicit ordering for these concepts.
 *
 * DOCUMENTATION OF APPROACH:
 *
 * Best Sellers:
 *   Etsy doesn't expose a "sales count" via API v3 public endpoints.
 *   Best available proxy: `num_favorers` (number of people who favorited the listing).
 *   Rank by num_favorers descending. Ties broken by views descending.
 *   Limitation: favorers ≠ purchases, but high-favorited items correlate strongly
 *   with popularity/sales in practice.
 *
 * Trending:
 *   Heuristic: combine recency and engagement velocity.
 *   Score = (num_favorers / daysSinceCreated) * recencyBoost
 *   recencyBoost: items created in last 30 days get 2x, last 90 days 1.5x, else 1x.
 *   This approximates "rising" items that are accumulating favorites quickly.
 *   Limitation: we don't have time-series data, so this is a snapshot approximation.
 */

import type { Listing } from "@/types/etsy";

const NOW = Date.now() / 1000; // Unix timestamp in seconds

function daysSince(timestamp: number): number {
  return Math.max(1, (NOW - timestamp) / 86400);
}

function recencyBoost(timestamp: number): number {
  const days = daysSince(timestamp);
  if (days <= 30) return 2.0;
  if (days <= 90) return 1.5;
  return 1.0;
}

export function rankBestSellers(listings: Listing[]): Listing[] {
  return [...listings].sort((a, b) => {
    if (b.numFavorers !== a.numFavorers) return b.numFavorers - a.numFavorers;
    return b.views - a.views;
  });
}

export function rankTrending(listings: Listing[]): Listing[] {
  const scored = listings.map((l) => {
    const days = daysSince(l.createdAt);
    const velocity = l.numFavorers / days;
    const score = velocity * recencyBoost(l.createdAt);
    return { ...l, score };
  });

  return scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

export function rankNewest(listings: Listing[]): Listing[] {
  return [...listings].sort((a, b) => b.createdAt - a.createdAt);
}

export function rankByPrice(listings: Listing[], direction: "asc" | "desc"): Listing[] {
  return [...listings].sort((a, b) =>
    direction === "asc" ? a.price - b.price : b.price - a.price
  );
}
