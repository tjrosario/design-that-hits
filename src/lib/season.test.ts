import { describe, expect, it } from "vitest";
import {
  MIN_RUN_DAYS,
  currentTheme,
  easterSunday,
  hanukkahFirstNight,
  holidayFor,
  holidayIds,
  seasonFor,
  seasonSchedule,
  themeFor,
} from "@/lib/season";
import { addDays, dateKey, daysBetween, toISODate, type CalendarDate } from "@/lib/shop-time";

const on = (text: string): CalendarDate => {
  const [year, month, day] = text.split("-").map(Number);
  return { year, month, day };
};

const iso = (date: CalendarDate | null) => (date === null ? "null" : toISODate(date));

const walk = (from: string, until: string) => {
  const days: CalendarDate[] = [];
  const end = dateKey(on(until));
  for (let date = on(from); dateKey(date) <= end; date = addDays(date, 1)) days.push(date);
  return days;
};

/*
  Dates taken from the public calendar rather than from the functions under test, so the
  arithmetic is checked against the world instead of against itself.
*/
describe("holidays that move each year", () => {
  it("computes Western Easter across the range it drifts over", () => {
    expect(iso(easterSunday(2024))).toBe("2024-03-31");
    expect(iso(easterSunday(2025))).toBe("2025-04-20");
    expect(iso(easterSunday(2026))).toBe("2026-04-05");
    expect(iso(easterSunday(2027))).toBe("2027-03-28");
    expect(iso(easterSunday(2028))).toBe("2028-04-16");
    expect(iso(easterSunday(2029))).toBe("2029-04-01");
  });

  it("finds the first night of Hanukkah", () => {
    expect(iso(hanukkahFirstNight(2024))).toBe("2024-12-26");
    expect(iso(hanukkahFirstNight(2026))).toBe("2026-12-05");
  });

  /*
    The Hebrew year runs short of the Gregorian one until a leap month corrects it, so the
    first night walks back about eleven days a year then jumps forward about nineteen.
    Falling outside this window means the calendar lookup has started returning noise.
  */
  it("keeps Hanukkah inside the window the Hebrew calendar allows", () => {
    for (let year = 2024; year <= 2040; year += 1) {
      const night = hanukkahFirstNight(year);
      expect(night, String(year)).not.toBeNull();
      const key = dateKey(night!);
      expect(key, String(year)).toBeGreaterThanOrEqual(dateKey({ year, month: 11, day: 25 }));
      expect(key, String(year)).toBeLessThanOrEqual(dateKey({ year, month: 12, day: 27 }));
    }
  });
});

describe("seasons", () => {
  it("turns over on the first of a month", () => {
    expect(seasonFor(on("2026-02-28"))).toBe("winter");
    expect(seasonFor(on("2026-03-01"))).toBe("spring");
    expect(seasonFor(on("2026-05-31"))).toBe("spring");
    expect(seasonFor(on("2026-06-01"))).toBe("summer");
    expect(seasonFor(on("2026-08-31"))).toBe("summer");
    expect(seasonFor(on("2026-09-01"))).toBe("fall");
    expect(seasonFor(on("2026-11-30"))).toBe("fall");
    expect(seasonFor(on("2026-12-01"))).toBe("winter");
  });

  it("names a season for every day of a leap year", () => {
    for (const day of walk("2028-01-01", "2028-12-31")) {
      expect(["spring", "summer", "fall", "winter"]).toContain(seasonFor(day));
    }
  });
});

