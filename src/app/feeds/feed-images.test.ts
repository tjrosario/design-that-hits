import { describe, expect, it } from "vitest";
import { GET } from "@/app/feeds/pinterest.tsv/route";

/**
 * The catalog feed must keep the clean product photo.
 *
 * The save button pins a generated 2:3 composite carrying the product name and the brand
 * line. That is right for an organic pin and wrong for a catalog row: Pinterest's
 * merchant guidance treats text overlays and logos on a catalog image as a quality
 * problem, and a rejected catalog takes all 400-odd pins down with it.
 *
 * Nothing in the type system stops someone swapping `image_link` to `pinImageUrl` the
 * next time the two surfaces are made to agree, so it is asserted here instead.
 */
describe("pinterest catalog feed images", () => {
  it("sends the Etsy photo, never the generated pin image", async () => {
    const body = await (await GET()).text();
    const [header, ...rows] = body.trim().split("\n");
    const imageColumn = header.split("\t").indexOf("image_link");
    expect(imageColumn).toBeGreaterThanOrEqual(0);
    expect(rows.length).toBeGreaterThan(400);

    for (const row of rows) {
      const image = row.split("\t")[imageColumn];
      expect(image, row.split("\t")[0]).toMatch(/^https:\/\/i\.etsystatic\.com\//);
      expect(image, row.split("\t")[0]).not.toContain("/pin-image");
    }
  });

  // Pinterest wants at least 1000px, and about a quarter of the catalog stores a 570px
  // thumbnail, so the feed asks for the full-size variant.
  it("asks Etsy for the full-size variant", async () => {
    const body = await (await GET()).text();
    const [header, ...rows] = body.trim().split("\n");
    const imageColumn = header.split("\t").indexOf("image_link");

    for (const row of rows) {
      expect(row.split("\t")[imageColumn]).toContain("il_fullxfull.");
    }
  });
});
