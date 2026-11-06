import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { holidayIds, seasonFor, seasonSchedule } from "@/lib/season";
import { scheduleLiteral, themeScriptBody } from "@/components/ThemeScript";
import { dateKey, shopToday } from "@/lib/shop-time";

/*
  Comments are stripped first. A declaration that follows one on the same chunk would
  otherwise be parsed as part of the comment text and silently vanish from the tokens,
  which is how an earlier version of this test read no --bg at all.
*/
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  ""
);

const SEASONS = ["spring", "summer", "fall", "winter"];

function tokensIn(block: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const line of block.split(";")) {
    const at = line.indexOf(":");
    if (at === -1) continue;
    const name = line.slice(0, at).trim();
    if (name.startsWith("--")) tokens[name] = line.slice(at + 1).trim();
  }
  return tokens;
}

/** The two base blocks, which supply the backgrounds a palette is measured against. */
function baseTokens(light: boolean): Record<string, string> {
  const pattern = light
    ? /:root\[data-theme="light"\]\s*\{([\s\S]*?)\n  \}/
    : /:root\s*\{([\s\S]*?)\n  \}/;
  const match = css.match(pattern);
  if (!match) throw new Error(`no base block for ${light ? "light" : "dark"}`);
  return tokensIn(match[1]);
}

interface PaletteBlock {
  light: boolean;
  kind: "season" | "holiday";
  id: string;
  index: number;
  tokens: Record<string, string>;
}

const blocks: PaletteBlock[] = (() => {
  const pattern =
    /:root(\[data-theme="light"\])?\[data-(season|holiday)="([a-z-]+)"\]\s*\{([^}]*)\}/g;
  const found: PaletteBlock[] = [];
  for (let match = pattern.exec(css); match; match = pattern.exec(css)) {
    found.push({
      light: Boolean(match[1]),
      kind: match[2] as "season" | "holiday",
      id: match[3],
      index: match.index,
      tokens: tokensIn(match[4]),
    });
  }
  return found;
})();

