/**
 * One story card as an animated MP4.
 *
 * Versioned and pinned to its exact URL for the same reason the still route is: a render
 * here costs a remote photo fetch, four satori passes and an H.264 encode, so an
 * unbounded family of URLs would be an unbounded family of those.
 */

import { fullSizeImageUrl } from "@/lib/images";
import { PinPhotoError, fetchPinPhoto } from "@/lib/pin-photo";
import { animatable, storyCards, videoVersion } from "@/lib/story";
import { StoryVideoError, storyVideo } from "@/lib/story-video";

// ffmpeg, the font reads and the photo fetch all need Node.
export const runtime = "nodejs";

/*
  Encoding a 7-second 1080x1920 clip takes a few seconds of CPU, and this leaves room for
  a cold start and a slow photo fetch on top. Deliberately not higher: 60 is the ceiling
  every Vercel plan allows, and a value a plan refuses fails the deployment rather than
  the request.
*/
export const maxDuration = 60;

const CACHE_OK = "public, max-age=31536000, immutable";
const CACHE_FAIL = "no-store";

function fail(body: string, status: number) {
  return new Response(body, { status, headers: { "Cache-Control": CACHE_FAIL } });
}

/*
  Renders running on this instance, by their exact query. A retry that lands while the
  first is still going waits for it instead of starting a second, which would slow both
  past the limit and double the CPU for one file.
*/
const rendering = new Map<string, Promise<Buffer>>();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = url.searchParams;

  const n = Number(params.get("n")) - 1;
  const card = (await storyCards()).find((c) => c.id === params.get("id"));
  if (!card || !Number.isInteger(n) || !card.versions[n]) return fail("Unknown card", 404);
  if (!animatable(card, n)) return fail("This version has no animated story", 404);

  const v = videoVersion(card, n);
  if (params.get("v") !== v) return fail("This card has changed; reload the page", 404);
  if (url.search !== `?id=${card.id}&n=${n + 1}&v=${v}`) return fail("Not found", 404);

  let photo;
  try {
    photo = await fetchPinPhoto(fullSizeImageUrl(card.photo));
  } catch (error) {
    if (!(error instanceof PinPhotoError)) throw error;
    console.error(`[story-video] ${card.id}: ${error.message}`);
    return fail("Product photo unavailable", 502);
  }

  const key = url.search;
  let render = rendering.get(key);
  if (!render) {
    render = storyVideo(card, n, photo).finally(() => rendering.delete(key));
    rendering.set(key, render);
  }

  let video: Buffer;
  try {
    video = await render;
  } catch (error) {
    // An ffmpeg failure is a 500 with no body kept, never a cached zero-byte MP4.
    const reason = error instanceof StoryVideoError ? error.message : String(error);
    console.error(`[story-video] ${card.id} v${n + 1}: ${reason}`);
    return fail("Could not render this story", 500);
  }

  return new Response(new Uint8Array(video), {
    headers: { "Content-Type": "video/mp4", "Cache-Control": CACHE_OK },
  });
}
