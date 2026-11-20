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
 * How long a story runs when it has one or two mockups to show.
 *
 * About as long as a product clip holds attention, and the floor for everything else.
 */
const MIN_SECONDS = 7;

/**
 * The longest a story runs, however many mockups it has.
 *
 * Set by the response size, not by taste. The route returns the file in one piece and
 * Vercel caps that at 4.5 MB. The encode is held to `maxrate`, so the size follows the
 * length and barely moves with the photos: four very different designs measured 3.62 to
 * 3.73 MB at this length, and 3.96 to 4.08 MB at ten seconds. Ten leaves under a tenth
 * of the cap spare, which is not enough room for a failure that has no fallback.
 */
const MAX_SECONDS = 9;

/** What each mockup is worth, before the floor and the ceiling are applied. */
const SECONDS_PER_SHOT = 1.6;

/** How long a clip of `count` mockups runs. */
export function storySeconds(count: number): number {
  return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, count * SECONDS_PER_SHOT));
}

/**
 * The longest one shot takes to hand over to the next.
 *
 * Long enough to read as a dissolve rather than a cut, short enough that the two designs
 * are only mixed for a fraction of the time either is on its own.
 */
const CROSSFADE_MAX = 0.6;

/**
 * The share of a clip spent dissolving, however many shots there are.
 *
 * A fixed crossfade does not survive a listing with ten mockups: the hold falls to 1.24s
 * while the dissolve stays at 0.6, so half the clip is two designs ghosted over each
 * other. Dividing a share of the clip instead keeps each dissolve at about a quarter of
 * its own shot at any count, which is what four mockups already looked like.
 */
const CROSSFADE_SHARE = 2.4 / MIN_SECONDS;

export interface ShotTiming {
  /** How long the whole clip runs. */
  seconds: number;
  /** A shot's whole time on screen, its dissolve included. */
  hold: number;
  /** How far apart two shots start, which is the time a shot has the frame to itself. */
  step: number;
  /** How long a shot overlaps the one before it. */
  crossfade: number;
}

/** The timing for one clip, so its shots fill exactly the clip's own length. */
export function shotTiming(count: number): ShotTiming {
  const seconds = storySeconds(count);
  const crossfade = Math.min(CROSSFADE_MAX, (seconds * CROSSFADE_SHARE) / count);
  const hold = (seconds + (count - 1) * crossfade) / count;
  return { seconds, hold, step: hold - crossfade, crossfade };
}
