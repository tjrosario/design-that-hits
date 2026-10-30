import { describe, expect, it } from "vitest";
import {
  HANDLING_DAYS,
  OBSERVED_HANDLING_DAYS,
  TRANSIT_DAYS,
  christmasCutoff,
  deliveryEstimateText,
  offerShippingDetails,
  deliveryWindow,
  hasDeliveryEstimate,
  observed,
  shippingNotice,
  thanksgiving,
} from "@/lib/shipping";
import {
  addDays,
  dateKey,
  formatCalendarDate,
  nthWeekdayOfMonth,
  shopToday,
  toISODate,
  weekdayOf,
} from "@/lib/shop-time";

/** Noon Eastern on a given day, unambiguously that day in the shop's zone. */
function shopNoon(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 17, 0));
}

describe("shop-time", () => {
  /*
    The whole reason this module exists. The suite pins TZ to UTC, so an instant that is
    still yesterday in New York has to read as yesterday: taking the runtime zone instead
    would roll the date over five hours early and retire the deadline while it was still
    the cutoff day on the US east coast.
  */
  it("reads the calendar day in the shop's timezone, not the runtime's", () => {
    // 2027-01-01 02:00 UTC is 2026-12-31 21:00 in New York.
    expect(shopToday(new Date("2027-01-01T02:00:00Z"))).toEqual({
      year: 2026,
      month: 12,
      day: 31,
    });
    // 2026-12-10 04:30 UTC is still 2026-12-09 in New York.
    expect(shopToday(new Date("2026-12-10T04:30:00Z"))).toEqual({
      year: 2026,
      month: 12,
      day: 9,
    });
  });

  it("formats a date without reference to any timezone", () => {
    expect(formatCalendarDate({ year: 2026, month: 12, day: 7 })).toBe("December 7");
    expect(formatCalendarDate({ year: 2026, month: 1, day: 1 })).toBe("January 1");
    expect(toISODate({ year: 2026, month: 1, day: 1 })).toBe("2026-01-01");
  });

  // The holidays that move are found by counting weekdays, so the count has to be right.
  it("finds the nth weekday of a month", () => {
    // December 2026 starts on a Tuesday, so the first Thursday is the 3rd.
    expect(toISODate(nthWeekdayOfMonth(2026, 12, 4, 1))).toBe("2026-12-03");
    expect(toISODate(nthWeekdayOfMonth(2026, 12, 4, 2))).toBe("2026-12-10");
    // November 2026 starts on a Sunday, so the first Sunday is the 1st.
    expect(toISODate(nthWeekdayOfMonth(2026, 11, 0, 1))).toBe("2026-11-01");
  });
});

describe("holiday closures", () => {
  it("puts Thanksgiving on the fourth Thursday of November", () => {
    expect(toISODate(thanksgiving(2026))).toBe("2026-11-26");
    expect(toISODate(thanksgiving(2027))).toBe("2027-11-25");
    expect(toISODate(thanksgiving(2028))).toBe("2028-11-23");
    for (const year of [2026, 2027, 2028, 2029, 2030]) {
      expect(weekdayOf(thanksgiving(year)), String(year)).toBe(4);
      expect(thanksgiving(year).day, String(year)).toBeGreaterThanOrEqual(22);
      expect(thanksgiving(year).day, String(year)).toBeLessThanOrEqual(28);
    }
  });

  /*
    2027 is the awkward year: Christmas Day is a Saturday, so the closure is observed on
    Friday the 24th, which is the arrival target itself. 2026 has no weekend holiday at
    all, so without these years the shift is asserted nowhere.
  */
  it("moves a weekend holiday to the nearest weekday", () => {
    expect(toISODate(observed({ year: 2027, month: 12, day: 25 }))).toBe("2027-12-24");
    expect(toISODate(observed({ year: 2028, month: 1, day: 1 }))).toBe("2027-12-31");
    // A Sunday holiday is taken on the Monday after.
    expect(toISODate(observed({ year: 2028, month: 12, day: 24 }))).toBe("2028-12-25");
    // A weekday holiday is left alone.
    expect(toISODate(observed({ year: 2026, month: 12, day: 25 }))).toBe("2026-12-25");
  });
});

