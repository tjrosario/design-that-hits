/**
 * Recently published listings.
 *
 * Deliberately time-bounded rather than "the newest N". The home grid already sorts
 * `created desc` and the hero carousel already shows the eight newest, so a section that
 * simply took the top of that order would be the third place on one page showing the
 * same products. Asking "what arrived since <date>" gives a set that is genuinely
 * different, shrinks when nothing has been published, and disappears entirely rather
 * than claiming a quiet fortnight was a drop.
 *
 * `createdAt` is Etsy's own publish date, carried through the RSS feed. The bulk of the
 * catalog shares a timestamp from the original CSV import, which is why nothing here
 * looks further back than a couple of months: beyond that the dates stop meaning
 * "published" and start meaning "imported".
 */

import { getAllListings } from "@/lib/shop";
import type { Listing } from "@/types/etsy";

/** The home strip: short enough that everything in it is genuinely recent. */
export const JUST_DROPPED_DAYS = 14;

/** The full page, which can afford a longer window. */
export const NEW_ARRIVALS_DAYS = 45;

export function since(listings: Listing[], days: number, now = Date.now()): Listing[] {
  const cutoff = now / 1000 - days * 86400;
  return listings
    .filter((l) => l.createdAt > cutoff && l.image)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function justDropped(limit: number, now = Date.now()): Promise<Listing[]> {
  const listings = await getAllListings();
  return since(listings, JUST_DROPPED_DAYS, now).slice(0, limit);
}

export async function newArrivals(now = Date.now()): Promise<Listing[]> {
  const listings = await getAllListings();
  return since(listings, NEW_ARRIVALS_DAYS, now);
}
