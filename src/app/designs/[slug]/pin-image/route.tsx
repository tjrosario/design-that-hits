/**
 * The 2:3 image a saved pin carries.
 *
 * Pinterest's feed is a vertical masonry grid, where a square photo takes about a third
 * less height than a 2:3 pin and is scrolled past. This composes the product photo onto a
 * 1000x1500 brand canvas with the design's name underneath.
 *
 * About a fifth of this catalog is 2754x1536 or 1024x1536 rather than square, so the
 * photo's own shape decides how it sits: wide and square shots are centre cropped into a
 * square box, taller ones are contained whole. `photoBox` carries the reasoning.
 *
 * Used by the save button only. The catalog feed keeps the clean product photo, because
 * Pinterest's merchant guidance treats text overlays and logos on a catalog image as a
 * quality problem, and a rejected catalog would cost every pin in it.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getListingById } from "@/lib/shop";
import { idFromSlug, listingName, listingSlug } from "@/lib/slug";
import { clampName } from "@/lib/pinterest";
import { fullSizeImageUrl } from "@/lib/images";
import { PinPhotoError, fetchPinPhoto, photoBox } from "@/lib/pin-photo";

// fs and the photo fetch both need Node.
export const runtime = "nodejs";

// Not exported: Next only allows a route module to export handlers and segment
// config, and a --webpack build fails type checking on anything else.
const PIN_WIDTH = 1000;
const PIN_HEIGHT = 1500;

const BG = "#0E0C0F";
const TEXT = "#F8F5F7";
const BRAND = "#FA3C87";

/** A render costs a remote fetch and a megabyte of PNG, so nothing uncacheable is served. */
const CACHE_OK = "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";
const CACHE_FAIL = "no-store";

/*
  Read once per lambda rather than per request. `next.config.js` also lists this directory
  under outputFileTracingIncludes; Turbopack traces the read on its own, so that entry is
  insurance for a --webpack build rather than what makes this work.
*/
let fonts: Promise<[Buffer, Buffer]> | null = null;
function loadFonts() {
  const dir = path.join(process.cwd(), "src/assets/fonts");
  fonts ??= Promise.all([
    readFile(path.join(dir, "playfair-700.ttf")),
    readFile(path.join(dir, "poppins-600.ttf")),
  ]);
  return fonts;
}

function notFound() {
  return new Response("Not found", { status: 404, headers: { "Cache-Control": CACHE_FAIL } });
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  /*
    Every distinct URL is a distinct CDN entry and a distinct render, and `idFromSlug`
    reads only the trailing digits, so without these two checks
    /designs/<anything>-<id>/pin-image and ?cb=<n> are unbounded families of URLs that each
    cost a remote fetch and a megabyte of PNG. Both are pinned to the one canonical form.
  */
  if (new URL(request.url).search) return notFound();

  const { slug } = await params;
  const id = idFromSlug(slug);
  if (id === null) return notFound();

  const listing = await getListingById(id);
  if (!listing?.image) return notFound();
  if (slug !== listingSlug(listing)) return notFound();

  let photo;
  try {
    photo = await fetchPinPhoto(fullSizeImageUrl(listing.image.url));
  } catch (error) {
    if (!(error instanceof PinPhotoError)) throw error;
    /*
      Deliberately not a 200 with an empty frame. satori renders a missing image as a
      hole without failing, and Pinterest stores its own copy at save time, so a blank
      served here becomes a permanent blank pin on someone's board.
    */
    console.error(`[pin-image] ${slug}: ${error.message}`);
    return new Response("Product photo unavailable", {
      status: 502,
      headers: { "Cache-Control": CACHE_FAIL },
    });
  }

  const [playfair, poppins] = await loadFonts();
  const name = clampName(listingName(listing));
  const box = photoBox(photo.width, photo.height);

  return new ImageResponse(
    (
      <div
        style={{
          width: PIN_WIDTH,
          height: PIN_HEIGHT,
          display: "flex",
          flexDirection: "column",
          background: BG,
        }}
      >
        <div
          style={{
            width: PIN_WIDTH,
            height: box.height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- satori renders plain img only */}
          <img
            src={photo.dataUrl}
            width={PIN_WIDTH}
            height={box.height}
            style={{ objectFit: box.fit }}
            alt=""
          />
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            /*
              Bottom-aligned, not centred. The panel's height varies with the photo's
              aspect, from 450px to 900px, and centring leaves the text floating in the
              middle of the tall case. Anchoring it to the baseline keeps the composition
              the same whatever the photo did.
            */
            justifyContent: "flex-end",
            padding: "0 72px 72px",
            borderTop: `6px solid ${BRAND}`,
          }}
        >
          <div
            style={{
              fontFamily: "Playfair Display",
              fontSize: 64,
              lineHeight: 1.12,
              color: TEXT,
              letterSpacing: "-0.015em",
            }}
          >
            {name}
          </div>
          <div
            style={{
              marginTop: 28,
              fontFamily: "Poppins",
              fontSize: 26,
              letterSpacing: "0.22em",
              color: BRAND,
            }}
          >
            DESIGN THAT HITS
          </div>
        </div>
      </div>
    ),
    {
      width: PIN_WIDTH,
      height: PIN_HEIGHT,
      fonts: [
        { name: "Playfair Display", data: playfair, weight: 700, style: "normal" },
        { name: "Poppins", data: poppins, weight: 600, style: "normal" },
      ],
      headers: { "Cache-Control": CACHE_OK },
    }
  );
}
