import { describe, expect, it } from "vitest";
import { GET } from "@/app/feeds/pinterest.tsv/route";

/**
 * Two feed rows must never land on one URL.
 *
 * A duplicate's page canonicalises to the other copy and advertises that copy's og:url, so
 * publishing both rows gives Pinterest two catalog products resolving to a single landing
 * page. A rejected catalog takes all 400-odd pins down with it, so the rows are dropped.
 */
describe("pinterest catalog feed duplicate handling", () => {
  const DUPLICATES = [4415243885, 4415238112, 4396574071];
  const PRIMARIES = [4408182930, 4408195937, 4396573340];

  it("drops the duplicates and keeps the pages they point at", async () => {
    const body = await (await GET()).text();
    const [header, ...rows] = body.trim().split("\n");
    const idColumn = header.split("\t").indexOf("id");
    expect(idColumn).toBeGreaterThanOrEqual(0);

    const ids = new Set(rows.map((r) => Number(r.split("\t")[idColumn])));
    for (const id of DUPLICATES) expect(ids.has(id), `duplicate ${id}`).toBe(false);
    for (const id of PRIMARIES) expect(ids.has(id), `primary ${id}`).toBe(true);
  });

  it("never publishes the same landing page twice", async () => {
    const body = await (await GET()).text();
    const [header, ...rows] = body.trim().split("\n");
    const linkColumn = header.split("\t").indexOf("link");
    const links = rows.map((r) => r.split("\t")[linkColumn].split("?")[0]);
    expect(new Set(links).size).toBe(links.length);
  });
});
