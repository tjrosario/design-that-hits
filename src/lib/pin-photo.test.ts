import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SQUARE_PHOTO_HEIGHT,
  TALL_PHOTO_HEIGHT,
  PinPhotoError,
  fetchPinPhoto,
  imageSize,
  photoBox,
} from "@/lib/pin-photo";

const PNG_HEADER = (w: number, h: number) => {
  const b = Buffer.alloc(32);
  b.writeUInt32BE(0x89504e47, 0);
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  return new Uint8Array(b);
};

/** A minimal JPEG: SOI, then an SOF0 segment carrying the dimensions. */
const JPEG_HEADER = (w: number, h: number) => {
  const b = Buffer.alloc(24);
  b.writeUInt16BE(0xffd8, 0);
  b.writeUInt16BE(0xffc0, 2);
  b.writeUInt16BE(17, 4); // segment length
  b.writeUInt8(8, 6); // precision
  b.writeUInt16BE(h, 7);
  b.writeUInt16BE(w, 9);
  return new Uint8Array(b);
};

afterEach(() => vi.unstubAllGlobals());

describe("imageSize", () => {
  it("reads a PNG header", () => {
    expect(imageSize(PNG_HEADER(1024, 1536))).toEqual({ width: 1024, height: 1536 });
  });

  it("reads a JPEG SOF segment", () => {
    expect(imageSize(JPEG_HEADER(2754, 1536))).toEqual({ width: 2754, height: 1536 });
  });

  it("returns null for something that is not an image", () => {
    expect(imageSize(new Uint8Array(Buffer.from("<!doctype html><html></html>")))).toBeNull();
  });
});

/*
  The reason this module exists. satori renders a missing image as an empty hole and the
  response is still a 200; cached for a day, that serves a blank pin, and Pinterest keeps
  its own copy at save time, so the blank becomes permanent on someone's board. Every
  failure below has to raise rather than resolve.
*/
describe("fetchPinPhoto", () => {
  const ok = (body: Uint8Array, type = "image/jpeg") =>
    new Response(Buffer.from(body), { status: 200, headers: { "content-type": type } });

  it("returns a data URL and the measured size", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ok(JPEG_HEADER(2754, 1536))));
    const photo = await fetchPinPhoto("https://i.etsystatic.com/x.jpg");
    expect(photo.width).toBe(2754);
    expect(photo.height).toBe(1536);
    expect(photo.dataUrl.startsWith("data:image/jpeg;base64,")).toBe(true);
  });

  it("raises when the photo 404s", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    await expect(fetchPinPhoto("https://i.etsystatic.com/gone.jpg")).rejects.toBeInstanceOf(
      PinPhotoError
    );
  });

  it("raises when the fetch fails outright", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }));
    await expect(fetchPinPhoto("https://i.etsystatic.com/x.jpg")).rejects.toBeInstanceOf(
      PinPhotoError
    );
  });

  // A redirect to an error page returns 200 with HTML, which would otherwise be
  // base64'd into the pin as a blank.
  it("raises when the response is not an image", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ok(new Uint8Array([1, 2, 3]), "text/html")));
    await expect(fetchPinPhoto("https://i.etsystatic.com/x.jpg")).rejects.toBeInstanceOf(
      PinPhotoError
    );
  });

  it("raises when the bytes are not a readable image", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ok(new Uint8Array([1, 2, 3]))));
    await expect(fetchPinPhoto("https://i.etsystatic.com/x.jpg")).rejects.toBeInstanceOf(
      PinPhotoError
    );
  });
});

describe("photoBox", () => {
  it("crops a square photo into the square box", () => {
    expect(photoBox(2000, 2000)).toEqual({ height: SQUARE_PHOTO_HEIGHT, fit: "cover" });
  });

  /*
    2754x1536 is the most common non-square shape here. Contained, it would be 558px tall
    and leave 900px of empty panel under it, so it is cropped to fill the square instead:
    a flat-lay whose subject is centred and whose pattern repeats loses edges, not product.
  */
  it("crops a wide photo rather than leaving a band", () => {
    expect(photoBox(2754, 1536)).toEqual({ height: SQUARE_PHOTO_HEIGHT, fit: "cover" });
  });

  // 1024x1536 cropped to fill the width would cut the top and bottom off the product.
  it("contains a tall photo whole", () => {
    expect(photoBox(1024, 1536)).toEqual({ height: TALL_PHOTO_HEIGHT, fit: "contain" });
  });

  it("always leaves the panel at least 400px", () => {
    for (const [w, h] of [[2754, 1536], [1024, 1536], [2000, 2000], [1408, 736], [1, 9999]]) {
      expect(1500 - photoBox(w, h).height, `${w}x${h}`).toBeGreaterThanOrEqual(400);
    }
  });

  it("falls back to the square box on nonsense dimensions", () => {
    expect(photoBox(0, 0)).toEqual({ height: SQUARE_PHOTO_HEIGHT, fit: "cover" });
  });
});