describe("deliveryWindow", () => {
  it("never lands on a weekend or a closure", () => {
    for (const year of [2026, 2027, 2028]) {
      for (let day = 1; day <= 31; day += 1) {
        const { earliest, latest } = deliveryWindow({ year, month: 12, day });
        for (const arrival of [earliest, latest]) {
          const where = `${year}-12-${day} -> ${toISODate(arrival)}`;
          expect(weekdayOf(arrival), where).toBeGreaterThanOrEqual(1);
          expect(weekdayOf(arrival), where).toBeLessThanOrEqual(5);
          expect(toISODate(arrival), where).not.toBe(`${year}-12-25`);
          expect(toISODate(arrival), where).not.toBe(`${year + 1}-01-01`);
          expect(toISODate(arrival), where).not.toBe(toISODate(thanksgiving(year)));
        }
      }
    }
  });

  it("starts production on the next business day when the order is placed on a weekend", () => {
    const saturday = deliveryWindow({ year: 2026, month: 12, day: 12 });
    const sunday = deliveryWindow({ year: 2026, month: 12, day: 13 });
    expect(toISODate(sunday.latest)).toBe(toISODate(saturday.latest));
  });

  it("brackets the earliest arrival before the latest", () => {
    for (let day = 1; day <= 28; day += 1) {
      const { earliest, latest } = deliveryWindow({ year: 2026, month: 11, day });
      expect(dateKey(earliest), `11/${day}`).toBeLessThanOrEqual(dateKey(latest));
    }
  });

  it("carries a late December order into January across New Year", () => {
    const { latest } = deliveryWindow({ year: 2026, month: 12, day: 23 });
    expect(latest.year).toBe(2027);
    expect(toISODate(latest)).not.toBe("2027-01-01");
  });

  it("delivers sooner when given the faster measured production figure", () => {
    const order = { year: 2026, month: 12, day: 7 };
    const published = deliveryWindow(order, HANDLING_DAYS);
    const observedPace = deliveryWindow(order, OBSERVED_HANDLING_DAYS);
    expect(dateKey(observedPace.latest)).toBeLessThan(dateKey(published.latest));
  });
});

/*
  The invariant that makes the advertised date printable. The cutoff is walked back from the
  measured pace, so ordering on it has to arrive in time at that bracket's slow end and the
  next day has to miss. Without the second half the test would pass for any date early
  enough, including a needlessly early one. It disagrees with the longer window the site
  quotes the buyer by design, which the offerShippingDetails test pins separately.
*/
describe("christmasCutoff", () => {
  it("is the last day whose slowest measured delivery still arrives in time", () => {
    for (const year of [2026, 2027, 2028, 2029, 2030]) {
      const { arriveBy, safe } = christmasCutoff(year);
      const window = (d: typeof safe) => deliveryWindow(d, OBSERVED_HANDLING_DAYS).latest;
      expect(dateKey(window(safe)), `${year} cutoff`).toBeLessThanOrEqual(dateKey(arriveBy));
      expect(dateKey(window(addDays(safe, 1))), `${year} day after cutoff`).toBeGreaterThan(
        dateKey(arriveBy)
      );
    }
  });

  it("is the last day whose fastest measured delivery arrives in time, at the likely pace", () => {
    for (const year of [2026, 2027, 2028]) {
      const { arriveBy, likely } = christmasCutoff(year);
      const window = (d: typeof likely) => deliveryWindow(d, OBSERVED_HANDLING_DAYS).earliest;
      expect(dateKey(window(likely))).toBeLessThanOrEqual(dateKey(arriveBy));
      expect(dateKey(window(addDays(likely, 1)))).toBeGreaterThan(dateKey(arriveBy));
    }
  });

  it("puts the optimistic date after the safe one", () => {
    for (const year of [2026, 2027, 2028, 2029, 2030]) {
      const { safe, likely } = christmasCutoff(year);
      expect(dateKey(likely), String(year)).toBeGreaterThan(dateKey(safe));
    }
  });

  /*
    Pinned deliberately. 2026 is the year this ships for, and Christmas Day falling on a
    Friday costs a weekend right at the end. A change here means a fulfilment figure moved.
  */
  it("puts the 2026 Christmas cutoff on December 10", () => {
    const { safe, likely } = christmasCutoff(2026);
    expect(toISODate(safe)).toBe("2026-12-10");
    expect(toISODate(likely)).toBe("2026-12-17");
  });

  /*
    The deadline comes off the printer's measured pace, while the product page and the
    structured data keep quoting the listing's longer allowance. Both figures are true, and
    the gap between them is the slack the shop is choosing to spend.
  */
  it("derives the advertised date from the measured pace, not the published allowance", () => {
    const { safe, arriveBy } = christmasCutoff(2026);
    expect(dateKey(deliveryWindow(safe, OBSERVED_HANDLING_DAYS).latest)).toBeLessThanOrEqual(
      dateKey(arriveBy)
    );
    expect(dateKey(deliveryWindow(safe, HANDLING_DAYS).latest)).toBeGreaterThan(dateKey(arriveBy));
  });

  /*
    The quoted window is a separate promise from the deadline and must stay the listing's,
    so the product page and the Offer never advertise faster than Etsy checkout.
  */
  it("still quotes the published processing window to the buyer", () => {
    expect(HANDLING_DAYS).toEqual({ min: 2, max: 5 });
    expect(OBSERVED_HANDLING_DAYS.max).toBeLessThan(HANDLING_DAYS.max);
    expect(deliveryEstimateText()).toContain("2 to 5 business days");
  });
});

