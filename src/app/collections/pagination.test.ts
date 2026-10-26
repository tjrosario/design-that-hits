import { describe, expect, it } from "vitest";
import { parsePageNumber } from "@/lib/pagination";

/**
 * `/^[2-9]\d*$/` looks like "two or more" and reads as "starts with 2 through 9", so
 * every page number beginning with 1 was rejected. /collections/wrapping-paper/pages/10
 * through 14 sat in the sitemap and returned 404 in production.
 */
describe("parsePageNumber", () => {
  it("accepts page numbers starting with 1", () => {
    for (const n of ["10", "11", "14", "19", "100", "123"]) {
      expect(parsePageNumber(n), `page ${n}`).toBe(Number(n));
    }
  });

  it("accepts ordinary page numbers", () => {
    for (const n of ["2", "3", "9", "24", "57"]) expect(parsePageNumber(n)).toBe(Number(n));
  });

  // Page one is the bare collection URL, so /pages/1 would be a duplicate of it.
  it("rejects anything that is not a page past the first", () => {
    for (const n of ["0", "1", "-2", "02", "007", "2.5", "", " ", "abc", "3a", "1e3"]) {
      expect(parsePageNumber(n), `input ${JSON.stringify(n)}`).toBeNull();
    }
  });

  it("rejects a number too large to be safe", () => {
    expect(parsePageNumber("99999999999999999999")).toBeNull();
  });
});
