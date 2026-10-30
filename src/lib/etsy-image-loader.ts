"use client";

/**
 * Picks an Etsy CDN variant instead of sending product photos through Vercel's optimizer.
 *
 * Etsy already serves every photo at a ladder of widths from its own CDN, so optimizing
 * them again bought a smaller file at the cost of one billed transformation per image per
 * width. When that allowance ran out the optimizer returned 402 on every cache miss and
 * the cards rendered as broken images, which is a worse outcome than a larger JPEG.
 *
 * Only the aspect-preserving variants are listed. Etsy's two smallest, il_170x135 and
 * il_340x270, are cropped to 4:3, and mixing them into the same srcset would change a
 * photo's framing as the viewport crosses a breakpoint.
 */

const ETSY_HOST = "i.etsystatic.com";

/** The size token is a path segment, so swapping it asks for a different render. */
const ETSY_VARIANT = /\/il_[^./]+\./;

const ETSY_VARIANTS: { width: number; token: string }[] = [
  { width: 570, token: "il_570xN" },
  { width: 794, token: "il_794xN" },
  { width: 1140, token: "il_1140xN" },
  { width: 2048, token: "il_fullxfull" },
];

const LARGEST = ETSY_VARIANTS[ETSY_VARIANTS.length - 1];

/**
 * How far below the requested width a variant may sit and still be chosen.
 *
 * Etsy's ladder has gaps, and Next asks for 828 where the nearest variants are 794 and
 * 1140. Taking 1140 doubles the bytes for a 4% gain in resolution that `object-cover`
 * hides anyway, so a variant within a tenth of the request is treated as a match.
 */
const UNDERSIZE_TOLERANCE = 0.9;

export default function etsyImageLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  // The handful of local assets stay on the built-in optimizer. They are a fixed set that
  // caches once, so they are not what exhausts the transformation allowance.
  if (!src.includes(ETSY_HOST)) {
    return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality ?? 75}`;
  }

  const variant = ETSY_VARIANTS.find((v) => v.width >= width * UNDERSIZE_TOLERANCE) ?? LARGEST;
  return src.replace(ETSY_VARIANT, `/${variant.token}.`);
}
