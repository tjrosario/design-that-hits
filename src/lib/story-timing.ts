/**
 * lib/story-timing.ts
 *
 * When each mockup appears in an animated story, and how long it takes to hand over.
 *
 * Arithmetic only, kept apart from the encoder so it can be read and tested without
 * pulling in ffmpeg or a satori render. Everything here has to hold for one mockup and
 * for ten, because a listing may have any number up to Etsy's limit.
 */

/**
 * How long a story runs.
 *
 * Seven seconds is about as long as a product clip holds attention, and short enough
 * that the encode and the response both stay inside what the route's budget allows.
 */
export const STORY_SECONDS = 7;

/**
 * The longest one shot takes to hand over to the next.
 *
 * Long enough to read as a dissolve rather than a cut, short enough that the two designs
 * are only mixed for a fraction of the time either is on its own.
 */
const CROSSFADE_MAX = 0.6;

/**
 * Roughly how much of the clip is spent dissolving, however many shots there are.
 *
 * A fixed crossfade does not survive a listing with ten mockups: the hold falls to 1.24s
 * while the dissolve stays at 0.6, so half the clip is two designs ghosted over each
 * other. Dividing a fixed budget instead keeps each dissolve at about a quarter of its
 * own shot at any count, which is what four mockups already looked like.
 */
const CROSSFADE_BUDGET = 2.4;

export interface ShotTiming {
  /** A shot's whole time on screen, its dissolve included. */
  hold: number;
  /** How far apart two shots start, which is the time a shot has the frame to itself. */
  step: number;
  /** How long a shot overlaps the one before it. */
  crossfade: number;
}

/** The timing for one clip, so its shots fill exactly `STORY_SECONDS`. */
export function shotTiming(count: number): ShotTiming {
  const crossfade = Math.min(CROSSFADE_MAX, CROSSFADE_BUDGET / count);
  const hold = (STORY_SECONDS + (count - 1) * crossfade) / count;
  return { hold, step: hold - crossfade, crossfade };
}
