import { describe, expect, it } from "vitest";
import { snippet } from "@/components/collections/CatalogPage";

/**
 * Preferring the last sentence end with too low a floor threw away the rest of the
 * budget: /collections/christmas has its first period at character 74, so the meta
 * description shipped 75 characters that never reached "wrapping paper" or "gothic".
 */
describe("snippet", () => {
  const LIMIT = 160;

  it("passes short copy through untouched", () => {
    const s = "Short and sweet.";
    expect(snippet(s)).toBe(s);
  });

  it("never exceeds the limit", () => {
    const cases = [
      "x".repeat(400),
      `${"word ".repeat(80)}`,
      `Short. ${"y".repeat(400)}`,
      `${"a".repeat(200)}. ${"b".repeat(200)}`,
    ];
    for (const c of cases) expect(snippet(c).length, c.slice(0, 24)).toBeLessThanOrEqual(LIMIT);
  });

  it("does not cut at an early sentence end and throw the budget away", () => {
    const intro =
      "More than two hundred Christmas designs, which is the bulk of what we make. " +
      "Mostly wrapping paper, running from traditional red and green through gothic, retro and cottagecore.";
    const out = snippet(intro);
    expect(out.length).toBeGreaterThan(120);
    expect(out).toContain("wrapping paper");
  });

  it("collapses whitespace", () => {
    expect(snippet("one   two\n\nthree")).toBe("one two three");
  });
});
