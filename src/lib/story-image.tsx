/**
 * The branded image a story card saves, in both formats and in every layout.
 *
 * The composition rule here is the opposite of a travel or property card: the photo is
 * the product, not the setting, so no layout covers the design with a scrim heavy enough
 * to read type over. Either the photo keeps its own area and the words sit beside it, or
 * the words sit on a band small enough to leave the pattern legible.
 *
 * A `part` draws one layer alone on a transparent canvas, in exactly the place the still
 * puts it, so an animated story can move the layers independently over the same photo.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { kitFor, ribbonFor } from "@/lib/story-kit";
import { STORY_TEXT } from "@/lib/story-palette";
import type { Layout, Part } from "@/lib/story";
import type { KitId } from "@/lib/story-kit";
import type { PinPhoto } from "@/lib/pin-photo";

/* Read once per lambda rather than per request, the way the pin-image route does.
   next.config.js lists this directory for the story routes under outputFileTracingIncludes. */
let fonts: Promise<[Buffer, Buffer]> | null = null;
function loadFonts() {
  const dir = path.join(process.cwd(), "src/assets/fonts");
  fonts ??= Promise.all([
    readFile(path.join(dir, "fredoka-600.ttf")),
    readFile(path.join(dir, "poppins-600.ttf")),
  ]);
  return fonts;
}

export interface StoryArt {
  eyebrow: string;
  title: string;
  lines: string[];
  /** Null when drawing a part, because ffmpeg supplies the photo for an animated story. */
  photo: PinPhoto | null;
}

export interface StoryOptions {
  width: number;
  height: number;
  palette: KitId;
  layout: Layout;
  headers: Record<string, string>;
  part?: Part;
}

/**
 * How much of a story's height the phone's own UI covers.
 *
 * TikTok stacks a caption and a column of buttons over the lower fifth, and every app
 * puts something in the top eighth. Text inside those bands is text nobody reads.
 */
const STORY_TOP_SAFE = 0.1;
const STORY_BOTTOM_SAFE = 0.2;

/**
 * The photo's share of the frame in the two stacked layouts.
 *
 * These lay out in normal flow rather than absolutely, so the text block takes whatever
 * is left and a long product name can never print over the photo. An absolutely placed
 * block did exactly that: a two-line name pushed its own eyebrow up onto the design.
 */
const PHOTO_SHARE: Record<"panel" | "frame", { story: number; square: number }> = {
  panel: { story: 0.56, square: 0.56 },
  // A square frame has to fit the same words under a much shorter canvas, so the photo
  // gives back what the text block needs rather than cropping to a letterbox strip.
  frame: { story: 0.46, square: 0.52 },
};

/**
 * How much of the frame the text band takes in the two full-bleed layouts.
 *
 * `banner` is opaque, so it is kept to the smallest band the copy fits in: every pixel of
 * it is a pixel of the design nobody sees. `edge` is a gradient that is still transparent
 * where it starts, so it needs the height to fade over.
 */
const BAND_SHARE: Record<"banner" | "edge", { story: number; square: number }> = {
  banner: { story: 0.45, square: 0.52 },
  edge: { story: 0.6, square: 0.62 },
};

/**
 * The band a full-bleed layout draws its words in, as a height and a distance from the top.
 *
 * Exported because the video crops each text layer to this box before compositing it.
 * Looping a full 1080x1920 RGBA layer through ffmpeg costs about three times what the
 * band alone does, and nothing outside the band is ever drawn.
 */
export function bandBox(layout: Layout, width: number, height: number) {
  if (layout === "panel" || layout === "frame") return null;
  const share = BAND_SHARE[layout][height > width ? "story" : "square"];
  /* A little past the band, so a name that fills it is not clipped at the top. 8%, not
     6%: the eyebrow is a pill now, which stands ~30px taller than the bare line it
     replaced, and a four-line name in Fredoka reached past the old margin. */
  const box = Math.min(height, Math.round(height * share) + Math.round(height * 0.08));
  return { height: box, top: height - box };
}

/**
 * How many blocks the ribbon is cut into.
 *
 * 18 across 1080 is 60px a block, which reads as gift-wrap ribbon at a thumbnail size
 * rather than as the stripes on a deckchair.
 */
const RIBBON_SEGMENTS = 18;

/** How thick the ribbon is, before the format's own scaling. */
const RIBBON_HEIGHT = 14;

