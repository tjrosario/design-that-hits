/**
 * A story card as a short MP4, for TikTok, Reels and Instagram Stories.
 *
 * The same drawing as the still, taken apart. Each text layer is rendered on its own
 * transparent canvas by `storyImage`, and ffmpeg lays them back over the photo with its
 * own motion, so the animation never has to re-describe a design the renderer already
 * knows how to draw. Change the still's layout and the video follows.
 *
 * Only the full-bleed layouts animate. `panel` and `frame` give the photo part of the
 * canvas and the rest to the page, which ffmpeg has no way to reproduce without a second
 * copy of the geometry, so those versions offer the stills alone rather than a video that
 * quietly looks like a different card.
 */

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { STORY_FORMATS, animatable, type Part, type StoryCard } from "@/lib/story";
import { bandBox, storyImage } from "@/lib/story-image";
import type { PinPhoto } from "@/lib/pin-photo";

export class StoryVideoError extends Error {}

const execFileAsync = promisify(execFile);

/**
 * Runs ffmpeg and puts its own diagnosis in the error.
 *
 * Node's message for a non-zero exit is "Command failed" plus the whole command line,
 * which for a filter graph this long buries the one line that says what was wrong.
 */
async function run(args: string[], timeout: number): Promise<void> {
  try {
    await execFileAsync(FFMPEG, args, { timeout, maxBuffer: 1 << 22 });
  } catch (cause) {
    const stderr = (cause as { stderr?: string }).stderr?.trim();
    throw new StoryVideoError(stderr || `ffmpeg failed: ${String(cause)}`, { cause });
  }
}

/* The static Linux x64 build from the optional dependency. next.config.js traces it into
   the video route's bundle; nothing else in the app shells out to it. */
const FFMPEG = path.join(process.cwd(), "node_modules/@ffmpeg-installer/linux-x64/ffmpeg");

export const STORY_SECONDS = 7;

/*
  24 rather than 30. The motion here is slow pans and fades, which read the same at
  either, and every frame is four layer composites: dropping six of them a second took
  about a fifth off the encode for no visible difference.
*/
const FPS = 24;

/** The layers drawn separately so each can move on its own. The order is inputs [1] to [4]. */
const PARTS: Part[] = ["wash", "eyebrow", "title", "details"];

/**
 * One still layer, decoded once and held, rather than re-read every frame.
 *
 * `-loop 1` on a PNG input re-decodes the file for each frame it emits: at four layers
 * and seven seconds that was 672 decodes of a 1080x1920 PNG, and it was most of the
 * render. Decoding once and repeating the frame inside the graph cut the CPU cost of a
 * story from 31 seconds to 18, and cropping to the band took it to 11.
 */
function layerIn(index: number, box: { height: number; top: number }, at: number, fade: number): string {
  return (
    `[${index}:v]loop=loop=-1:size=1:start=0,fps=${FPS},` +
    `crop=iw:${box.height}:0:${box.top},format=yuva420p,` +
    `fade=t=in:st=${at}:d=${fade}:alpha=1[x${index}]`
  );
}

/** Eases from 1 to 0 over `d` seconds from `s`, fast then settling. */
const settle = (d: number, s = 0) => `pow(1-min(1,max(0,t-${s})/${d}),3)`;

/** Crawls across the middle 30% of the photo's spare width or height, forward or back. */
const pan = (dir: "t" | "-t") =>
  dir === "t" ? `(0.35+0.3*t/${STORY_SECONDS})` : `(0.65-0.3*t/${STORY_SECONDS})`;

const fadeIn = (st: number, d = 1) => `format=yuva420p,fade=t=in:st=${st}:d=${d}:alpha=1`;

/** How one text layer arrives: when, over how long, and the offset it eases in from. */
interface Entrance {
  at: number;
  fade: number;
  x?: string;
  y?: string;
  ease?: number;
}

interface Style {
  /** Filters over input [0], the pre-scaled photo, ending in [bg]. */
  photo: (w: number, h: number) => string[];
  /** When the wash fades in. */
  wash: number;
  /** Then the eyebrow, title and details, in that order. */
  text: [Entrance, Entrance, Entrance];
}

