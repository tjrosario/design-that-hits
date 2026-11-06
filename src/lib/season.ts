/**
 * lib/season.ts
 *
 * Which season and holiday the storefront paints itself in on a given day.
 *
 * Calendar arithmetic comes from lib/shop-time.ts so there is one implementation of a
 * wall-calendar date in the codebase. This module adds only what the shipping deadline
 * never needed: the holidays that move with the moon, and the schedule of palette changes.
 *
 * Merchandising is a separate concern: lib/seasonal.ts decides which collections to push,
 * and its windows are deliberately wider than these because a shopper buys ahead.
 */

import {
  addDays,
  dateKey,
  daysBetween,
  nthWeekdayOfMonth,
  shopToday,
  type CalendarDate,
} from "@/lib/shop-time";

export type SeasonId = "spring" | "summer" | "fall" | "winter";

/**
 * The holidays that get their own palette.
 *
 * Commemorative federal holidays are deliberately absent. A gift shop swapping to a
 * festive accent for Memorial Day or Juneteenth is the wrong register, and the catalog
 * has nothing listed for any of them.
 */
export type HolidayId =
  | "new-year"
  | "valentines"
  | "st-patricks"
  | "easter"
  | "mothers-day"
  | "fathers-day"
  | "independence-day"
  | "halloween"
  | "thanksgiving"
  | "hanukkah"
  | "christmas";

/** What the site themes for on a day. A holiday, when one is in range, over a season. */
export interface SeasonalTheme {
  season: SeasonId;
  holiday: HolidayId | null;
}

/**
 * Easter Sunday by the anonymous Gregorian computus.
 *
 * Western Easter, which drifts between March 22 and April 25, so it can be neither a
 * fixed date nor a weekday rule.
 */
export function easterSunday(year: number): CalendarDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const shift = h + l - 7 * m + 114;
  return { year, month: Math.floor(shift / 31), day: (shift % 31) + 1 };
}

/* `month: "long"` because the month is matched by name: the Hebrew calendar's numeric
   index moves with the leap month, so Kislev is not a fixed number. */
const HEBREW_CALENDAR = new Intl.DateTimeFormat("en-u-ca-hebrew", {
  timeZone: "UTC",
  year: "numeric",
  month: "long",
  day: "numeric",
});

const hanukkahByYear = new Map<number, CalendarDate | null>();

/**
 * The Gregorian day that is 25 Kislev, the first night of Hanukkah.
 *
 * Asked of the runtime's Hebrew calendar rather than kept as a table: the Hebrew year is
 * not derivable from the Gregorian one by arithmetic, and a table would silently theme
 * the wrong week once it ran out. 25 Kislev always falls inside the scanned range.
 */
export function hanukkahFirstNight(year: number): CalendarDate | null {
  // Memoised because holidayFor asks for three years on every day it resolves, and each
  // miss walks up to six weeks of the Hebrew calendar through Intl.
  const cached = hanukkahByYear.get(year);
  if (cached !== undefined) return cached;

  const found = scanForKislev25(year);
  hanukkahByYear.set(year, found);
  return found;
}

function scanForKislev25(year: number): CalendarDate | null {
  let date: CalendarDate = { year, month: 11, day: 20 };
  const end = dateKey({ year, month: 12, day: 31 });
  while (dateKey(date) <= end) {
    // Midday, so no zone offset can push the formatted day onto a neighbouring date.
    const parts = HEBREW_CALENDAR.formatToParts(
      new Date(Date.UTC(date.year, date.month - 1, date.day, 12))
    );
    const day = parts.find((part) => part.type === "day")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    if (day === "25" && month?.startsWith("Kislev")) return date;
    date = addDays(date, 1);
  }
  return null;
}

interface HolidayDefinition {
  id: HolidayId;
  /** The day itself, or null in a year a calendar cannot place it. */
  on: (year: number) => CalendarDate | null;
  /** Days before the date that the palette is already up, for shopping lead time. */
  lead: number;
  /** Days after it that the palette stays up. */
  trail: number;
  /** Decides an overlap between two holidays that have both arrived. Highest wins. */
  priority: number;
}

/*
  Leads are shopping lead times, not decoration: a gift is bought well before the day it
  is given. Thanksgiving trails four days so that Black Friday and Cyber Monday always
  fall inside it, which is what the trail is for rather than meeting Christmas exactly:
  depending on where the fourth Thursday lands, the two windows abut, overlap by a day or
  leave one or two days of bare fall between them.
*/
const HOLIDAYS: HolidayDefinition[] = [
  { id: "new-year", on: (y) => ({ year: y, month: 1, day: 1 }), lead: 5, trail: 1, priority: 65 },
  { id: "valentines", on: (y) => ({ year: y, month: 2, day: 14 }), lead: 14, trail: 1, priority: 85 },
  { id: "st-patricks", on: (y) => ({ year: y, month: 3, day: 17 }), lead: 10, trail: 0, priority: 60 },
  { id: "easter", on: easterSunday, lead: 14, trail: 1, priority: 80 },
  { id: "mothers-day", on: (y) => nthWeekdayOfMonth(y, 5, 0, 2), lead: 14, trail: 1, priority: 78 },
  { id: "fathers-day", on: (y) => nthWeekdayOfMonth(y, 6, 0, 3), lead: 14, trail: 1, priority: 76 },
  { id: "independence-day", on: (y) => ({ year: y, month: 7, day: 4 }), lead: 14, trail: 1, priority: 74 },
  { id: "halloween", on: (y) => ({ year: y, month: 10, day: 31 }), lead: 30, trail: 0, priority: 90 },
  { id: "thanksgiving", on: (y) => nthWeekdayOfMonth(y, 11, 4, 4), lead: 21, trail: 4, priority: 95 },
  { id: "hanukkah", on: hanukkahFirstNight, lead: 7, trail: 8, priority: 70 },
  { id: "christmas", on: (y) => ({ year: y, month: 12, day: 25 }), lead: 24, trail: 1, priority: 100 },
];

