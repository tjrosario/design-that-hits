/**
 * components/ThemeScript.tsx
 *
 * Applies the saved theme and the current seasonal palette to <html> before the browser
 * paints anything.
 *
 * WHY A SCRIPT AND NOT REACT STATE:
 * The server cannot know which theme a visitor chose — that lives in their localStorage.
 * Applying it in an effect would paint the default theme first and then snap to the
 * chosen one: the classic flash of wrong theme. A synchronous script in <head> sets the
 * attribute during HTML parsing, before first paint.
 *
 * WHY THE SEASON IS SET HERE TOO:
 * Every page but `/` is prerendered or revalidated on a window of up to 24 hours, so a
 * season rendered on the server would be baked into the HTML and could be a day or more
 * out of date. Reading the clock in this script instead means the palette is correct on
 * the first frame of a page that was built weeks ago, which is the same reason
 * components/layout/ShippingNotice.tsx returns null from its server snapshot.
 *
 * WHY A TABLE AND NOT THE RULES:
 * The script is handed a list of the dates the palette changes on, not a copy of the
 * holiday arithmetic, so lib/season.ts stays the only implementation of it. A year is
 * about thirty rows.
 *
 * WHY A RAW <script> AND NOT next/script:
 * `next/script` with strategy="beforeInteractive" looks like the right tool, and the App
 * Router docs point at it, but it does not emit an inline script. It serialises the body
 * into a `self.__next_s` queue that Next's own deferred bundle executes later — after
 * first paint. Measured on this app: the queue entry lands at byte ~5.4k of the HTML but
 * only runs once the framework bundle boots, which would give every light-theme visitor
 * a dark flash on load. A raw inline tag is the only thing that runs during parse, which
 * is why every theming library does it this way.
 *
 * React logs a dev-only advisory that "scripts inside React components are never
 * executed when rendering on the client". That is accurate and harmless here: this only
 * ever needs to run on the initial document load, never during client-side navigation.
 * The same advisory covers components/JsonLd.tsx, which emits structured-data scripts
 * for the same server-only reason.
 *
 * The only thing interpolated into the body is the schedule, which this module builds
 * itself out of integers and a fixed set of slugs. No user or request data reaches it.
 *
 * Dark is the default, per the design direction. A visitor who has never chosen gets
 * dark regardless of their OS setting; once they pick, their choice wins everywhere.
 */

import { seasonSchedule } from "@/lib/season";
import { dateKey, SHOP_TIME_ZONE, shopToday } from "@/lib/shop-time";

export const THEME_STORAGE_KEY = "dth-theme";

/*
  Two years from the start of the current one. A deploy is never more than a few hours
  behind the catalog sync, so this is generous.
*/
const SCHEDULE_YEARS = 2;

const literalByYear = new Map<number, string>();

/**
 * `[[20261105,"fall","thanksgiving"], ..., [20280101,null,null]]` for the inline script.
 *
 * The last row is a sentinel with no season: the script's scan lands on it once the table
 * has run out, which is how it knows to stop trusting the table rather than pinning the
 * final holiday forever.
 *
 * Memoised by year. Building a schedule walks two years of the holiday rules, and this is
 * called from the root layout, so every page of a build would otherwise pay for it.
 */
export function scheduleLiteral(fromYear: number): string {
  const cached = literalByYear.get(fromYear);
  if (cached !== undefined) return cached;

  const rows: (number | string | null)[][] = seasonSchedule(fromYear, SCHEDULE_YEARS).map((t) => [
    t.from,
    t.season,
    t.holiday,
  ]);
  rows.push([dateKey({ year: fromYear + SCHEDULE_YEARS, month: 1, day: 1 }), null, null]);

  const literal = JSON.stringify(rows);
  literalByYear.set(fromYear, literal);
  return literal;
}

/** The inline script's source. Exported so a test can run the real thing. */
export function themeScriptBody(schedule: string): string {
  return `
(function () {
  var el = document.documentElement;
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    // Anything other than an explicit 'light' resolves to dark, so a corrupted or
    // unexpected value fails safe to the design's default rather than throwing.
    el.setAttribute('data-theme', stored === 'light' ? 'light' : 'dark');
  } catch (e) {
    el.setAttribute('data-theme', 'dark');
  }
  try {
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: '${SHOP_TIME_ZONE}', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    var get = function (type) {
      for (var i = 0; i < parts.length; i++) if (parts[i].type === type) return parts[i].value;
      return '';
    };
    var today = +(get('year') + get('month') + get('day'));
    var schedule = ${schedule};
    var row = null;
    for (var j = 0; j < schedule.length; j++) if (schedule[j][0] <= today) row = schedule[j];
    // No row, or the sentinel past the end of the table: the month alone still gives a
    // season, which is better than pinning whichever holiday the table ended on.
    if (!row || !row[1]) {
      var m = +get('month');
      row = [0, m > 2 && m < 6 ? 'spring' : m > 5 && m < 9 ? 'summer' : m > 8 && m < 12 ? 'fall' : 'winter', null];
    }
    el.setAttribute('data-season', row[1]);
    if (row[2]) el.setAttribute('data-holiday', row[2]);
    else el.removeAttribute('data-holiday');
  } catch (e) {}
})();
`;
}

export function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: themeScriptBody(scheduleLiteral(shopToday(new Date()).year)) }}
    />
  );
}
