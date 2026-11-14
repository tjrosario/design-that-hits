/**
 * One story card as a PNG, in the square or story format.
 *
 * The URL's version hash pins the card's content, so a matching image caches for a year
 * and a stale or invented one is refused before a photo is fetched or a pixel drawn.
 * Without that, `?id=<anything>` is an unbounded family of URLs that each cost a remote
 * fetch and a megabyte of PNG, which is the same reasoning the pin-image route carries.
 */

import { fullSizeImageUrl } from "@/lib/images";
import { PinPhotoError, fetchPinPhoto } from "@/lib/pin-photo";
import { STORY_FORMATS, storyCards, storyVersion, type StoryFormat } from "@/lib/story";
import { storyImage } from "@/lib/story-image";

// The font reads and the photo fetch both need Node.
export const runtime = "nodejs";

const CACHE_OK = "public, max-age=31536000, immutable";
const CACHE_FAIL = "no-store";

function fail(body: string, status: number) {
  return new Response(body, { status, headers: { "Cache-Control": CACHE_FAIL } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = url.searchParams;

  const format = params.get("format");
  if (format !== "square" && format !== "story") return fail("Unknown format", 400);

  const n = Number(params.get("n")) - 1;
  const card = (await storyCards()).find((c) => c.id === params.get("id"));
  if (!card || !Number.isInteger(n) || !card.versions[n]) return fail("Unknown card", 404);

  const v = storyVersion(card, n, format);
  if (params.get("v") !== v) return fail("This card has changed; reload the page", 404);
  // Only the exact URL the page links to is served, so query variations cannot each force a render.
  if (url.search !== `?id=${card.id}&n=${n + 1}&format=${format}&v=${v}`) return fail("Not found", 404);

  let photo;
  try {
    photo = await fetchPinPhoto(fullSizeImageUrl(card.photo));
  } catch (error) {
    if (!(error instanceof PinPhotoError)) throw error;
    /*
      Not a 200 with a hole in it. satori renders a failed image as empty space without
      failing, and an immutable cache entry would then serve that blank for a year.
    */
    console.error(`[story-image] ${card.id}: ${error.message}`);
    return fail("Product photo unavailable", 502);
  }

  const { eyebrow, title, lines, layout, palette } = card.versions[n];
  const { width, height } = STORY_FORMATS[format as StoryFormat];
  return storyImage(
    { eyebrow, title, lines, photo },
    { width, height, palette, layout, headers: { "Cache-Control": CACHE_OK } }
  );
}
