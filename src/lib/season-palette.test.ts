import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { holidayIds } from "@/lib/season";
import { scheduleLiteral } from "@/components/ThemeScript";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

const SEASONS = ["spring", "summer", "fall", "winter"];

interface PaletteBlock {
  light: boolean;
  kind: "season" | "holiday";
  id: string;
  index: number;
  tokens: Record<string, string>;
}

function paletteBlocks(): PaletteBlock[] {
  const pattern =
    /:root(\[data-theme="light"\])?\[data-(season|holiday)="([a-z-]+)"\]\s*\{([^}]*)\}/g;
  const blocks: PaletteBlock[] = [];
  for (let match = pattern.exec(css); match; match = pattern.exec(css)) {
    const tokens: Record<string, string> = {};
    for (const line of match[4].split(";")) {
      const [name, value] = line.split(":").map((part) => part.trim());
      if (name?.startsWith("--")) tokens[name] = value;
    }
    blocks.push({
      light: Boolean(match[1]),
      kind: match[2] as "season" | "holiday",
      id: match[3],
      index: match.index,
      tokens,
    });
  }
  return blocks;
}

const blocks = paletteBlocks();

const channel = (hex: string) => {
  const value = Number.parseInt(hex, 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance of a `#RRGGBB` string. */
function luminance(hex: string): number {
  const clean = hex.replace("#", "");
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
  });

  it("gives every block the full accent set", () => {
    const required = ["--brand", "--brand-strong", "--brand-soft", "--brand-ink", "--brand-wash"];
    for (const block of blocks) {
      for (const token of required) {
        expect(block.tokens[token], `${block.id} ${token}`).toBeTruthy();
      }
    }
  });

  /*
    The CTA is brand-coloured with brand-ink text on it, so this ratio is the difference
    between a readable button and an invisible one. Hand-editing a hex here is exactly how
    that regresses, which is why this reparses the stylesheet rather than a copy in TS.
  */
  it("keeps the label on a brand button readable in every palette", () => {
    const failures = blocks
      .map((block) => ({
        name: `${block.light ? "light" : "dark"} ${block.id}`,
        ratio: contrast(block.tokens["--brand"], block.tokens["--brand-ink"]),
      }))
      .filter((result) => result.ratio < 4.5);
    expect(failures).toEqual([]);
  });

  it("separates brand from brand-strong enough for the gradient to read", () => {
    for (const block of blocks) {
      const ratio = contrast(block.tokens["--brand"], block.tokens["--brand-strong"]);
      expect(ratio, `${block.id} brand vs brand-strong`).toBeGreaterThan(1.15);
    }
  });

  /*
    A holiday block and a season block are both one attribute deep, so nothing but source
    order makes the holiday win. Same for a light variant over its dark counterpart, which
    carries one attribute more but must still follow it.
  */
  it("orders the blocks so holiday beats season and light beats dark", () => {
    const lastSeason = Math.max(...blocks.filter((b) => b.kind === "season" && !b.light).map((b) => b.index));
    const firstHoliday = Math.min(...blocks.filter((b) => b.kind === "holiday" && !b.light).map((b) => b.index));
    expect(firstHoliday).toBeGreaterThan(lastSeason);

    const lastDark = Math.max(...blocks.filter((b) => !b.light).map((b) => b.index));
    const firstLight = Math.min(...blocks.filter((b) => b.light).map((b) => b.index));
    expect(firstLight).toBeGreaterThan(lastDark);
  });
});

describe("the schedule inlined into the head", () => {
  it("starts on January 1 of the year it is built for", () => {
    const rows = JSON.parse(scheduleLiteral(2026));
    expect(rows[0][0]).toBe(20260101);
  });

  it("carries only known seasons and holidays", () => {
    const rows: [number, string, string | null][] = JSON.parse(scheduleLiteral(2026));
    for (const [, season, holiday] of rows) {
      expect(SEASONS).toContain(season);
      if (holiday !== null) expect(holidayIds()).toContain(holiday);
    }
  });

  /* It is interpolated into an inline <script>, so it must not be able to close the tag. */
  it("cannot break out of the script tag", () => {
    const literal = scheduleLiteral(2026);
    expect(literal).not.toMatch(/<\/script/i);
    expect(literal).not.toContain("<!--");
  });
});
