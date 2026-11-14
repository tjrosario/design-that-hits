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
import { STORY_BG, STORY_PALETTES, STORY_TEXT } from "@/lib/story-palette";
import type { Layout, Part } from "@/lib/story";
import type { PaletteId } from "@/lib/story-palette";
import type { PinPhoto } from "@/lib/pin-photo";

/* Read once per lambda rather than per request, the way the pin-image route does.
   next.config.js lists this directory for the story routes under outputFileTracingIncludes. */
let fonts: Promise<[Buffer, Buffer]> | null = null;
function loadFonts() {
  const dir = path.join(process.cwd(), "src/assets/fonts");
  fonts ??= Promise.all([
    readFile(path.join(dir, "playfair-700.ttf")),
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
  palette: PaletteId;
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
  // A little past the band, so a three-line name that fills it is not clipped at the top.
  const box = Math.min(height, Math.round(height * share) + Math.round(height * 0.06));
  return { height: box, top: height - box };
}

export async function storyImage(
  { eyebrow, title, lines, photo }: StoryArt,
  { width, height, palette, layout, headers, part }: StoryOptions
) {
  const [playfair, poppins] = await loadFonts();
  const colors = STORY_PALETTES[palette];
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
    The eyebrow sits directly on the photo in `edge`, where brand pink over a pale ribbon
    measured about 1.1:1. A filled pill fixes that for any photo, because ink on brand is
    a pair season-palette.test.ts already holds to AA in all fifteen palettes.
  */
  const onPhoto = layout === "edge";

  /* Only the stacked layouts have the room. `banner` draws a brand rule along the band's
     top edge instead, and a dash there was clipped by it; `edge` has the pill. */
  const accent = (layout === "panel" || layout === "frame") && (
    <div
      key="accent"
      style={{
        width: px(84),
        height: px(6),
        marginBottom: px(24),
        borderRadius: px(3),
        background: colors.brand,
        opacity: shown("eyebrow"),
      }}
    />
  );

  const label = (
    <div
      key="label"
      style={{
        display: "flex",
        fontFamily: "Poppins",
        fontSize: px(26),
        letterSpacing: px(6),
        textTransform: "uppercase",
        opacity: shown("eyebrow"),
        ...(onPhoto
          ? {
              background: colors.brand,
              color: colors.ink,
              // Less on the right: the letter spacing already trails the last character.
              padding: `${px(11)}px ${px(14)}px ${px(11)}px ${px(22)}px`,
              borderRadius: px(100),
            }
          : { color: colors.brand }),
      }}
    >
      {eyebrow}
    </div>
  );

  const heading = (
    <div
      style={{
        display: "flex",
        marginTop: px(22),
        fontFamily: "Playfair Display",
        fontSize: px(layout === "frame" ? 62 : 70),
        lineHeight: 1.1,
        letterSpacing: "-0.015em",
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
        marginTop: px(26),
        opacity: shown("details"),
      }}
    >
      {lines.length > 0 && (
        <div style={{ display: "flex", fontFamily: "Poppins", fontSize: px(32), color: colors.soft }}>
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
          textTransform: "uppercase",
          color: STORY_TEXT,
          opacity: 0.75,
        }}
      >
        designthathits.com
      </div>
    </div>
  );

  const text = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      {accent}
      {label}
      {heading}
      {details}
    </div>
  );

  /*
    The band behind the words. The stacked layouts sit on the page canvas and need none.
    `banner` paints a solid block under a brand rule; `edge` fades to transparent well
    before it reaches the middle of the photo, and is dense enough by the eyebrow's line
    that the small uppercase type on it still reads over a pale pattern.
  */
  const band =
    layout === "banner"
      ? {
          background: paint ? STORY_BG : "transparent",
          borderTop: `${px(6)}px solid ${paint ? colors.brand : "transparent"}`,
        }
      : layout === "edge" && paint
        ? {
            backgroundImage: `linear-gradient(to top, ${STORY_BG} 0%, ${STORY_BG}F2 50%, ${STORY_BG}00 100%)`,
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
        backgroundImage: `linear-gradient(160deg, ${colors.strong} 0%, ${STORY_BG} 62%)`,
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
        background: STORY_BG,
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

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width,
          height,
          position: "relative",
          background: part ? "transparent" : STORY_BG,
          fontFamily: "Poppins",
        }}
      >
        {wash}
        {spacer}
        {photoLayer}
        {words}
      </div>
    ),
    {
      width,
      height,
      fonts: [
        { name: "Playfair Display", data: playfair, weight: 700, style: "normal" },
        { name: "Poppins", data: poppins, weight: 600, style: "normal" },
      ],
      headers,
    }
  );
}