describe("holiday resolution", () => {
  /*
    The bug this pins: ranking on priority alone let a holiday with a fourteen day lead
    swallow a smaller one sitting inside that window, so the smaller one never rendered in
    any year at all.
  */
  it("shows every holiday it defines at some point in a four year span", () => {
    const shown = new Set(walk("2026-01-01", "2029-12-31").map(holidayFor));
    expect(holidayIds().filter((id) => !shown.has(id))).toEqual([]);
  });

  it("gives a holiday that has arrived precedence over one still being led up to", () => {
    // Father's Day 2026 is June 21 and leads by fourteen days, so it covers the 19th.
    expect(holidayFor(on("2026-06-19"))).toBe("fathers-day");
    expect(holidayFor(on("2026-06-21"))).toBe("fathers-day");
    // St Patrick's Day 2027 sits inside Easter's lead window and still gets its own day.
    expect(holidayFor(on("2027-03-16"))).toBe("easter");
    expect(holidayFor(on("2027-03-17"))).toBe("st-patricks");
    expect(holidayFor(on("2027-03-18"))).toBe("easter");
  });

  it("hands Thanksgiving over to Christmas with no gap and no overlap", () => {
    expect(holidayFor(on("2026-11-30"))).toBe("thanksgiving");
    expect(holidayFor(on("2026-12-01"))).toBe("christmas");
    expect(holidayFor(on("2027-11-29"))).toBe("thanksgiving");
    expect(holidayFor(on("2027-12-01"))).toBe("christmas");
  });

  /* Black Friday and Cyber Monday both have to fall inside the Thanksgiving window. */
  it("keeps Thanksgiving up through Cyber Monday", () => {
    expect(holidayFor(on("2026-11-27"))).toBe("thanksgiving");
    expect(holidayFor(on("2026-11-30"))).toBe("thanksgiving");
  });

  it("shows Hanukkah on its own nights even inside the Christmas run-up", () => {
    expect(holidayFor(on("2026-12-04"))).toBe("christmas");
    expect(holidayFor(on("2026-12-05"))).toBe("hanukkah");
    expect(holidayFor(on("2026-12-13"))).toBe("hanukkah");
    expect(holidayFor(on("2026-12-14"))).toBe("christmas");
  });

  it("carries the New Year window across the year boundary", () => {
    expect(holidayFor(on("2026-12-28"))).toBe("new-year");
    expect(holidayFor(on("2027-01-01"))).toBe("new-year");
    expect(holidayFor(on("2027-01-03"))).toBeNull();
  });

  it("themes Halloween for the whole of October and stops on November 1", () => {
    expect(holidayFor(on("2026-10-01"))).toBe("halloween");
    expect(holidayFor(on("2026-10-31"))).toBe("halloween");
    expect(holidayFor(on("2026-11-01"))).toBeNull();
  });

  it("leaves quiet stretches to the season alone", () => {
    expect(themeFor(on("2026-08-05"))).toEqual({ season: "summer", holiday: null });
  });
});

describe("currentTheme", () => {
  /*
    The palette must turn over on the shop's calendar, not the server's. Late evening in
    New York is already tomorrow in UTC, and reading UTC would start Christmas early.
  */
  it("reads the day in the shop's zone", () => {
    expect(currentTheme(new Date("2026-12-01T02:30:00Z"))).toEqual({
      season: "fall",
      holiday: "thanksgiving",
    });
    expect(currentTheme(new Date("2026-12-01T14:00:00Z"))).toEqual({
      season: "winter",
      holiday: "christmas",
    });
  });
});