/**
 * Meteorological seasons, which start on the first of a month.
 *
 * Chosen over the astronomical ones because a boundary that shifts by a day each year is
 * not worth the code to track it, and nobody shopping for gift wrap notices the solstice.
 */
export function seasonFor(date: CalendarDate): SeasonId {
  if (date.month >= 3 && date.month <= 5) return "spring";
  if (date.month >= 6 && date.month <= 8) return "summer";
  if (date.month >= 9 && date.month <= 11) return "fall";
  return "winter";
}

interface RankedHoliday {
  id: HolidayId;
  /** True once the day itself has arrived, false while it is still being led up to. */
  arrived: boolean;
  priority: number;
  distance: number;
}

/**
 * A holiday that has arrived outranks one still being led up to, whatever their priority.
 *
 * Without this a long lead window swallows every smaller holiday inside it, and the
 * swallowed one never renders in any year.
 */
function outranks(a: RankedHoliday, b: RankedHoliday): boolean {
  if (a.arrived !== b.arrived) return a.arrived;
  if (a.priority !== b.priority) return a.priority > b.priority;
  return a.distance < b.distance;
}

/** The holiday in range on a day, or null when the season alone carries the palette. */
export function holidayFor(date: CalendarDate): HolidayId | null {
  let best: RankedHoliday | null = null;

  for (const holiday of HOLIDAYS) {
    // A window can reach across New Year, so a day is tested against three years of them.
    for (const year of [date.year - 1, date.year, date.year + 1]) {
      const on = holiday.on(year);
      if (!on) continue;
      const offset = daysBetween(on, date);
      if (offset < -holiday.lead || offset > holiday.trail) continue;
      const candidate: RankedHoliday = {
        id: holiday.id,
        arrived: offset >= 0,
        priority: holiday.priority,
        distance: Math.abs(offset),
      };
      if (!best || outranks(candidate, best)) best = candidate;
    }
  }

  return best?.id ?? null;
}

/** The season and holiday for a day, which together name the palette a page renders in. */
export function themeFor(date: CalendarDate): SeasonalTheme {
  return { season: seasonFor(date), holiday: holidayFor(date) };
}

/** Today's theme on the shop's wall calendar. */
export function currentTheme(now: Date = new Date()): SeasonalTheme {
  return themeFor(shopToday(now));
}

/** One change of palette, starting on `from` and running until the next entry. */
export interface SeasonalTransition {
  /** The first day this palette applies, as a sortable `YYYYMMDD`. */
  from: number;
  season: SeasonId;
  holiday: HolidayId | null;
}

/**
 * Below this, a palette would read as a flicker rather than a season.
 *
 * A run this short is absorbed into the one before it. Lead windows overlap, so without
 * this the accent can change four times in ten days: in December 2030 the raw rule gives
 * Christmas, Hanukkah, two days of Christmas again, Hanukkah, then New Year.
 */
export const MIN_RUN_DAYS = 4;

/** Drops any run shorter than `MIN_RUN_DAYS`, extending its predecessor over those days. */
function absorbShortRuns(
  transitions: SeasonalTransition[],
  endExclusive: number
): SeasonalTransition[] {
  const dayOf = (key: number) => ({
    year: Math.floor(key / 10000),
    month: Math.floor(key / 100) % 100,
    day: key % 100,
  });
  const lengthOf = (list: SeasonalTransition[], at: number) =>
    daysBetween(dayOf(list[at].from), dayOf(list[at + 1]?.from ?? endExclusive));

  let kept = transitions;
  for (let pass = 0; pass < transitions.length; pass += 1) {
    // The first run has no predecessor to fold into, so it always stays.
    const short = kept.findIndex((_, at) => at > 0 && lengthOf(kept, at) < MIN_RUN_DAYS);
    if (short === -1) break;
    kept = kept.filter((_, at) => at !== short);
    kept = kept.filter(
      (entry, at) => at === 0 || entry.season !== kept[at - 1].season || entry.holiday !== kept[at - 1].holiday
    );
  }
  return kept;
}

/**
 * Every palette change over `years` from the start of `fromYear`, in order.
 *
 * The point is to move the calendar off the critical path: the client gets this table and
 * a date comparison instead of a copy of the holiday rules, so the arithmetic above stays
 * the only implementation. A year is about thirty entries.
 *
 * Short runs are absorbed, so this is deliberately not a day-by-day echo of `themeFor`.
 */
export function seasonSchedule(fromYear: number, years = 2): SeasonalTransition[] {
  const transitions: SeasonalTransition[] = [];
  const end = dateKey({ year: fromYear + years, month: 1, day: 1 });
  let date: CalendarDate = { year: fromYear, month: 1, day: 1 };

  while (dateKey(date) < end) {
    const { season, holiday } = themeFor(date);
    const last = transitions[transitions.length - 1];
    if (!last || last.season !== season || last.holiday !== holiday) {
      transitions.push({ from: dateKey(date), season, holiday });
    }
    date = addDays(date, 1);
  }

  return absorbShortRuns(transitions, end);
}

/** Every holiday the calendar knows, for tests and for a coverage check. */
export function holidayIds(): HolidayId[] {
  return HOLIDAYS.map((holiday) => holiday.id);
}
