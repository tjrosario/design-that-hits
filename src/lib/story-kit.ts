/**
 * lib/story-kit.ts
 *
 * What a story card is made of, as opposed to what colour its accent is.
 *
 * A palette in `story-palette.ts` is the stylesheet's, mirrored for satori, and it names
 * four colours for a page whose canvas is fixed. A story card is not a page: it is a
 * standalone image in a feed, and the canvas is most of what a viewer registers before
 * they read anything. Drawing all 602 designs on the same near-black meant a Christmas
 * paper and a goth birthday paper differed by one accent rule and were otherwise the
 * same card, so the kit carries the canvas and the ribbon as well.
 *
 * Two sources feed it. The fifteen seasonal kits are derived from the stylesheet palette,
 * so they cannot drift from the site. The theme kits below have no block in `globals.css`
 * and are story-only: the catalog's themes are not calendar events and the page has never
 * needed colours for them.
 *
 * Every kit is dark, for the reason `story-palette.ts` gives: a story is viewed full-bleed
 * on a phone, and a light canvas behind a product photo that is itself mostly pale paper
 * leaves the photo with no edge.
 */

import { STORY_PALETTES, STORY_TEXT, type PaletteId } from "@/lib/story-palette";

/**
 * The canvas each seasonal kit is drawn on.
 *
 * A deep, desaturated version of what the palette is about, rather than the palette's own
 * `strong`: at full strength a canvas competes with the product photo above it, which is
 * the one thing on the card that has to win.
 */
const SEASONAL_CANVAS: Record<PaletteId, string> = {
  spring: "#0F2A1B",
  summer: "#07262E",
  fall: "#2A1409",
  winter: "#0B1C2E",
  "new-year": "#1E1405",
  valentines: "#2A0A1B",
  "st-patricks": "#06251C",
  easter: "#1B1030",
  "mothers-day": "#2A0C24",
  "fathers-day": "#101B2E",
  "independence-day": "#0D1430",
  halloween: "#140A1F",
  thanksgiving: "#241105",
  hanukkah: "#07182E",
  christmas: "#0B3B2C",
};

/**
 * Kits for the themes the catalog carries but the calendar does not.
 *
 * Only themes with enough designs to be worth their own look are here: gothic (151),
 * glam (134), retro (108), floral (86), pets (cats and dogs, 137 together) and
 * cottagecore (44). The rest fall back, because a kit nobody sees is a kit nobody
 * maintains. `ink` is the colour drawn on `brand`, and every pair is held to AA by
 * `story-kit.test.ts`.
 */
const THEME_KITS = {
  gothic: { canvas: "#15090F", brand: "#F0479A", strong: "#9B3FD4", ink: "#15090F" },
  glam: { canvas: "#1A1020", brand: "#E9C46A", strong: "#C66FA8", ink: "#1A1216" },
  retro: { canvas: "#22150C", brand: "#F2B134", strong: "#3DA39F", ink: "#1A1216" },
  floral: { canvas: "#241526", brand: "#F2789F", strong: "#8CB861", ink: "#1A1216" },
  pets: { canvas: "#1C1410", brand: "#F6A05A", strong: "#68B7AE", ink: "#1A1216" },
  cottagecore: { canvas: "#1B2317", brand: "#E3B23C", strong: "#C97B5A", ink: "#1A1216" },
  birthday: { canvas: "#1A0F2B", brand: "#FFC53D", strong: "#4ECDC4", ink: "#1A1216" },
  graduation: { canvas: "#101828", brand: "#E9C46A", strong: "#7C96F0", ink: "#1A1216" },
} as const;

export type ThemeKitId = keyof typeof THEME_KITS;
export type KitId = PaletteId | ThemeKitId;

export interface StoryKit {
  /** The card itself. Everything else is drawn on this. */
  canvas: string;
  /** The eyebrow pill and the first ribbon colour. */
  brand: string;
  /** The ribbon's second colour. */
  strong: string;
  /** Drawn on `brand`. */
  ink: string;
}

export function kitFor(id: KitId): StoryKit {
  const theme = THEME_KITS[id as ThemeKitId];
  if (theme) return theme;
  const seasonal = STORY_PALETTES[id as PaletteId];
  return {
    canvas: SEASONAL_CANVAS[id as PaletteId],
    brand: seasonal.brand,
    strong: seasonal.strong,
    ink: seasonal.ink,
  };
}

/**
 * The ribbon under a card's photo, as a repeating run of colours.
 *
 * Gift wrap is the shop's main product and a ribbon is what gift wrap comes with, so the
 * seam between photo and words is a band of the kit's own two accents alternating with
 * the body colour. It also does a job the old 6px rule did not: it tells the eye the
 * photo has ended, which matters when a pale design runs right to the band.
 */
export function ribbonFor(kit: StoryKit): string[] {
  return [kit.brand, STORY_TEXT, kit.strong, STORY_TEXT];
}

export const KIT_IDS: KitId[] = [
  ...(Object.keys(STORY_PALETTES) as PaletteId[]),
  ...(Object.keys(THEME_KITS) as ThemeKitId[]),
];