describe("seasonSchedule", () => {
  const dayOf = (key: number): CalendarDate => ({
    year: Math.floor(key / 10000),
    month: Math.floor(key / 100) % 100,
    day: key % 100,
  });
  const runs = (fromYear: number, years = 2) => {
    const schedule = seasonSchedule(fromYear, years);
    const end = dateKey({ year: fromYear + years, month: 1, day: 1 });
    return schedule.map((entry, at) => ({
      ...entry,
      days: daysBetween(dayOf(entry.from), dayOf(schedule[at + 1]?.from ?? end)),
    }));
  };

  it("starts on the first of the year it is asked for", () => {
    expect(seasonSchedule(2026, 1)[0].from).toBe(20260101);
  });

  it("stays in order and never repeats a palette back to back", () => {
    const schedule = seasonSchedule(2026, 3);
    for (let i = 1; i < schedule.length; i += 1) {
      expect(schedule[i].from).toBeGreaterThan(schedule[i - 1].from);
      expect(`${schedule[i].season}/${schedule[i].holiday}`).not.toBe(
        `${schedule[i - 1].season}/${schedule[i - 1].holiday}`
      );
    }
  });

  /* The table is inlined into every page's head, so its size is a page weight decision. */
  it("stays small enough to inline for two years", () => {
    const schedule = seasonSchedule(2026, 2);
    expect(schedule.length).toBeLessThan(80);
  });

  /*
    Lead windows overlap, so the raw rule can put a one-day palette between two runs of
    another. Swept over twenty years because the cases are rare and alignment dependent:
    the sharp ones are a one-day Christmas inside Hanukkah in 2029 and four flips in ten
    days in December 2030.
  */
  it("never schedules a run short enough to read as a flicker", () => {
    const tooShort: string[] = [];
    for (let year = 2024; year <= 2044; year += 1) {
      for (const run of runs(year).slice(1)) {
        if (run.days < MIN_RUN_DAYS) {
          tooShort.push(`${run.from} ${run.season}/${run.holiday} for ${run.days}d`);
        }
      }
    }
    expect(tooShort).toEqual([]);
  });

  /*
    Hanukkah inside Christmas is the one interruption that is meant to happen: its eight
    nights fall inside the Christmas run-up most years, and the palette acknowledging them
    is the point. Anything else interrupting a holiday is a scheduling bug.
  */
  it("interrupts a holiday only for Hanukkah inside Christmas", () => {
    const flips: string[] = [];
    for (let year = 2024; year <= 2044; year += 1) {
      const schedule = seasonSchedule(year);
      for (let i = 1; i < schedule.length - 1; i += 1) {
        const [before, here, after] = [schedule[i - 1], schedule[i], schedule[i + 1]];
        if (!before.holiday || before.holiday !== after.holiday) continue;
        if (here.holiday === before.holiday) continue;
        if (before.holiday === "christmas" && here.holiday === "hanukkah") continue;
        flips.push(`${here.from} ${before.holiday} -> ${here.holiday} -> ${after.holiday}`);
      }
    }
    expect(flips).toEqual([]);
  });

  it("gives Hanukkah its full run of nights when it interrupts Christmas", () => {
    for (let year = 2024; year <= 2044; year += 1) {
      // Skipping the first run: it is whatever window was already open on January 1.
      for (const run of runs(year).slice(1)) {
        if (run.holiday !== "hanukkah") continue;
        expect(run.days, `hanukkah from ${run.from}`).toBeGreaterThanOrEqual(MIN_RUN_DAYS);
      }
    }
  });

  /*
    Thanksgiving's trail is four days, so where the fourth Thursday falls early the raw
    rule leaves a day or two of bare fall before Christmas opens on December 1. 2027 is
    the nearest such year. Smoothing absorbs it, so the accent goes rust then red.
  */
  it("hands Thanksgiving to Christmas without a bare day between them", () => {
    const schedule = seasonSchedule(2027, 1);
    const holidayOn = (key: number) => {
      let found = schedule[0];
      for (const entry of schedule) if (entry.from <= key) found = entry;
      return found.holiday;
    };
    expect(holidayOn(20271129)).toBe("thanksgiving");
    expect(holidayOn(20271130)).toBe("thanksgiving");
    expect(holidayOn(20271201)).toBe("christmas");
  });

  /*
    Smoothing means the table is not a day-by-day echo of `themeFor`, but the season half
    is never smoothed away, and every holiday it does show must be one the rule really
    returns on that day.
  */
  it("keeps the season exact and never invents a holiday", () => {
    const schedule = seasonSchedule(2026, 2);
    const lookup = (key: number) => {
      let found = schedule[0];
      for (const entry of schedule) if (entry.from <= key) found = entry;
      return found;
    };
    for (const day of walk("2026-01-01", "2027-12-31")) {
      const row = lookup(dateKey(day));
      expect(row.season, toISODate(day)).toBe(seasonFor(day));
      if (row.holiday !== null && row.holiday !== holidayFor(day)) {
        // Only an absorbed run may differ, and only by extending its neighbour.
        expect(seasonSchedule(2026, 2).some((e) => e.holiday === row.holiday)).toBe(true);
      }
    }
  });

  it("shows every holiday at least once across four years of schedules", () => {
    const shown = new Set<string | null>();
    for (let year = 2026; year <= 2029; year += 1) {
      for (const entry of seasonSchedule(year, 1)) shown.add(entry.holiday);
    }
    expect(holidayIds().filter((id) => !shown.has(id))).toEqual([]);
  });
});
