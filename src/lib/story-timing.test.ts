import { describe, expect, it } from "vitest";
import { MAX_SHOTS } from "@/lib/story";
import { shotTiming, STORY_SECONDS } from "@/lib/story-timing";

/** Every count a listing can produce, from a listing with one mockup to Etsy's limit. */
const COUNTS = Array.from({ length: MAX_SHOTS }, (_, i) => i + 1);

describe("shotTiming", () => {
  it("fills the clip exactly, at every shot count", () => {
    for (const count of COUNTS) {
      const { hold, step } = shotTiming(count);
      // The last shot starts at (count - 1) steps in and runs for its whole hold.
      expect((count - 1) * step + hold, `${count} shots`).toBeCloseTo(STORY_SECONDS, 6);
    }
  });

  it("never lets a dissolve take more than a third of its own shot", () => {
    /*
      The bug this exists to stop. A fixed 0.6s crossfade against ten mockups left the
      hold at 1.24s, so half the clip was two designs ghosted over each other.
    */
    for (const count of COUNTS) {
      const { hold, crossfade } = shotTiming(count);
      expect(crossfade / hold, `${count} shots`).toBeLessThanOrEqual(1 / 3);
    }
  });

  it("leaves every shot visible on its own", () => {
    // `step` is the time a shot holds the frame alone. Zero or less would be a cross-dissolve
    // with no shot ever fully shown.
    for (const count of COUNTS) {
      expect(shotTiming(count).step, `${count} shots`).toBeGreaterThan(0);
    }
  });

  it("keeps the dissolve a dissolve rather than a cut", () => {
    for (const count of COUNTS) {
      expect(shotTiming(count).crossfade, `${count} shots`).toBeGreaterThanOrEqual(0.2);
    }
  });

  it("leaves four mockups and fewer exactly as they were", () => {
    // The pacing that shipped before any listing used more than four.
    for (const count of [1, 2, 3, 4]) {
      expect(shotTiming(count).crossfade, `${count} shots`).toBeCloseTo(0.6, 6);
    }
    expect(shotTiming(4).hold).toBeCloseTo(2.2, 6);
  });

  it("shortens the dissolve as the mockups multiply", () => {
    const four = shotTiming(4).crossfade;
    const ten = shotTiming(10).crossfade;
    expect(ten).toBeLessThan(four);
    // Still a dissolve a viewer reads as one, not a frame of blur.
    expect(ten).toBeCloseTo(0.24, 6);
  });

  it("gives a single mockup the whole clip", () => {
    expect(shotTiming(1).hold).toBeCloseTo(STORY_SECONDS, 6);
  });
});