/** The photo is scaled past the frame on both axes, so every style has room to pan either way. */
const PHOTO_IN = `[0:v]loop=loop=-1:size=1:start=0,fps=${FPS}`;

const crawl = (x: string, y: string) => (w: number, h: number) => [
  `${PHOTO_IN},crop=${w}:${h}:x='${x}':y='${y}',setsar=1,format=yuv420p[bg]`,
];

/** Zooms evenly between two scales over the clip. `perspective` keeps the motion sub-pixel smooth. */
const zoom = (from: number, to: number) => (w: number, h: number) => {
  const z = `(${(1 - 1 / from).toFixed(4)}+${(1 / from - 1 / to).toFixed(4)}*in/${STORY_SECONDS * FPS})/2`;
  const [l, t, r, b] = [`W*${z}`, `H*${z}`, `W-W*${z}`, `H-H*${z}`];
  return [
    `${PHOTO_IN},crop=${w}:${h},perspective=x0='${l}':y0='${t}':x1='${r}':y1='${t}':x2='${l}':y2='${b}':x3='${r}':y3='${b}':eval=frame,setsar=1,format=yuv420p[bg]`,
  ];
};

const STYLES: Style[] = [
  // Drift: the photo crawls left to right and the lines rise in one after another.
  {
    photo: crawl(`(iw-ow)*${pan("t")}`, "(ih-oh)/2"),
    wash: 0,
    text: [
      { at: 0.3, fade: 0.8, y: "60" },
      { at: 0.55, fade: 0.9, y: "90", ease: 1.6 },
      { at: 0.9, fade: 0.8, y: "60" },
    ],
  },
  // Rise: the photo crawls bottom to top and the lines slide in from the left in turn.
  {
    photo: crawl("(iw-ow)/2", `(ih-oh)*${pan("-t")}`),
    wash: 0,
    text: [
      { at: 0.2, fade: 0.4, x: "-W", ease: 1.1 },
      { at: 0.45, fade: 0.4, x: "-W", ease: 1.2 },
      { at: 0.7, fade: 0.4, x: "-W", ease: 1.2 },
    ],
  },
  // Push: the frame moves slowly into the design while the lines rise in together.
  {
    photo: zoom(1, 1.12),
    wash: 0,
    text: [
      { at: 0.5, fade: 1, y: "120", ease: 2 },
      { at: 0.5, fade: 1, y: "120", ease: 2 },
      { at: 0.5, fade: 1, y: "120", ease: 2 },
    ],
  },
  // Pull: it starts close and draws back as the lines slide in from the right in turn.
  {
    photo: zoom(1.14, 1),
    wash: 0.2,
    text: [
      { at: 0.6, fade: 0.5, x: "W", ease: 1.3 },
      { at: 0.8, fade: 0.5, x: "W", ease: 1.4 },
      { at: 1, fade: 0.5, x: "W", ease: 1.4 },
    ],
  },
  // Dawn: the photo fades up from black as it crawls, and the lines alternate sides.
  {
    photo: (w, h) => [
      `${PHOTO_IN},crop=${w}:${h}:x='(iw-ow)*${pan("-t")}':y='(ih-oh)/2',setsar=1,format=yuv420p,fade=t=in:st=0:d=1[bg]`,
    ],
    wash: 0.3,
    text: [
      { at: 0.6, fade: 0.5, x: "W", ease: 1.3 },
      { at: 0.85, fade: 0.5, x: "-W", ease: 1.4 },
      { at: 1.1, fade: 0.5, x: "W", ease: 1.3 },
    ],
  },
  // Settle: a diagonal crawl under a slow, staggered fade, which suits a busy pattern.
  {
    photo: crawl(`(iw-ow)*${pan("t")}`, `(ih-oh)*${pan("t")}`),
    wash: 0.2,
    text: [
      { at: 0.5, fade: 1.6 },
      { at: 0.8, fade: 1.6 },
      { at: 1.1, fade: 1.6 },
    ],
  },
];

