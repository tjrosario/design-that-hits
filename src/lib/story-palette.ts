/**
 * The seasonal palette as hex, for images rendered outside the browser.
 *
 * `globals.css` is the storefront's palette and stays so: these are the same fifteen dark
 * blocks copied into TypeScript, because satori resolves no custom properties and a
 * `var(--brand)` inside an `ImageResponse` renders as nothing at all. `story-palette.test.ts`
 * re-parses the stylesheet and fails if the two drift, so the copy cannot rot quietly.
 *
 * Dark only. A story is viewed full-bleed on a phone, usually at night, and the light
 * blocks put a near-white field behind a product photo that is itself mostly white paper.
 */

import type { HolidayId, SeasonalTheme, SeasonId } from "@/lib/season";

export type PaletteId = SeasonId | HolidayId;

export interface StoryPalette {
  /** The headline accent, and the bright end of the brand gradient. */
  brand: string;
  /** The dark end of that gradient, and the fill behind on-brand copy. */
  strong: string;
  /** The light end, used for the small print that sits on the dark canvas. */
  soft: string;
  /** Text drawn on top of `brand` or `strong`. Dark in every seasonal block. */
  ink: string;
}

/** The canvas every story is drawn on, from the base `:root` block. */
export const STORY_BG = "#0E0C0F";
/** Body copy on that canvas, from the base `:root` block. */
export const STORY_TEXT = "#F8F5F7";

export const STORY_PALETTES: Record<PaletteId, StoryPalette> = {
  spring:             { brand: "#82CB4D", strong: "#309161", soft: "#BAE085", ink: "#1A1216" },
  summer:             { brand: "#42CAD7", strong: "#5080D3", soft: "#7DE8DF", ink: "#1A1216" },
  fall:               { brand: "#E88630", strong: "#DE4F45", soft: "#F4C071", ink: "#1A1216" },
  winter:             { brand: "#3C9ADD", strong: "#7874DC", soft: "#79CDEC", ink: "#1A1216" },
  "new-year":         { brand: "#EEBD2B", strong: "#CD5E1D", soft: "#F7E06E", ink: "#1A1216" },
  valentines:         { brand: "#F04C75", strong: "#DC38BB", soft: "#F76E85", ink: "#1A1216" },
  "st-patricks":      { brand: "#47D181", strong: "#2C9693", soft: "#81E49A", ink: "#1A1216" },
  easter:             { brand: "#AF70DB", strong: "#7575D7", soft: "#D081E4", ink: "#1A1216" },
  "mothers-day":      { brand: "#E1569C", strong: "#CB43D0", soft: "#F075A2", ink: "#1A1216" },
  "fathers-day":      { brand: "#598ACF", strong: "#7E75D7", soft: "#85BAE0", ink: "#1A1216" },
  "independence-day": { brand: "#E75A5F", strong: "#4E7DDA", soft: "#F08675", ink: "#1A1216" },
  halloween:          { brand: "#F47125", strong: "#A861D1", soft: "#FBB76A", ink: "#1A1216" },
  thanksgiving:       { brand: "#DD6540", strong: "#A9761E", soft: "#ECA779", ink: "#1A1216" },
  hanukkah:           { brand: "#368CE2", strong: "#7B74E2", soft: "#75C7F0", ink: "#1A1216" },
  christmas:          { brand: "#E75A6D", strong: "#2C9658", soft: "#F07579", ink: "#1A1216" },
};

/** A holiday palette when one is in range, otherwise the season's. Mirrors the stylesheet's cascade. */
export function paletteIdFor(theme: SeasonalTheme): PaletteId {
  return theme.holiday ?? theme.season;
}

export function paletteFor(theme: SeasonalTheme): StoryPalette {
  return STORY_PALETTES[paletteIdFor(theme)];
}
