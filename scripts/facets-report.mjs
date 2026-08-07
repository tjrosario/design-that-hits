#!/usr/bin/env node
/**
 * scripts/facets-report.mjs
 *
 * Prints how the facet rules in src/lib/facets.ts actually partition the live catalog.
 *
 * The rules are heuristics over titles and Etsy tags, so their value depends entirely on
 * coverage: a facet whose options miss a third of the catalog quietly hides products
 * whenever a shopper filters. Run this after changing a rule.
 *
 * The regexes are read out of facets.ts rather than imported, because that file is
 * TypeScript and this script runs on bare Node with no loader.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const facetsSrc = await readFile(path.join(REPO_ROOT, "src/lib/facets.ts"), "utf8");
const catalog = JSON.parse(
  await readFile(path.join(REPO_ROOT, "src/data/catalog.json"), "utf8")
);

/** Pulls `{ id: "x", label: "Y", pattern: /re/i }` entries out of a named rule array. */
function parseRules(arrayName) {
  const start = facetsSrc.indexOf(`const ${arrayName}`);
  if (start < 0) throw new Error(`rule array not found: ${arrayName}`);
  const end = facetsSrc.indexOf("];", start);
  const block = facetsSrc.slice(start, end);

  const rules = [];
  // Tolerates rules split across lines and a trailing comma after the pattern, both of
  // which are normal in the source and previously caused a rule to be silently dropped
  // from this report (making its products look uncategorised).
  const re =
    /\{\s*id:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*pattern:\s*\/(.+?)\/([gimsuy]*)\s*,?\s*\}/g;
  let m;
  while ((m = re.exec(block))) {
    rules.push({ id: m[1], label: m[2], pattern: new RegExp(m[3], m[4]) });
  }
  return rules;
}

const typeRules = parseRules("PRODUCT_TYPE_RULES");
const themeRules = parseRules("THEME_RULES");

const listings = catalog.listings ?? [];
const hay = (l) => `${l.title} ${(l.tags ?? []).join(" ")}`.toLowerCase();

// Mirrors deriveProductType in src/lib/facets.ts: an explicit "wrapping paper" or
// "gift wrap" in the TITLE names the product and beats motif words like "ornament";
// otherwise the title is tried before the tags.
const WRAPPING_PAPER_TITLE = /wrapping paper|gift ?wrap|giftwrap/i;
function productTypeOf(l) {
  const title = String(l.title || "").toLowerCase();
  if (WRAPPING_PAPER_TITLE.test(title)) return typeRules.find((r) => r.id === "wrapping-paper");
  return typeRules.find((r) => r.pattern.test(title)) || typeRules.find((r) => r.pattern.test(hay(l)));
}

console.log(`\ncatalog: ${listings.length} listings\n`);

// ─── Product type (first match wins) ──────────────────────────────────────────
console.log("=== PRODUCT TYPE (exclusive, first rule wins) ===");
const typeCounts = new Map();
let untyped = 0;
for (const l of listings) {
  const hit = productTypeOf(l);
  if (hit) typeCounts.set(hit.label, (typeCounts.get(hit.label) ?? 0) + 1);
  else untyped++;
}
for (const r of typeRules) {
  const c = typeCounts.get(r.label) ?? 0;
  if (c) console.log(`  ${String(c).padStart(4)}  ${r.label}`);
}
console.log(`  ${String(untyped).padStart(4)}  (uncategorised)`);
console.log(
  `  coverage: ${(((listings.length - untyped) / listings.length) * 100).toFixed(1)}%\n`
);

// ─── Theme (multi-valued) ─────────────────────────────────────────────────────
console.log("=== THEME (multi-select) ===");
let themeless = 0;
const themeCounts = new Map();
for (const l of listings) {
  const h = hay(l);
  const hits = themeRules.filter((r) => r.pattern.test(h));
  if (hits.length === 0) themeless++;
  for (const r of hits) themeCounts.set(r.label, (themeCounts.get(r.label) ?? 0) + 1);
}
for (const r of themeRules) {
  const c = themeCounts.get(r.label) ?? 0;
  if (c) console.log(`  ${String(c).padStart(4)}  ${r.label}`);
}
console.log(`  ${String(themeless).padStart(4)}  (no theme)`);
console.log(
  `  coverage: ${(((listings.length - themeless) / listings.length) * 100).toFixed(1)}%\n`
);

// ─── Uncategorised samples ────────────────────────────────────────────────────
const samples = listings.filter((l) => !productTypeOf(l)).slice(0, 10);
if (samples.length) {
  console.log("=== sample of uncategorised products ===");
  for (const l of samples) console.log(`  ${l.title.slice(0, 78)}`);
  console.log();
}
