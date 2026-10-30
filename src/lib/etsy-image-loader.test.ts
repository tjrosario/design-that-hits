import { describe, expect, it } from "vitest";
import etsyImageLoader from "@/lib/etsy-image-loader";

const ETSY = "https://i.etsystatic.com/60870456/r/il/a6356d/8751463630/il_570xN.8751463630_kh0l.jpg";
const variantOf = (url: string) => url.match(/il_[^.]*/)?.[0];

describe("etsyImageLoader", () => {
  /*
    The whole point: a product photo must not reach /_next/image. Every billed
    transformation came from there, and once the allowance ran out the optimizer answered
    402 on each cache miss and the card rendered as a broken image.
  */
  it("never routes an Etsy photo through the optimizer", () => {
    for (const width of [16, 256, 384, 640, 828, 1080, 1200, 1920, 3840]) {
      const url = etsyImageLoader({ src: ETSY, width });
      expect(url, String(width)).not.toContain("/_next/image");
      expect(url, String(width)).toContain("i.etsystatic.com");
    }
  });

  it("keeps local assets on the built-in optimizer", () => {
    const url = etsyImageLoader({ src: "/logo-mark.png", width: 384 });
    expect(url).toBe("/_next/image?url=%2Flogo-mark.png&w=384&q=75");
    expect(etsyImageLoader({ src: "/logo-mark.png", width: 384, quality: 85 })).toContain("q=85");
  });

  it("picks a variant big enough for the request", () => {
    expect(variantOf(etsyImageLoader({ src: ETSY, width: 256 }))).toBe("il_570xN");
    expect(variantOf(etsyImageLoader({ src: ETSY, width: 640 }))).toBe("il_794xN");
    expect(variantOf(etsyImageLoader({ src: ETSY, width: 1080 }))).toBe("il_1140xN");
    expect(variantOf(etsyImageLoader({ src: ETSY, width: 1920 }))).toBe("il_fullxfull");
  });

  /*
    Next asks for 828 where the ladder offers 794 and 1140. Taking 1140 there doubles the
    bytes on the phone grid, which is the majority of this traffic, for a 4% resolution
    gain that object-cover hides.
  */
  it("accepts a slightly small variant rather than doubling the bytes", () => {
    expect(variantOf(etsyImageLoader({ src: ETSY, width: 828 }))).toBe("il_794xN");
    expect(variantOf(etsyImageLoader({ src: ETSY, width: 1200 }))).toBe("il_1140xN");
  });

  it("never upscales past the largest variant", () => {
    expect(variantOf(etsyImageLoader({ src: ETSY, width: 99999 }))).toBe("il_fullxfull");
  });

  /*
    The cropped variants are excluded deliberately. il_170x135 and il_340x270 are 4:3
    renders of a square photo, so mixing them into the srcset would re-frame the picture
    as the viewport crossed a breakpoint.
  */
  it("never serves a cropped variant", () => {
    for (const width of [16, 32, 64, 128, 170, 256, 340]) {
      expect(variantOf(etsyImageLoader({ src: ETSY, width })), String(width)).toBe("il_570xN");
    }
  });

  it("rewrites whatever variant the catalog happens to store", () => {
    for (const stored of ["il_fullxfull", "il_170x135", "il_1140xN", "il_340x270"]) {
      const src = ETSY.replace("il_570xN", stored);
      expect(variantOf(etsyImageLoader({ src, width: 640 })), stored).toBe("il_794xN");
    }
  });

  it("leaves the rest of the URL alone", () => {
    const url = etsyImageLoader({ src: ETSY, width: 640 });
    expect(url).toBe(ETSY.replace("il_570xN", "il_794xN"));
  });
});
