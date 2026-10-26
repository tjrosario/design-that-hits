/**
 * Paged collection URLs.
 *
 * In a lib rather than in the page module because Next only lets a route or page export
 * handlers and segment config; anything else fails type checking on a --webpack build,
 * and this is imported by a test.
 */

/*
  Only real page numbers resolve; `/pages/0`, `/pages/1`, `/pages/02` and junk all 404.

  The bound is checked numerically, not by the leading digit. `/^[2-9]\d*$/` looks like
  "two or more" but reads as "starts with 2 through 9", so it rejected every page from 10
  to 19: /collections/wrapping-paper/pages/10 through 14 were listed in the sitemap and
  served a 404.
*/
export function parsePageNumber(raw: string): number | null {
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= 2 ? n : null;
}