/** The whole graph: the photo, the wash, then the three text layers in turn. */
function graph(style: Style, width: number, height: number, box: { height: number; top: number }): string {
  /* Every overlay is offset by the band's own top, because each layer was cropped to it. */
  const place = (x: string, y: string, ease: number, at: number) =>
    `x='${x}*${settle(ease, at)}':y='${box.top}+${y}*${settle(ease, at)}':format=yuv420`;

  const layers = style.text.flatMap(({ at, fade, x = "0", y = "0", ease = 1.4 }, i) => [
    layerIn(i + 2, box, at, fade),
    `[l${i}][x${i + 2}]overlay=${place(x, y, ease, at)}[l${i + 1}]`,
  ]);

  return [
    ...style.photo(width, height),
    layerIn(1, box, style.wash, 0.8),
    `[bg][x1]overlay=y=${box.top}:format=yuv420[l0]`,
    ...layers.slice(0, -1),
    // The last overlay names no output, which is what ffmpeg maps to the encoder.
    layers[layers.length - 1].replace(/\[l3\]$/, ""),
  ].join(";");
}

/** Each card starts at its own style and its versions step through the rest. */
export function storyStyle(card: StoryCard, version: number): number {
  let start = 0;
  for (const c of card.id) start += c.charCodeAt(0);
  return (start + version) % STYLES.length;
}

/**
 * A seven-second story video for one version, as MP4 bytes.
 *
 * The photo is scaled once up front to 10% past the frame, so the per-frame work is a
 * crop rather than a resize, and the bitrate is capped to keep the response under
 * Vercel's 4.5 MB limit.
 */
export async function storyVideo(
  card: StoryCard,
  version: number,
  photo: PinPhoto
): Promise<Buffer> {
  if (!animatable(card, version)) {
    throw new StoryVideoError(`${card.id} v${version + 1} has no full-bleed layout to animate`);
  }

  const { width, height } = STORY_FORMATS.story;
  const { eyebrow, title, lines, layout, palette } = card.versions[version];
  const dir = await mkdtemp(path.join(tmpdir(), "dth-story-"));

  try {
    const options = { width, height, palette, layout, headers: {} };
    const layers = await Promise.all(
      PARTS.map((part) => storyImage({ eyebrow, title, lines, photo: null }, { ...options, part }))
    );
    await Promise.all(
      layers.map(async (layer, i) =>
        writeFile(path.join(dir, `${i}.png`), Buffer.from(await layer.arrayBuffer()))
      )
    );

    // The product photo comes in as bytes, so it is written out before ffmpeg reads it.
    const source = path.join(dir, "source");
    await writeFile(source, Buffer.from(photo.dataUrl.split(",")[1], "base64"));

    const [w, h] = [Math.round(width * 1.1), Math.round(height * 1.1)];
    const cover = `scale='if(gt(a,${w}/${h}),-2,${w})':'if(gt(a,${w}/${h}),${h},-2)'`;
    await run(
      ["-hide_banner", "-loglevel", "error", "-y", "-i", source, "-vf", cover, "-q:v", "2", path.join(dir, "bg.jpg")],
      12_000
    );

    const box = bandBox(layout, width, height);
    if (!box) throw new StoryVideoError(`${card.id} v${version + 1}: ${layout} has no band`);

    // Each input is read once; the graph repeats the frame and sets the output's length.
    const out = path.join(dir, "story.mp4");
    await run(
      [
        "-hide_banner", "-loglevel", "error", "-y",
        "-i", path.join(dir, "bg.jpg"),
        ...layers.flatMap((_, i) => ["-i", path.join(dir, `${i}.png`)]),
        "-filter_complex", graph(STYLES[storyStyle(card, version)], width, height, box),
        "-r", String(FPS),
        "-t", String(STORY_SECONDS),
        "-c:v", "libx264", "-preset", "superfast", "-crf", "21", "-maxrate", "3M", "-bufsize", "6M",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        out,
      ],
      /*
        12 + 35 has to stay under the route's own 60, with room for the photo fetch and
        the four satori passes on top. Past that the platform kills the function instead,
        which skips the `finally` below and leaves the temp directory in /tmp for the
        life of a warm instance.
      */
      35_000
    );

    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
