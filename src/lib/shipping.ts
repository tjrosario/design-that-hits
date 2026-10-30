/**
 * lib/shipping.ts
 *
 * How long an order takes, and the last day to order for Christmas.
 *
 * The deadline is never written down as a date. It is derived by walking the delivery
 * estimate backwards, so the date the site advertises and the figures behind it cannot
 * drift apart.
 */

import {
  addDays,
  dateKey,
  daysBetween,
  formatCalendarDate,
  nthWeekdayOfMonth,
  shopToday,
  weekdayOf,
  type CalendarDate,
} from "@/lib/shop-time";

/** A min/max bracket in business days. */
export interface DayRange {
  min: number;
  max: number;
}

/**
 * Production as the shop's Etsy listings allow for it, quoted on the product page and in the
 * structured data so the site never advertises faster than checkout. Not the deadline.
 */
export const HANDLING_DAYS: DayRange = { min: 2, max: 5 };

/**
 * Production as the two Printify providers measurably run it, averaging 1.1 and 1.4 days.
 * Both Christmas dates derive from this bracket: the slow end for one, the fast end for the other.
 */
export const OBSERVED_HANDLING_DAYS: DayRange = { min: 1, max: 2 };

/** US delivery after production, from the shop's verified Etsy shipping template. */
export const TRANSIT_DAYS: DayRange = { min: 4, max: 8 };

/** Where the wrapping paper is printed and posted from. */
export const SHIP_FROM = "Norcross, Georgia";

/** What the buyer pays at Etsy checkout for wrapping paper, per the shop's own template. */
export const WRAPPING_PAPER_RATE = { first: 8.49, additional: 1.39, currency: "USD" };

/**
 * The one product type these figures are verified for.
 *
 * 347 of 415 listings are wrapping paper, and the production figures are for its blueprint.
 * Apparel, ornaments and drinkware come off other providers with their own timings, so none
 * of them inherit an estimate that was never measured for them.
 */
export const SHIPPING_ESTIMATE_PRODUCT_TYPE = "wrapping-paper";

/*
  A printable or digital listing classifies as wrapping paper, because deriveProductType
  matches the paper pattern before the digital one. That is deliberate for browsing, but a
  file download must never carry a postage rate or a transit time.
*/
const DIGITAL_TITLE = /digital download|instant download|printable|\bsvg\b|canva template/i;

/** Whether a listing is a physical item these delivery figures actually describe. */
export function hasDeliveryEstimate(listing: {
  productType?: string | null;
  title?: string | null;
}): boolean {
  if (listing.productType !== SHIPPING_ESTIMATE_PRODUCT_TYPE) return false;
  return !DIGITAL_TITLE.test(listing.title ?? "");
}

/** Christmas Eve, not Christmas Day: nothing is delivered on the 25th. */
const CHRISTMAS_ARRIVE_BY = { month: 12, day: 24 };

/** How early the deadline is worth mentioning. Three weeks of notice, then it is noise. */
const NOTICE_LEAD_DAYS = 21;

/** Inside this many days of the deadline the banner switches to a countdown. */
const LAST_CALL_DAYS = 3;

/**
 * The days both the printer and the carriers stand down.
 *
 * Only the three universal closures. The major carriers run on Veterans Day and Columbus
 * Day, and the transit figure is already quoted in business days by a carrier that excludes
 * its own holidays, so counting those twice would move the deadline without cause.
 */
function closures(year: number): Set<number> {
  const dates = [
    observed({ year, month: 1, day: 1 }),
    thanksgiving(year),
    observed({ year, month: 12, day: 25 }),
    // A late December order is delivered in January, so next year's closure counts too.
    observed({ year: year + 1, month: 1, day: 1 }),
  ];
  return new Set(dates.map(dateKey));
}

/** The fourth Thursday of November. */
export function thanksgiving(year: number): CalendarDate {
  return nthWeekdayOfMonth(year, 11, 4, 4);
}

/** Federal observance: a holiday on a weekend is taken on the nearest weekday. */
export function observed(date: CalendarDate): CalendarDate {
  const weekday = weekdayOf(date);
  if (weekday === 6) return addDays(date, -1);
  if (weekday === 0) return addDays(date, 1);
  return date;
}

function isBusinessDay(date: CalendarDate, closed: Set<number>): boolean {
  const weekday = weekdayOf(date);
  return weekday >= 1 && weekday <= 5 && !closed.has(dateKey(date));
}

/** The date `count` business days after `start`, skipping weekends and closures. */
function addBusinessDays(start: CalendarDate, count: number, closed: Set<number>): CalendarDate {
  let date = start;
  let remaining = count;
  while (remaining > 0) {
    date = addDays(date, 1);
    if (isBusinessDay(date, closed)) remaining -= 1;
  }
  return date;
}

export interface DeliveryWindow {
  earliest: CalendarDate;
  latest: CalendarDate;
}

/**
 * When an order placed on `order` arrives. Orders are taken every day, so `order` may fall
 * on a weekend; production starts on the next business day either way.
 */