/**
 * Where the ribbon goes, or null for the two layouts with no seam to mark.
 *
 * It ends where the words begin rather than starting there, so the band can never paint
 * over it and the eyebrow, which overruns the band's top edge on about a quarter of the
 * catalog's titles, lands on the ribbon rather than under a stripe through its middle.
 * Exported because `story-kit.test.ts` holds it clear of the band.
 */
export function seamTop(layout: Layout, width: number, height: number): number | null {
  const story = height > width;
  if (layout === "banner") return height - Math.round(height * BAND_SHARE.banner[story ? "story" : "square"]);
  if (layout === "panel") return Math.round(height * PHOTO_SHARE.panel[story ? "story" : "square"]);
  // `edge` fades into the photo and `frame` floats above a wash: neither has an edge.
  return null;
}

export function ribbonBox(layout: Layout, width: number, height: number) {
  const seam = seamTop(layout, width, height);
  if (seam === null) return null;
  const thickness = Math.round(RIBBON_HEIGHT * (width / 1080) * (height > width ? 1.12 : 1));
  return { top: seam - thickness, height: thickness };
}

export async function storyImage(
  { eyebrow, title, lines, photo }: StoryArt,
  { width, height, palette, layout, headers, part }: StoryOptions
) {
  const [fredoka, poppins] = await loadFonts();
  const kit = kitFor(palette);
  const story = height > width;
  // Type is sized off the width both formats share, then opened up on the taller canvas.
  const k = (width / 1080) * (story ? 1.12 : 1);
  const px = (n: number) => Math.round(n * k);

  const shown = (p: Part) => (part && part !== p ? 0 : 1);
  const paint = shown("wash") === 1;

  const side = px(76);
  const bottom = story ? Math.round(height * STORY_BOTTOM_SAFE) : px(64);
  const top = story ? Math.round(height * STORY_TOP_SAFE) : px(56);
  const stacked = layout === "panel" || layout === "frame";
  const photoHeight = stacked
    ? Math.round(height * PHOTO_SHARE[layout][story ? "story" : "square"])
    : height;
  const bandHeight = stacked
    ? 0
    : Math.round(height * BAND_SHARE[layout][story ? "story" : "square"]);

  /* `cover` on a wide or square shot crops its edges, which are margin on a flat-lay;
     `contain` on a tall one keeps the whole product. The pin route reasons this out at
     length and this reuses its conclusion. */
  const fit = photo && photo.height > photo.width ? "contain" : "cover";

  const photoWidth = layout === "frame" ? width - side * 2 : width;
  const photoImg = photo ? (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img src={photo.dataUrl} width={photoWidth} height={photoHeight} style={{ objectFit: fit }} />
  ) : null;

  /*
    A filled pill in every layout, tilted a couple of degrees so it reads as a label stuck
    on rather than a caption typed under. It is also the only pair of colours on the card
    that has to hold up over an unknown photo, and ink on brand is one `story-kit.test.ts`
    holds to AA for every kit.
  */
  const label = (
    <div
      key="label"
      style={{
        display: "flex",
        fontFamily: "Fredoka",
        fontSize: px(26),
        letterSpacing: px(5),
        textTransform: "uppercase",
        opacity: shown("eyebrow"),
        background: kit.brand,
        color: kit.ink,
        // Less on the right: the letter spacing already trails the last character.
        padding: `${px(11)}px ${px(16)}px ${px(11)}px ${px(24)}px`,
        borderRadius: px(100),
        transform: "rotate(-2deg)",
      }}
    >
      {eyebrow}
    </div>
  );

  const heading = (
    <div
      style={{
        display: "flex",
        marginTop: px(26),
        fontFamily: "Fredoka",
        fontSize: px(layout === "frame" ? 62 : 70),
        lineHeight: 1.1,
        letterSpacing: "-0.015em",
        textAlign: "center",
        color: STORY_TEXT,
        maxWidth: width - side * 2,
        opacity: shown("title"),
      }}
    >
      {title}
    </div>
  );

  const details = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginTop: px(26),
        opacity: shown("details"),
      }}
    >
      {lines.length > 0 && (
        <div
          style={{
            display: "flex",
            fontFamily: "Poppins",
            // A sentence, not a label: smaller and lighter than the name so the two read
            // in order, and in the body colour, which holds up over a photo on `edge`
            // where the soft palette tone measured close to its background.
            fontSize: px(28),
            lineHeight: 1.35,
            textAlign: "center",
            color: STORY_TEXT,
            opacity: 0.88,
            maxWidth: width - side * 2,
          }}
        >
          {lines.join("  ·  ")}
        </div>
      )}
      <div
        style={{
          display: "flex",
          marginTop: px(22),
          fontFamily: "Poppins",
          fontSize: px(24),
          letterSpacing: px(5),
          // Pays back the trailing letter space, the same way the eyebrow does.
          paddingLeft: px(5),
          textTransform: "uppercase",
          textAlign: "center",
          color: STORY_TEXT,
          opacity: 0.75,
        }}
      >
        designthathits.com
      </div>
    </div>
  );

  const text = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {label}
      {heading}
      {details}
    </div>
  );

  /*
    The band behind the words. The stacked layouts sit on the page canvas and need none.
    `banner` paints a solid block, with the ribbon along its top edge; `edge` fades to
    transparent well before it reaches the middle of the photo, and is dense enough by the eyebrow's line
    that the small uppercase type on it still reads over a pale pattern.
  */
  const band =
    layout === "banner"
      ? { background: paint ? kit.canvas : "transparent" }
      : layout === "edge" && paint
        ? {
            backgroundImage: `linear-gradient(to top, ${kit.canvas} 0%, ${kit.canvas}F2 50%, ${kit.canvas}00 100%)`,
          }
        // Left out rather than set to undefined: satori reads every declared style value
        // and an explicit undefined throws while parsing it.
        : {};

  /*
    Every layer is a sibling of one column, with no fragments and no `flex` shorthand.
    satori parses neither: a fragment collapsed the stacked layouts to nothing, and the
    shorthand left the text block zero pixels tall, which drew the words off the canvas.
  */
  const wash = layout === "frame" && paint && !part && (
    <div
      key="wash"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width,
        height,
        display: "flex",
        backgroundImage: `linear-gradient(160deg, ${kit.strong} 0%, ${kit.canvas} 62%)`,
      }}
    />
  );

  // `frame` floats its photo inside the top safe area rather than running to the edge.
  const spacer = layout === "frame" && <div key="spacer" style={{ display: "flex", height: top }} />;

  const photoLayer = photoImg && (
    <div
      key="photo"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        background: kit.canvas,
        width: photoWidth,
        height: photoHeight,
        borderRadius: layout === "frame" ? px(28) : 0,
        ...(stacked
          ? { marginLeft: layout === "frame" ? side : 0 }
          : { position: "absolute", top: 0, left: 0 }),
      }}
    >
      {photoImg}
    </div>
  );

  const words = (
    <div
      key="words"
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        padding: `${px(40)}px ${side}px ${bottom}px`,
        // Stacked: take whatever the photo left, so the words can never print over it.
        // Full-bleed: lay a band of a fixed share over the bottom of the photo.
        ...(stacked
          ? { flexGrow: 1 }
          : { position: "absolute", left: 0, bottom: 0, width, height: bandHeight }),
        ...band,
      }}
    >
      {text}
    </div>
  );

  /*
    The seam between the photo and the words, where the two layouts that have a hard edge
    get a band of ribbon. `edge` fades into the photo and `frame` floats above a wash, so
    neither has an edge to put one on. It belongs to the `wash` part, which is the layer
    an animated story composites under its text, and it is drawn before the words for the
    same reason: the two outputs then agree about which is on top.
  */
  const box = ribbonBox(layout, width, height);
  const ribbonColors = ribbonFor(kit);
  const ribbon = box && paint && (
    <div
      key="ribbon"
      style={{
        position: "absolute",
        top: box.top,
        left: 0,
        width,
        height: box.height,
        display: "flex",
        overflow: "hidden",
      }}
    >
      {Array.from({ length: RIBBON_SEGMENTS }, (_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            width: width / RIBBON_SEGMENTS,
            height: box.height,
            background: ribbonColors[i % ribbonColors.length],
          }}
        />
      ))}
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width,
          height,
          position: "relative",
          background: part ? "transparent" : kit.canvas,
          fontFamily: "Poppins",
        }}
      >
        {wash}
        {spacer}
        {photoLayer}
        {/* Before the words: an eyebrow that overruns the band sits on the ribbon, which
            is the order the video composites its layers in. */}
        {ribbon}
        {words}
      </div>
    ),
    {
      width,
      height,
      fonts: [
        { name: "Fredoka", data: fredoka, weight: 600, style: "normal" },
        { name: "Poppins", data: poppins, weight: 600, style: "normal" },
      ],
      headers,
    }
  );
}
