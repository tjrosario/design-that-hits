/**
 * lib/shop-time.ts
 *
 * The shop's calendar day, and arithmetic on bare calendar dates. Dates here carry no time
 * and no zone, so nothing in them can drift with the runtime's locale.
 */

/** The shop sells in USD to US buyers, so its calendar day is the one that matters. */
export const SHOP_TIME_ZONE = "America/New_York";

/** A day on the wall calendar, January being 1. */
export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

const MS_PER_DAY = 86_400_000;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Anchored to UTC midnight: in UTC a day is always 24 hours, so no DST boundary can shift
// a date by one during arithmetic.
function toUtc(date: CalendarDate): number {
  return Date.UTC(date.year, date.month - 1, date.day);
}

function fromUtc(ms: number): CalendarDate {
  const d = new Date(ms);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** `now` as the shop's wall calendar reads it, whatever zone the server runs in. */
export function shopToday(now: Date): CalendarDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SHOP_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** Sortable integer, so two dates compare without constructing a Date. */
export function dateKey(date: CalendarDate): number {
  return date.year * 10000 + date.month * 100 + date.day;
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  return fromUtc(toUtc(date) + days * MS_PER_DAY);
}

/** Whole days from `from` to `to`, negative when `to` is already past. */
export function daysBetween(from: CalendarDate, to: CalendarDate): number {
  return Math.round((toUtc(to) - toUtc(from)) / MS_PER_DAY);
}

/** Day of the week, 0 for Sunday, matching Date#getDay. */
export function weekdayOf(date: CalendarDate): number {
  return new Date(toUtc(date)).getUTCDay();
}

/** The nth given weekday of a month, for the holidays that move each year. */
export function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  nth: number
): CalendarDate {
  const first = { year, month, day: 1 };
  const offset = (weekday - weekdayOf(first) + 7) % 7;
  return addDays(first, offset + (nth - 1) * 7);
}

/** `2026-12-07`, for a machine-readable `<time dateTime>`. */
export function toISODate(date: CalendarDate): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

/**
 * A date as the site writes it, "December 7".
 *
 * Built from the month name rather than through Intl: formatting a UTC-anchored date in
 * the runtime's zone renders the previous day anywhere west of Greenwich, and that bug is
 * invisible to a CI runner in UTC. With no zone involved there is nothing to get wrong.
 */
export function formatCalendarDate(date: CalendarDate): string {
  return `${MONTH_NAMES[date.month - 1]} ${date.day}`;
}
