/**
 * lib/seasonal.ts
 *
 * Which occasion collections are worth merchandising on a given day. The windows cover
 * the shopping run-up rather than the date itself, and they overlap on purpose: October
 * sells Halloween and Christmas at the same time.
 */

/** Inclusive window bound, as [month, day] with January as 1. */
type MonthDay = [month: number, day: number];

interface SeasonalWindow {
  /** An occasion slug from lib/facets.ts, which is also its collection path segment. */
  slug: string;
  start: MonthDay;
  end: MonthDay;
}

const WINDOWS: SeasonalWindow[] = [
  { slug: "halloween", start: [9, 1], end: [10, 31] },
  { slug: "christmas", start: [10, 1], end: [12, 26] },
  { slug: "valentines", start: [1, 1], end: [2, 14] },
  { slug: "graduation", start: [4, 15], end: [6, 15] },
];

/** Shown only when no dated window is open, since somebody always has a birthday. */
const FALLBACK_SLUG = "birthday";

/** Sortable integer for a month/day pair, so bounds compare without a Date. */
function ordinal([month, day]: MonthDay): number {
  return month * 100 + day;
}

/**
 * The occasions in season on `now`, soonest deadline first, falling back to birthday.
 * Reads the date in UTC so the result depends on the argument and not the host timezone.
 */
export function relevantOccasions(now: Date): string[] {
  const today = ordinal([now.getUTCMonth() + 1, now.getUTCDate()]);

  const open = WINDOWS.filter((w) => today >= ordinal(w.start) && today <= ordinal(w.end));
  if (open.length === 0) return [FALLBACK_SLUG];

  // Least time left is the most urgent thing to push.
  return open.sort((a, b) => ordinal(a.end) - ordinal(b.end)).map((w) => w.slug);
}

/**
 * The same list for today. Kept here so pages read the clock through one call rather
 * than each constructing a Date in render.
 */
export function currentOccasions(): string[] {
  return relevantOccasions(new Date());
}
