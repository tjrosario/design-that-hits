import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { holidayIds } from "@/lib/season";
import {
  STORY_BG,
  STORY_PALETTES,
  STORY_TEXT,
  paletteFor,
  type PaletteId,
} from "@/lib/story-palette";

/*
  The point of this file. `story-palette.ts` is a hand copy of the stylesheet's dark
  blocks, because satori cannot read a custom property, and a copy with no check is a copy
  that goes stale the first time a palette is retuned. Comments are stripped first for the
  reason season-palette.test.ts gives: a declaration sharing a chunk with one is otherwise
  swallowed.
*/
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  ""
);

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

/** The dark block for one season or holiday, which is the one with no `data-theme` prefix. */
function darkBlock(id: string): Record<string, string> {
  const pattern = new RegExp(`:root\\[data-(?:season|holiday)="${id}"\\]\\s*\\{([^}]*)\\}`);
  const match = css.match(pattern);
  if (!match) throw new Error(`no dark block for ${id}`);
  return tokensIn(match[1]);
}

const SEASONS = ["spring", "summer", "fall", "winter"] as const;
const ids: PaletteId[] = [...SEASONS, ...holidayIds()];

describe("story palette", () => {
  it("covers every season and holiday the calendar can theme", () => {
    expect(Object.keys(STORY_PALETTES).sort()).toEqual([...ids].sort());
  });

  it.each(ids)("matches the dark %s block in globals.css", (id) => {
    const tokens = darkBlock(id);
    expect(STORY_PALETTES[id]).toEqual({
      brand: tokens["--brand"],
      strong: tokens["--brand-strong"],
      soft: tokens["--brand-soft"],
      ink: tokens["--brand-ink"],
    });
  });

  it("takes its canvas and body colours from the base dark block", () => {
    const match = css.match(/:root\s*\{([\s\S]*?)\n {2}\}/);
    if (!match) throw new Error("no base dark block");
    const base = tokensIn(match[1]);
    expect(STORY_BG).toBe(base["--bg"]);
    expect(STORY_TEXT).toBe(base["--text"]);
  });

  it("prefers a holiday over the season it falls in", () => {
    expect(paletteFor({ season: "winter", holiday: "christmas" })).toBe(
      STORY_PALETTES.christmas
    );
    expect(paletteFor({ season: "winter", holiday: null })).toBe(STORY_PALETTES.winter);
  });
});
