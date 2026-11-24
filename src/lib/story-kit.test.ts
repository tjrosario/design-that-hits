import { describe, expect, it } from "vitest";
import { KIT_IDS, kitFor, ribbonFor } from "@/lib/story-kit";
import { STORY_PALETTES, STORY_TEXT } from "@/lib/story-palette";

function channel(pair: string): number {
  const v = parseInt(pair, 16) / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

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

describe("story kits", () => {
  it("has a kit for every seasonal palette", () => {
    for (const id of Object.keys(STORY_PALETTES)) {
      expect(KIT_IDS, id).toContain(id);
      expect(kitFor(id as never).canvas, id).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  /*
    The body copy and the wordmark are drawn straight onto the canvas in every layout, so
    this is the pair that decides whether a card can be read at all. A seasonal kit gets
    its accents from the stylesheet, which season-palette.test.ts already holds to AA, but
    the canvas is this module's own and nothing else checks it.
  */
  it("keeps body copy readable on every canvas", () => {
    for (const id of KIT_IDS) {
      const ratio = contrast(STORY_TEXT, kitFor(id).canvas);
      expect(ratio, `${id}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA);
    }
  });

  /* The eyebrow is a filled pill in every layout, so `ink` on `brand` is the other pair
     every card depends on. The stylesheet proves it for the fifteen; nothing proves it
     for a theme kit, whose colours are written here. */
  it("keeps the eyebrow readable on its pill", () => {
    for (const id of KIT_IDS) {
      const kit = kitFor(id);
      const ratio = contrast(kit.ink, kit.brand);
      expect(ratio, `${id}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA);
    }
  });

  /*
    A ribbon of two accents that sit at the same luminance reads as one muddy band. The
    stylesheet holds its own pairs apart by channel distance for the same reason, and a
    theme kit has to clear the same bar.
  */
  it("keeps the ribbon's two accents apart", () => {
    for (const id of KIT_IDS) {
      const kit = kitFor(id);
      const distance = [0, 2, 4]
        .map((i) => Math.abs(parseInt(kit.brand.slice(1 + i, 3 + i), 16) - parseInt(kit.strong.slice(1 + i, 3 + i), 16)))
        .reduce((a, b) => a + b, 0);
      expect(distance, `${id}`).toBeGreaterThan(30);
    }
  });

  it("alternates the ribbon so neither accent touches itself", () => {
    const kit = kitFor("christmas");
    expect(ribbonFor(kit)).toEqual([kit.brand, STORY_TEXT, kit.strong, STORY_TEXT]);
  });
});