export function deliveryWindow(
  order: CalendarDate,
  handling: DayRange = HANDLING_DAYS
): DeliveryWindow {
  const closed = closures(order.year);
  return {
    earliest: addBusinessDays(
      addBusinessDays(order, handling.min, closed),
      TRANSIT_DAYS.min,
      closed
    ),
    latest: addBusinessDays(addBusinessDays(order, handling.max, closed), TRANSIT_DAYS.max, closed),
  };
}

/**
 * How confident a cutoff is. `safe` needs the slow end of the measured pace to land in time,
 * `likely` only its fast end, which is the best case and nothing more.
 */
export type Pace = "safe" | "likely";

/**
 * The last day an order can be placed and still arrive by `arriveBy`.
 *
 * Defined by walking `deliveryWindow` backwards rather than by subtracting a day count, so
 * the deadline is always one the delivery estimate itself supports.
 */
export function lastOrderDate(arriveBy: CalendarDate, pace: Pace): CalendarDate {
  let candidate = arriveBy;
  for (let step = 0; step < 90; step += 1) {
    const arrival =
      pace === "safe"
        ? deliveryWindow(candidate, OBSERVED_HANDLING_DAYS).latest
        : deliveryWindow(candidate, OBSERVED_HANDLING_DAYS).earliest;
    if (dateKey(arrival) <= dateKey(arriveBy)) return candidate;
    candidate = addDays(candidate, -1);
  }
  return candidate;
}

export interface ChristmasCutoff {
  arriveBy: CalendarDate;
  /** The date the site advertises: in time at the slow end of the measured production pace. */
  safe: CalendarDate;
  /** Past `safe`, the last date that arrives only if everything runs at its measured best. */
  likely: CalendarDate;
}

export function christmasCutoff(year: number): ChristmasCutoff {
  const arriveBy = { year, ...CHRISTMAS_ARRIVE_BY };
  return {
    arriveBy,
    safe: lastOrderDate(arriveBy, "safe"),
    likely: lastOrderDate(arriveBy, "likely"),
  };
}

/** The per-product delivery sentence. Only for listings hasDeliveryEstimate accepts. */
export function deliveryEstimateText(): string {
  return `Made to order in ${HANDLING_DAYS.min} to ${HANDLING_DAYS.max} business days, then ${TRANSIT_DAYS.min} to ${TRANSIT_DAYS.max} business days in transit within the US. Ships from ${SHIP_FROM}.`;
}

export type NoticeState = "open" | "last-call" | "late";

export interface ShippingNotice {
  state: NoticeState;
  /** The advertised deadline, and what the countdown counts to. */
  cutoff: CalendarDate;
  /** The later date that can still make it, named once `cutoff` has passed. */
  lastChance: CalendarDate;
  /** Days from today to `cutoff`, 0 on the day itself and negative once past. */
  daysLeft: number;
  cutoffLabel: string;
  lastChanceLabel: string;
  headline: string;
  detail: string;
}

/*
  Scoped to wrapping paper on purpose. This runs in the sitewide banner, which has no
  product to gate on, and the timings are only measured for that one type: the apparel and
  the single Canva download must not inherit "ships from Norcross".
*/
const NOTICE_DETAIL =
  "Based on wrapping paper delivered within the US. Other items and digital downloads vary.";

/** Why the deadline is later than the product page's processing window implies. */
const PACE_BASIS =
  "Assumes the printer's current production pace rather than the longer window the listing allows.";

/**
 * The Christmas delivery notice for `now`, or null when there is nothing honest to say.
 *
 * Silent outside the run-up, and silent again once even the optimistic date has gone: a
 * deadline the shop can no longer meet is worse than no deadline at all.
 */
export function shippingNotice(now: Date): ShippingNotice | null {
  const today = shopToday(now);
  const { safe, likely } = christmasCutoff(today.year);
  const daysLeft = daysBetween(today, safe);
  const daysToLastChance = daysBetween(today, likely);

  if (daysLeft > NOTICE_LEAD_DAYS || daysToLastChance < 0) return null;

  const common = {
    cutoff: safe,
    lastChance: likely,
    daysLeft,
    cutoffLabel: formatCalendarDate(safe),
    lastChanceLabel: formatCalendarDate(likely),
  };

  if (daysLeft < 0) {
    return {
      ...common,
      state: "late",
      headline: "Past the safe cutoff for Christmas delivery",
      detail: `An order placed by ${common.lastChanceLabel} can still arrive in time, but only if production and transit both run at their fastest. ${NOTICE_DETAIL}`,
    };
  }

  if (daysLeft <= LAST_CALL_DAYS) {
    return {
      ...common,
      state: "last-call",
      headline:
        daysLeft === 0
          ? "Today is the last day to order for Christmas delivery"
          : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left to order for Christmas delivery`,
      detail: `${PACE_BASIS} ${NOTICE_DETAIL}`,
    };
  }

  return {
    ...common,
    state: "open",
    headline: `Order by ${common.cutoffLabel} for Christmas delivery`,
    detail: `${PACE_BASIS} ${NOTICE_DETAIL}`,
  };
}