const channel = (pair: string) => {
  const value = Number.parseInt(pair, 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

function luminance(hex: string): number {
  const clean = hex.replace("#", "").trim();
  return (
    0.2126 * channel(clean.slice(0, 2)) +
    0.7152 * channel(clean.slice(2, 4)) +
    0.0722 * channel(clean.slice(4, 6))
  );
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const AA = 4.5;

describe("seasonal palettes in globals.css", () => {
  it("defines a dark and a light block for every season and holiday", () => {
    const wanted = [
      ...SEASONS.map((id) => ["season", id] as const),
      ...holidayIds().map((id) => ["holiday", id] as const),
    ];
    for (const [kind, id] of wanted) {
      for (const light of [false, true]) {
        const found = blocks.find((b) => b.kind === kind && b.id === id && b.light === light);
        expect(found, `${light ? "light" : "dark"} ${kind} ${id}`).toBeDefined();
      }
    }
    expect(blocks).toHaveLength((SEASONS.length + holidayIds().length) * 2);
  });

  it("gives every block the full accent set", () => {
    const required = [
      "--brand",
      "--brand-strong",
      "--brand-soft",
      "--brand-ink",
      "--brand-on-light",
      "--brand-wash",
    ];
    for (const block of blocks) {
      for (const token of required) {
        expect(block.tokens[token], `${block.id} ${token}`).toBeTruthy();
      }
    }
  });

  /*
    Every pair that actually gets painted together, because checking only one of them is
    how the first version of this shipped a near-black label onto a near-black gradient:

      --brand-ink  over var(--gradient-brand), which spans --brand to --brand-strong, so
                   BOTH ends carry the label: .btn-cta, .nav-pill-link[aria-current] and
                   the copy on the closing .brand-band
      --brand      as text in .display-accent and as the focus-visible outline, over
                   --bg and over --surface
      --brand-on-light  anything on a white face: the collection tile count chip and
                   .btn-on-brand
  */
  it("keeps every painted pair readable in every palette", () => {
    const failures: string[] = [];
    for (const block of blocks) {
      const base = baseTokens(block.light);
      const name = `${block.light ? "light" : "dark"} ${block.id}`;
      const pairs: [string, string, string][] = [
        ["ink on the bright end of the brand gradient", block.tokens["--brand"], block.tokens["--brand-ink"]],
        [
          "ink on the dark end of the brand gradient",
          block.tokens["--brand-strong"],
          block.tokens["--brand-ink"],
        ],
        ["brand as text on the page", block.tokens["--brand"], base["--bg"]],
        ["brand as text on a card", block.tokens["--brand"], base["--surface"]],
        ["brand on a white face", block.tokens["--brand-on-light"], "#FFFFFF"],
      ];
      for (const [what, a, b] of pairs) {
        const ratio = contrast(a, b);
        if (ratio < AA) failures.push(`${name}: ${what} is ${ratio.toFixed(2)}:1`);
      }
    }
    expect(failures).toEqual([]);
  });

  /*
    Measured as a plain channel distance, not as contrast: Christmas runs red to green,
    which reads as a gradient while sitting at almost the same luminance.
  */
  it("keeps the gradient's two ends visibly different", () => {
    for (const block of blocks) {
      const [a, b] = [block.tokens["--brand"], block.tokens["--brand-strong"]].map((hex) =>
        [0, 2, 4].map((at) => Number.parseInt(hex.replace("#", "").slice(at, at + 2), 16))
      );
      const distance = Math.max(...a.map((channelValue, at) => Math.abs(channelValue - b[at])));
      expect(distance, `${block.id} brand vs brand-strong`).toBeGreaterThan(30);
    }
  });

  /*
    A holiday block and a season block are the same specificity, so only source order
    makes the holiday win. That holds separately within the dark half and within the light
    half: a light season block placed after the light holidays would silently flatten
    every holiday in that theme.
  */
  it("orders the blocks so holiday beats season, in both themes", () => {
    for (const light of [false, true]) {
      const half = blocks.filter((b) => b.light === light);
      const lastSeason = Math.max(...half.filter((b) => b.kind === "season").map((b) => b.index));
      const firstHoliday = Math.min(
        ...half.filter((b) => b.kind === "holiday").map((b) => b.index)
      );
      expect(firstHoliday, light ? "light half" : "dark half").toBeGreaterThan(lastSeason);
    }

    const lastDark = Math.max(...blocks.filter((b) => !b.light).map((b) => b.index));
    const firstLight = Math.min(...blocks.filter((b) => b.light).map((b) => b.index));
    expect(firstLight).toBeGreaterThan(lastDark);
  });
});

/**
 * Runs the real inline script against a stub document, which is the only way to cover the
 * code that actually applies a palette in a browser.
 */
function runScript(nowIso: string, fromYear: number, stored: string | null = null) {
  const attributes: Record<string, string> = {};
  const RealDate = Date;
  class FixedDate extends RealDate {
    constructor(...args: unknown[]) {
      super(...((args.length ? args : [nowIso]) as []));
    }
  }
  const documentStub = {
    documentElement: {
      setAttribute: (key: string, value: string) => {
        attributes[key] = value;
      },
      removeAttribute: (key: string) => {
        delete attributes[key];
      },
    },
  };
  const storageStub = { getItem: () => stored };

  // Parameters shadow the globals the script reads, so nothing here touches the real ones.
  new Function("document", "localStorage", "Date", themeScriptBody(scheduleLiteral(fromYear)))(
    documentStub,
    storageStub,
    FixedDate
  );
  return attributes;
}

describe("the inline script that applies the palette", () => {
  it("sets the theme and the palette for the day", () => {
    expect(runScript("2026-11-06T16:00:00Z", 2026)).toEqual({
      "data-theme": "dark",
      "data-season": "fall",
      "data-holiday": "thanksgiving",
    });
  });

  it("drops data-holiday on a day that only has a season", () => {
    expect(runScript("2026-08-05T16:00:00Z", 2026)).toEqual({
      "data-theme": "dark",
      "data-season": "summer",
    });
  });

  it("honours a stored light theme without disturbing the palette", () => {
    expect(runScript("2026-11-06T16:00:00Z", 2026, "light")["data-theme"]).toBe("light");
    expect(runScript("2026-11-06T16:00:00Z", 2026, "nonsense")["data-theme"]).toBe("dark");
  });

  /*
    The palette turns over on the shop's calendar. 02:30 UTC on December 1 is still
    November 30 in New York, so Christmas must not start a day early.
  */
  it("reads the day in the shop's zone", () => {
    expect(runScript("2026-12-01T02:30:00Z", 2026)["data-holiday"]).toBe("thanksgiving");
    expect(runScript("2026-12-01T14:00:00Z", 2026)["data-holiday"]).toBe("christmas");
  });

  /*
    The schedule is built from the shop's year, not the UTC year. Late on New Year's Eve
    those disagree, and taking the UTC year built a table that began after the day being
    rendered, which dropped the palette to the bare fallback on the evening it matters.
  */
  it("still has a schedule covering New Year's Eve in the shop's zone", () => {
    const eve = new Date("2027-01-01T03:00:00Z");
    expect(shopToday(eve)).toEqual({ year: 2026, month: 12, day: 31 });
    expect(runScript(eve.toISOString(), shopToday(eve).year)).toEqual({
      "data-theme": "dark",
      "data-season": "winter",
      "data-holiday": "new-year",
    });
  });

  /*
    Past the end of the table the script must fall back to the season the month implies.
    Pinning the last row instead would leave a page served from a long-lived cache showing
    whichever holiday the schedule happened to end on, for as long as it was cached.
  */
  it("falls back to the month once the schedule runs out", () => {
    const attributes = runScript("2028-07-04T16:00:00Z", 2026);
    expect(attributes["data-season"]).toBe("summer");
    expect(attributes["data-holiday"]).toBeUndefined();
  });

  /*
    The script is compared against the schedule it was handed, because the schedule
    absorbs short runs and so is deliberately not a day-by-day echo of `themeFor`. The
    season half is never smoothed, so that is still checked against the rule itself.
  */
  it("agrees with the schedule it was given, in every month of its range", () => {
    const schedule = seasonSchedule(2026, 2);
    const lookup = (key: number) => {
      let found = schedule[0];
      for (const entry of schedule) if (entry.from <= key) found = entry;
      return found;
    };
    for (let month = 1; month <= 12; month += 1) {
      for (const year of [2026, 2027]) {
        const iso = `${year}-${String(month).padStart(2, "0")}-15T16:00:00Z`;
        const attributes = runScript(iso, 2026);
        const day = shopToday(new Date(iso));
        const row = lookup(dateKey(day));
        expect(
          { season: attributes["data-season"], holiday: attributes["data-holiday"] ?? null },
          iso
        ).toEqual({ season: row.season, holiday: row.holiday });
        expect(attributes["data-season"], iso).toBe(seasonFor(day));
      }
    }
  });
});

describe("the schedule inlined into the head", () => {
  it("starts on January 1 of the year it is built for", () => {
    expect(JSON.parse(scheduleLiteral(2026))[0][0]).toBe(20260101);
  });

  it("ends with a sentinel the script can recognise", () => {
    const rows = JSON.parse(scheduleLiteral(2026));
    expect(rows[rows.length - 1]).toEqual([20280101, null, null]);
  });

  it("carries only known seasons and holidays", () => {
    const rows: [number, string | null, string | null][] = JSON.parse(scheduleLiteral(2026));
    for (const [, season, holiday] of rows.slice(0, -1)) {
      expect(SEASONS).toContain(season);
      if (holiday !== null) expect(holidayIds()).toContain(holiday);
    }
  });

  /* It is inlined into every page's head, so its size is a page weight decision. */
  it("stays small enough to inline", () => {
    expect(scheduleLiteral(2026).length).toBeLessThan(3000);
  });
});