/*
  A crawler must never be told the shop processes faster than its own Etsy checkout says.
  Nothing guarded this, so swapping these to the measured pace used to pass on green CI.
*/
describe("offerShippingDetails", () => {
  it("publishes the listing's processing window, not the measured pace", () => {
    const { handlingTime, transitTime } = offerShippingDetails().deliveryTime;
    expect(handlingTime.minValue).toBe(HANDLING_DAYS.min);
    expect(handlingTime.maxValue).toBe(HANDLING_DAYS.max);
    expect(handlingTime.maxValue).not.toBe(OBSERVED_HANDLING_DAYS.max);
    expect(transitTime.minValue).toBe(TRANSIT_DAYS.min);
    expect(transitTime.maxValue).toBe(TRANSIT_DAYS.max);
  });

  it("quotes days in the unit Google reads, and the single-roll rate", () => {
    const details = offerShippingDetails();
    expect(details.deliveryTime.handlingTime.unitCode).toBe("DAY");
    expect(details.deliveryTime.transitTime.unitCode).toBe("DAY");
    expect(details.shippingRate.value).toBe("8.49");
  });
});

describe("deliveryEstimateText", () => {
  it("quotes the published figures rather than restating them", () => {
    const text = deliveryEstimateText();
    expect(text).toContain(`${HANDLING_DAYS.min} to ${HANDLING_DAYS.max} business days`);
    expect(text).toContain(`${TRANSIT_DAYS.min} to ${TRANSIT_DAYS.max} business days`);
    expect(text).toContain("Norcross");
  });
});

/*
  deriveProductType matches the wrapping-paper pattern before the digital one, so a
  printable listing classifies as wrapping paper. That is fine for browsing and wrong for a
  postage rate, and the catalog is re-synced from Etsy every six hours.
*/
describe("hasDeliveryEstimate", () => {
  it("accepts physical wrapping paper", () => {
    expect(
      hasDeliveryEstimate({ productType: "wrapping-paper", title: "Gothic Christmas Wrapping Paper" })
    ).toBe(true);
  });

  it("refuses a printable or digital listing that classifies as wrapping paper", () => {
    for (const title of [
      "Printable Christmas Wrapping Paper",
      "Christmas Gift Wrap SVG Bundle - Digital Download",
      "Retro Wrapping Paper - Instant Download Printable",
      "Wrapping Paper Canva Template",
    ]) {
      expect(hasDeliveryEstimate({ productType: "wrapping-paper", title }), title).toBe(false);
    }
  });

  it("refuses every product type the figures were not measured for", () => {
    for (const productType of ["apparel", "ornament", "hat", "drinkware", "digital", null]) {
      expect(hasDeliveryEstimate({ productType, title: "Something" }), String(productType)).toBe(
        false
      );
    }
  });
});

