/**
 * The 2:3 image a saved pin carries.
 *
 * Etsy photos are square. Pinterest's feed is a vertical masonry grid, where a square
 * occupies about a third less height than a 2:3 pin and is passed over for it, so the
 * product photo alone wastes the save. This composes the photo onto a 1000x1500 brand
 * canvas with the design's name underneath.
 *
 * The photo is not cropped to fill. On wrapping paper the repeating pattern is the
 * product, so a centre crop throws away the thing being sold; the square sits whole and
 * the brand panel takes the remaining height.
 *
 * Used by the save button only. The catalog feed keeps the clean product photo, because
 * Pinterest's merchant guidance treats text overlays and logos on a catalog image as a
 * quality problem, and a rejected catalog would cost every pin in it.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getListingById } from "@/lib/shop";
import { idFromSlug, listingName } from "@/lib/slug";
import { clampName } from "@/lib/pinterest";
import { fullSizeImageUrl } from "@/lib/images";

// fs and the image fetch both need Node.
export const runtime = "nodejs";

export const revalidate = 86400;

export const PIN_WIDTH = 1000;
export const PIN_HEIGHT = 1500;
/** The photo is square, so the panel gets whatever height is left. */
const PHOTO = PIN_WIDTH;

const BG = "#0E0C0F";
const TEXT = "#F8F5F7";
const BRAND = "#FA3C87";

/*
  Read once per lambda rather than per request. Vercel's tracer cannot see through
  path.join, so next.config.js lists this directory under outputFileTracingIncludes; drop
  that and the files are absent in production and every pin image 500s.
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

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const id = idFromSlug(slug);
  if (id === null) return new Response("Not found", { status: 404 });

  const listing = await getListingById(id);
  if (!listing?.image) return new Response("Not found", { status: 404 });

  const [playfair, poppins] = await loadFonts();
  const name = clampName(listingName(listing));

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
        {/* eslint-disable-next-line @next/next/no-img-element -- satori renders plain img only */}
        <img
          src={fullSizeImageUrl(listing.image.url)}
          width={PHOTO}
          height={PHOTO}
          style={{ objectFit: "cover" }}
          alt=""
        />

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 72px",
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
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}
