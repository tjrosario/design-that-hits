/**
 * Fetching and measuring the product photo that goes into a pin image.
 *
 * satori does not throw when an image fails to load: it renders the canvas with an empty
 * hole and the response is still a 200. Cached, that serves a blank pin for a day, and
 * Pinterest keeps its own copy of whatever it fetched, so a save during that window is a
 * permanently blank pin on someone's board. The photo is therefore fetched here, checked,
 * and handed to satori as bytes, so a failure is a failure rather than a blank.
 *
 * Measuring it matters too. Etsy photos are not all square: about a fifth of this catalog
 * is 2754x1536 or 1024x1536, so a fixed square box either crops the product away or
 * leaves wide empty bands. The dimensions decide how tall the photo sits in the pin.
 */

const FETCH_TIMEOUT_MS = 6000;

/** Guards against a redirect to an HTML error page that still returns 200. */
const IMAGE_TYPE = /^image\/(jpeg|png|webp|gif)$/i;

export interface PinPhoto {
  dataUrl: string;
  width: number;
  height: number;
}

export class PinPhotoError extends Error {}

/** Reads the pixel dimensions out of a JPEG or PNG header. */
export function imageSize(bytes: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (bytes.length > 24 && view.getUint32(0) === 0x89504e47) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }

  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i < bytes.length - 9) {
      if (bytes[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = bytes[i + 1];
      // SOF0-SOF15, excluding the DHT, JPG and DAC markers that share the range.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: view.getUint16(i + 5), width: view.getUint16(i + 7) };
      }
      i += 2 + view.getUint16(i + 2);
    }
  }

  return null;
}

export async function fetchPinPhoto(url: string): Promise<PinPhoto> {
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (cause) {
    throw new PinPhotoError(`fetching ${url} failed`, { cause });
  }

  if (!response.ok) {
    throw new PinPhotoError(`fetching ${url} returned ${response.status}`);
  }

  const type = response.headers.get("content-type")?.split(";")[0].trim() ?? "";
  if (!IMAGE_TYPE.test(type)) {
    throw new PinPhotoError(`${url} served ${type || "no content type"}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const size = imageSize(bytes);
  if (!size) {
    throw new PinPhotoError(`${url} is not a readable JPEG or PNG`);
  }

  return {
    dataUrl: `data:${type};base64,${Buffer.from(bytes).toString("base64")}`,
    ...size,
  };
}

/**
 * How the photo sits in a 1000x1500 pin.
 *
 * A 2:3 canvas cannot hold a 1.79:1 photo without either cropping it or leaving dead
 * space, so the two shapes get different rules:
 *
 *   - Wide or square, which is most of the catalog, gets a square box and is centre
 *     cropped to fill it. These are flat-lay product shots whose subject sits in the
 *     middle and whose pattern repeats, so the crop costs edges rather than the product,
 *     and the photo fills its third of the pin instead of floating in a band.
 *   - Taller than wide gets a taller box and is contained whole, because the crop that
 *     would fill the width cuts the top and bottom off the product itself. The side
 *     bands read as a portrait on a dark card.
 *
 * Either way the panel keeps at least 400px, which holds three lines of a product name
 * plus the brand line.
 */
export const SQUARE_PHOTO_HEIGHT = 1000;
export const TALL_PHOTO_HEIGHT = 1100;

export interface PhotoBox {
  height: number;
  fit: "cover" | "contain";
}

export function photoBox(width: number, height: number): PhotoBox {
  if (width <= 0 || height <= 0) return { height: SQUARE_PHOTO_HEIGHT, fit: "cover" };
  return height > width
    ? { height: TALL_PHOTO_HEIGHT, fit: "contain" }
    : { height: SQUARE_PHOTO_HEIGHT, fit: "cover" };
}