describe("shippingNotice", () => {
  it("says nothing outside the Christmas run-up", () => {
    for (const [month, day] of [
      [1, 15],
      [4, 1],
      [7, 4],
      [9, 30],
      [10, 15],
      [11, 15],
    ] as [number, number][]) {
      expect(shippingNotice(shopNoon(2026, month, day)), `${month}/${day}`).toBeNull();
    }
  });

  it("opens three weeks before the cutoff", () => {
    expect(shippingNotice(shopNoon(2026, 11, 18))).toBeNull();
    expect(shippingNotice(shopNoon(2026, 11, 19))?.state).toBe("open");
  });

  it("counts down over the last three days", () => {
    expect(shippingNotice(shopNoon(2026, 12, 6))?.state).toBe("open");
    expect(shippingNotice(shopNoon(2026, 12, 7))?.headline).toBe(
      "3 days left to order for Christmas delivery"
    );
    expect(shippingNotice(shopNoon(2026, 12, 9))?.headline).toBe(
      "1 day left to order for Christmas delivery"
    );
    expect(shippingNotice(shopNoon(2026, 12, 10))?.headline).toBe(
      "Today is the last day to order for Christmas delivery"
    );
  });

  it("drops to the optimistic date once the safe one has gone", () => {
    const notice = shippingNotice(shopNoon(2026, 12, 11));
    expect(notice?.state).toBe("late");
    expect(notice?.detail).toContain("December 17");
    // "can still arrive", not "often": it is the best case, not a typical one.
    expect(notice?.detail).toContain("can still arrive");
    expect(notice?.detail).not.toContain("often");
  });

  it("goes silent once even the optimistic date has passed", () => {
    expect(shippingNotice(shopNoon(2026, 12, 17))?.state).toBe("late");
    expect(shippingNotice(shopNoon(2026, 12, 18))).toBeNull();
    expect(shippingNotice(shopNoon(2026, 12, 25))).toBeNull();
    expect(shippingNotice(shopNoon(2026, 12, 26))).toBeNull();
  });

  it("always names the date it is counting to", () => {
    const notice = shippingNotice(shopNoon(2026, 12, 1));
    expect(notice?.headline).toContain("December 10");
    expect(toISODate(notice!.cutoff)).toBe("2026-12-10");
  });

  /*
    This copy renders in the sitewide banner, which has no product to gate on, so it must
    not carry a claim that is only true of wrapping paper. The catalog includes apparel from
    other providers and one Canva download that ships from nowhere.
  */
  it("never makes a wrapping-paper-only claim in sitewide copy", () => {
    for (let day = 19; day <= 51; day += 1) {
      const date = addDays({ year: 2026, month: 11, day: 19 }, day - 19);
      const notice = shippingNotice(shopNoon(date.year, date.month, date.day));
      if (!notice) continue;
      const copy = `${notice.headline} ${notice.detail}`;
      expect(copy, toISODate(date)).not.toContain("Norcross");
      expect(copy, toISODate(date)).not.toContain("Made to order");
      expect(notice.detail, toISODate(date)).toContain("Other items and digital downloads vary");
    }
  });

  /*
    The deadline is later than the processing window the product page and the FAQ quote, so
    every state has to name the pace it assumes. Without this the disclosure can be deleted
    and the banner ships an unexplained date on green CI.
  */
  it("says what the deadline assumes, in every state", () => {
    const seen = new Set<string>();
    for (let offset = 0; offset <= 32; offset += 1) {
      const date = addDays({ year: 2026, month: 11, day: 19 }, offset);
      const notice = shippingNotice(shopNoon(date.year, date.month, date.day));
      if (!notice) continue;
      const where = `${toISODate(date)} (${notice.state})`;
      seen.add(notice.state);
      expect(notice.detail, where).toContain("the shop allows for");
      if (notice.state !== "late") {
        expect(notice.detail, where).toContain("current production pace");
      }
    }
    expect([...seen].sort()).toEqual(["last-call", "late", "open"]);
  });

  it("reads the date in the shop's timezone rather than UTC", () => {
    // 2026-12-11 01:00 UTC is 2026-12-10 20:00 Eastern, still the cutoff day.
    expect(shippingNotice(new Date("2026-12-11T01:00:00Z"))?.headline).toBe(
      "Today is the last day to order for Christmas delivery"
    );
    // One minute before midnight Eastern on the cutoff it is still the last day.
    expect(shippingNotice(new Date("2026-12-11T04:59:00Z"))?.state).toBe("last-call");
    // One minute after, it is not.
    expect(shippingNotice(new Date("2026-12-11T05:01:00Z"))?.state).toBe("late");
  });

  it("never reports a headline that disagrees with its own state", () => {
    const seen = { open: 0, "last-call": 0, late: 0 };
    for (let day = 10; day <= 50; day += 1) {
      const date = addDays({ year: 2026, month: 11, day: 10 }, day - 10);
      const notice = shippingNotice(shopNoon(date.year, date.month, date.day));
      if (!notice) continue;
      const where = toISODate(date);
      seen[notice.state] += 1;

      if (notice.state === "last-call") {
        expect(notice.daysLeft, where).toBeGreaterThanOrEqual(0);
        if (notice.daysLeft > 0) expect(notice.headline, where).toContain(String(notice.daysLeft));
        else expect(notice.headline, where).toContain("last day");
      } else if (notice.state === "open") {
        expect(notice.daysLeft, where).toBeGreaterThan(0);
        expect(notice.headline, where).toContain(notice.cutoffLabel);
      } else {
        expect(notice.daysLeft, where).toBeLessThan(0);
        expect(notice.detail, where).toContain(notice.lastChanceLabel);
      }
    }
    // Every state has to be reachable, or the loop proved nothing about the ones it missed.
    expect(seen.open).toBeGreaterThan(0);
    expect(seen["last-call"]).toBe(4);
    expect(seen.late).toBeGreaterThan(0);
  });
});
