#!/usr/bin/env node
/**
 * scripts/sync-catalog.mjs
 *
 * Maintains src/data/catalog.json — the storefront's product catalog.
 *
 * Etsy denied our API v3 application, so there is no endpoint that will hand us the
 * whole shop. This script assembles the catalog from the two sources that ARE available
 * to a seller without API access:
 *
 *   1. The public shop RSS feed (default mode). Live and automatic, but only ever the
 *      10 most recently listed items. Run this regularly and the catalog accumulates
 *      every new listing as it is published.
 *
 *   2. Etsy's own CSV export (`--csv <path>`). Shop Manager → Settings → Options →
 *      Download Data → "Currently for sale listings". This is the ONLY complete
 *      snapshot of the shop, and it is first-party data you already own. Use it once to
 *      backfill everything listed before you started running mode 1.
 *
 * MERGE RULES — the point of the script:
 * Fields you curate by hand are never clobbered by a sync. Specifically, sectionId,
 * tags, favorites and views are preserved on listings that already exist in the
 * catalog. Volatile fields (title, price, image, description) are refreshed from the
 * feed, because those are the ones that actually change on Etsy.
 *
 * USAGE
 *   npm run sync:catalog                 # pull the 10 newest listings from RSS
 *   npm run sync:catalog -- --csv ~/EtsyListingsDownload.csv
 *   npm run sync:catalog -- --dry-run    # report what would change, write nothing
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseRssFeed, listingIdFromUrl, htmlToText } from "../src/lib/rss-parse.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const CATALOG_PATH = path.join(REPO_ROOT, "src", "data", "catalog.json");

const SHOP_NAME = "designthathits";
const RSS_URL = `https://www.etsy.com/shop/${SHOP_NAME}/rss`;
const USER_AGENT =
  "Mozilla/5.0 (compatible; DesignThatHitsStorefront/1.0; +https://designthathits.com)";

/** Fields a human curates in catalog.json. A sync must never overwrite these. */
const CURATED_FIELDS = ["sectionId", "tags", "favorites", "views", "featured"];

// ─── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { csv: null, json: null, dryRun: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--csv") {
      args.csv = argv[++i];
      if (!args.csv) fail("--csv requires a path to the Etsy CSV export");
    } else if (arg.startsWith("--csv=")) {
      args.csv = arg.slice("--csv=".length);
    } else if (arg === "--json") {
      args.json = argv[++i];
      if (!args.json) fail("--json requires a path to an etsy-listings.json file");
    } else if (arg.startsWith("--json=")) {
      args.json = arg.slice("--json=".length);
    } else {
      fail(`Unknown argument: ${arg}`);
    }
  }
  if (args.csv && args.json) {
    fail("Pass --csv and --json one at a time; run the script twice to combine them.");
  }
  return args;
}

function fail(message) {
  console.error(`\n  ✖ ${message}\n`);
  process.exit(1);
}

const HELP = `
  sync-catalog — build src/data/catalog.json without the Etsy API

  npm run sync:catalog                   Pull the 10 newest listings from the public RSS feed
  npm run sync:catalog -- --csv <path>   Import an Etsy CSV export (all products, no links)
  npm run sync:catalog -- --json <path>  Import collected listing IDs + URLs (real links)
  npm run sync:catalog -- --dry-run      Show what would change without writing

  For a complete, properly linked catalog, run both imports:

    1. CSV   Etsy Shop Manager → Settings → Options → Download Data
             → "Currently for sale listings"
             Supplies descriptions, prices, images and tags — but no listing URLs.

    2. JSON  Paste scripts/etsy-collect-listings.js into your browser console on
             your shop page. Supplies the listing IDs and real URLs the CSV lacks.

  Order does not matter; the two are merged by title.
`;

// ─── Catalog file I/O ─────────────────────────────────────────────────────────

function emptyCatalog() {
  return {
    shop: {
      name: "Design That Hits",
      etsyShopName: SHOP_NAME,
      url: `https://www.etsy.com/shop/${SHOP_NAME}`,
    },
    syncedAt: null,
    sections: [],
    listings: [],
  };
}

async function loadCatalog() {
  if (!existsSync(CATALOG_PATH)) return emptyCatalog();
  try {
    const raw = await readFile(CATALOG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      ...emptyCatalog(),
      ...parsed,
      sections: Array.isArray(parsed.sections) ? parsed.sections : [],
      listings: Array.isArray(parsed.listings) ? parsed.listings : [],
    };
  } catch (err) {
    fail(`Could not read ${rel(CATALOG_PATH)}: ${err.message}`);
  }
}

async function saveCatalog(catalog) {
  await mkdir(path.dirname(CATALOG_PATH), { recursive: true });
  await writeFile(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
}

function rel(p) {
  return path.relative(REPO_ROOT, p) || p;
}

// ─── RSS mode ─────────────────────────────────────────────────────────────────

async function fetchRss() {
  let res;
  try {
    res = await fetch(RSS_URL, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/rss+xml, application/xml, text/xml",
      },
    });
  } catch (err) {
    fail(`Could not reach the Etsy shop feed: ${err.message}`);
  }
  if (!res.ok) fail(`Etsy shop feed returned HTTP ${res.status}`);

  const xml = await res.text();
  const result = parseRssFeed(xml);
  if (!result.ok) fail(`Could not parse the shop feed: ${result.error.message}`);
  return result.data;
}

// ─── CSV mode ─────────────────────────────────────────────────────────────────

/**
 * Minimal RFC 4180 CSV reader — handles quoted fields, escaped quotes ("") and
 * newlines inside quotes. Etsy descriptions contain all three, so a split(",") will
 * silently mangle the import.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  // Strip a UTF-8 BOM; Etsy's export includes one and it corrupts the first header.
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') inQuotes = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\r") {
      // Handled by the \n branch; bare \r is not a row separator in Etsy exports.
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }

  // Flush a trailing row that has no terminating newline.
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/**
 * Etsy has renamed these columns across export versions, so match on a normalised
 * key rather than an exact header string.
 */
function normaliseHeader(header) {
  return header.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pick(record, ...candidates) {
  for (const candidate of candidates) {
    const value = record[normaliseHeader(candidate)];
    if (value !== undefined && value.trim() !== "") return value.trim();
  }
  return "";
}

function csvToListings(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) fail("CSV appears to be empty");

  const headers = rows[0].map(normaliseHeader);
  const listings = [];

  for (const row of rows.slice(1)) {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ?? "";
    });

    const title = pick(record, "TITLE");
    if (!title) continue;

    const priceRaw = pick(record, "PRICE");
    const price = Number(priceRaw.replace(/[^0-9.]/g, ""));

    // Etsy exports images as IMAGE1..IMAGE10; the first is the listing thumbnail.
    let imageUrl = "";
    for (let i = 1; i <= 10 && !imageUrl; i++) imageUrl = pick(record, `IMAGE${i}`);

    const tags = pick(record, "TAGS")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    // The CSV carries no listing ID and no URL. Rather than block on that, the entry
    // goes in without one: lib/catalog.ts synthesises a stable ID from the title and
    // links to a shop-scoped Etsy search, and a later RSS sync upgrades it to the real
    // listing URL. That keeps the import zero-touch.
    listings.push({
      id: 0,
      title,
      description: htmlToText(pick(record, "DESCRIPTION")),
      url: "",
      price: Number.isFinite(price) ? price : 0,
      currency: pick(record, "CURRENCY_CODE", "CURRENCY") || "USD",
      tags,
      sku: pick(record, "SKU"),
      image: imageUrl ? { url: imageUrl, altText: title } : null,
    });
  }

  return listings;
}

// ─── Collected-listings JSON mode ─────────────────────────────────────────────

/**
 * Reads the file produced by scripts/etsy-collect-listings.js.
 *
 * This is the counterpart to the CSV: it carries the listing IDs and real URLs that
 * Etsy's export omits, but little else. Price and image are best-effort scrapes of the
 * shop grid, so they are only used when the catalog has nothing better.
 */
function jsonToListings(text, sourcePath) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    fail(`${rel(sourcePath)} is not valid JSON: ${err.message}`);
  }

  const rows = Array.isArray(parsed) ? parsed : parsed.listings;
  if (!Array.isArray(rows)) {
    fail(
      `${rel(sourcePath)} has no \`listings\` array. Expected the file produced by ` +
        `scripts/etsy-collect-listings.js.`
    );
  }

  const listings = [];
  let foreign = 0;

  for (const row of rows) {
    const url = typeof row.url === "string" ? row.url.trim() : "";
    const id = Number(row.id) || listingIdFromUrl(url);
    const title = typeof row.title === "string" ? row.title.trim() : "";

    // Without an ID there is nothing here the catalog does not already have.
    if (!id || !url) continue;

    // Etsy shop pages carry "you may also like" rails that link to OTHER shops'
    // listings, and the collector cannot tell them apart from yours by URL alone.
    // It can by rendering, though: those rails lazy-load, so their entries arrive with
    // neither an image nor a price, while every real shop-grid product has an image.
    const hasImage = typeof row.image === "string" && row.image;
    const hasPrice = Number.isFinite(row.price) && row.price > 0;
    if (!hasImage && !hasPrice) {
      foreign++;
      continue;
    }

    listings.push({
      id,
      title,
      url,
      price: Number.isFinite(row.price) && row.price > 0 ? row.price : 0,
      currency: typeof row.currency === "string" ? row.currency : "",
      description: "",
      tags: [],
      // Real Etsy shop section, the one thing no other source exposes.
      sectionId: Number.isSafeInteger(row.sectionId) && row.sectionId > 0 ? row.sectionId : null,
      image: hasImage ? { url: row.image, altText: title } : null,
    });
  }

  if (foreign > 0) {
    console.log(
      `  Skipped ${foreign} entr${foreign === 1 ? "y" : "ies"} with no image and no price ` +
        `(recommendation rails linking to other shops).`
    );
  }

  // The collector also reads the shop's section nav. These are your real Etsy sections,
  // which neither the CSV export nor the RSS feed exposes.
  const sections = [];
  if (Array.isArray(parsed.sections)) {
    for (const row of parsed.sections) {
      const id = Number(row && row.id);
      const title = row && typeof row.title === "string" ? row.title.trim() : "";
      if (Number.isSafeInteger(id) && id > 0 && title) sections.push({ id, title });
    }
  }

  return { listings, sections };
}

// ─── Merge ────────────────────────────────────────────────────────────────────

function normaliseTitle(title) {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Upserts incoming listings into the catalog.
 *
 * Matching is by listing ID when the incoming item has one (RSS), falling back to a
 * normalised title match (CSV, which carries no IDs). Curated fields on an existing
 * entry always survive.
 */
function mergeListings(catalog, incoming, { source }) {
  const byId = new Map();
  // Keyed by normalised title, but holding a LIST: Etsy shops routinely have several
  // listings whose titles are identical or prefixes of one another (size or colour
  // variants listed separately). Collapsing them to one entry loses products.
  const byTitle = new Map();

  const indexByTitle = (listing) => {
    const key = normaliseTitle(listing.title ?? "");
    const bucket = byTitle.get(key);
    if (bucket) bucket.push(listing);
    else byTitle.set(key, [listing]);
  };

  for (const listing of catalog.listings) {
    if (listing.id) byId.set(listing.id, listing);
    indexByTitle(listing);
  }

  /** True when this entry is already pinned to a specific Etsy listing. */
  const realIdOf = (entry) =>
    entry.url ? listingIdFromUrl(entry.url) : null;

  // Entries matched during this run. One incoming row may claim one catalog entry, so
  // two near-identical rows can never collapse onto the same product.
  const claimed = new Set();

  const summary = { added: 0, updated: 0, unchanged: 0, searchLinked: 0, upgraded: 0 };

  /**
   * Finds the catalog entry an incoming item refers to.
   *
   * ID is authoritative. Falling back to title matters because the two imports carry
   * disjoint data: Etsy's CSV has titles but no IDs, the browser collector has IDs but
   * titles scraped from image alt text, which Etsy sometimes truncates. So an exact
   * title match is tried first, then a prefix match — but only when exactly one entry
   * is a candidate, since an ambiguous prefix would silently merge two products.
   */
  function findExisting(item) {
    if (item.id) {
      const byIdHit = byId.get(item.id);
      if (byIdHit) return byIdHit;
    }

    const key = normaliseTitle(item.title);
    if (!key) return null;

    /**
     * Two entries that each name a real, different Etsy listing are different products,
     * however similar their titles. Only entries with no listing of their own (CSV rows
     * awaiting a URL) may be claimed by title.
     */
    const eligible = (entry) => {
      if (!item.id) return true;
      const entryId = realIdOf(entry);
      return entryId === null || entryId === item.id;
    };

    /**
     * Several listings can share a title exactly — variants published separately. When
     * the import also has several rows for that title, each row should claim its own
     * entry rather than all piling onto the first (which double-merges) or none matching
     * (which duplicates the catalog). Consuming candidates in order does that: the pairing
     * within a title group is arbitrary, but the rows are indistinguishable by title
     * anyway, and the count on each side is what has to come out right.
     */
    const exact = (byTitle.get(key) || []).filter(eligible);
    const unclaimedExact = exact.find((entry) => !claimed.has(entry));
    if (unclaimedExact) return unclaimedExact;
    // Every same-title entry is already spoken for, so this row is genuinely additional.
    if (exact.length > 0) return null;

    // Prefix matching stays strict. It exists only to absorb titles the collector
    // truncated, and a short title can prefix many products, so anything ambiguous is
    // left to be added rather than guessed at.
    const candidates = [];
    for (const [otherKey, bucket] of byTitle) {
      if (!(otherKey.startsWith(key) || key.startsWith(otherKey))) continue;
      for (const entry of bucket) if (eligible(entry)) candidates.push(entry);
      if (candidates.length > 1) break;
    }
    if (candidates.length !== 1) return null;
    return claimed.has(candidates[0]) ? null : candidates[0];
  }

  for (const item of incoming) {
    const existing = findExisting(item);
    if (existing) claimed.add(existing);

    if (!existing) {
      const entry = {
        id: item.id || 0,
        title: item.title,
        description: item.description,
        url: item.url,
        price: item.price,
        currency: item.currency,
        createdAt: item.createdAt ?? Math.floor(Date.now() / 1000),
        updatedAt: item.updatedAt ?? Math.floor(Date.now() / 1000),
        sectionId: item.sectionId ?? null,
        tags: item.tags ?? [],
        favorites: 0,
        views: 0,
        image: item.image,
      };

      if (item.sku) entry.sku = item.sku;

      // No real listing URL means this came from the CSV. It still displays and links
      // (via shop search); it just isn't a direct listing link yet.
      if (!entry.url) summary.searchLinked++;

      catalog.listings.push(entry);
      if (entry.id) byId.set(entry.id, entry);
      indexByTitle(entry);
      summary.added++;
      continue;
    }

    // Refresh volatile fields only.
    const before = JSON.stringify(existing);
    const hadUrl = Boolean(existing.url);

    if (item.id && !existing.id) existing.id = item.id;
    if (item.url) existing.url = item.url;

    // The collector scrapes titles and images from the shop grid, where Etsy truncates
    // titles and serves smaller thumbnails. The CSV and RSS both carry better versions,
    // so JSON only fills gaps rather than overwriting.
    const fillOnly = source === "json";

    if (item.title && (!fillOnly || !existing.title)) existing.title = item.title;
    if (item.image && (!fillOnly || !existing.image)) existing.image = item.image;

    if (Number.isFinite(item.price) && item.price > 0) existing.price = item.price;
    if (item.currency) existing.currency = item.currency;
    if (item.description) existing.description = item.description;

    // sectionId is normally curated and left alone, but the collector reads it straight
    // from Etsy's own section nav, which outranks anything stored here.
    if (source === "json" && item.sectionId) existing.sectionId = item.sectionId;
    if (item.createdAt && !existing.createdAt) existing.createdAt = item.createdAt;
    if (item.updatedAt) existing.updatedAt = item.updatedAt;
    if (item.sku) existing.sku = item.sku;

    // CSV is the only source with real tags, so let it seed them — but never wipe
    // tags a human already curated.
    if (source === "csv" && item.tags?.length && !existing.tags?.length) {
      existing.tags = item.tags;
    }

    // The upgrade path: this entry came from the CSV with no URL, and the RSS feed has
    // now surfaced the real listing. Resolve the ID and it becomes a direct link.
    const wasSearchLinked = !hadUrl;
    if (existing.url) {
      const resolved = listingIdFromUrl(existing.url);
      if (resolved && existing.id !== resolved) existing.id = resolved;
      if (wasSearchLinked && resolved) summary.upgraded++;
    }
    delete existing._needsListingUrl; // legacy field from earlier catalog versions

    if (JSON.stringify(existing) === before) summary.unchanged++;
    else summary.updated++;
  }

  return summary;
}

/** Rebuilds section listing counts from the listings themselves so they cannot drift. */
function recountSections(catalog) {
  const counts = new Map();
  for (const listing of catalog.listings) {
    if (listing.sectionId == null) continue;
    counts.set(listing.sectionId, (counts.get(listing.sectionId) ?? 0) + 1);
  }
  for (const section of catalog.sections) {
    section.count = counts.get(section.id) ?? 0;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(HELP);
    return;
  }

  const catalog = await loadCatalog();
  const before = catalog.listings.length;

  let incoming;
  let source;

  if (args.csv) {
    const csvPath = path.resolve(process.cwd(), args.csv);
    if (!existsSync(csvPath)) fail(`CSV not found: ${csvPath}`);
    console.log(`  Reading ${rel(csvPath)} …`);
    incoming = csvToListings(await readFile(csvPath, "utf8"));
    source = "csv";
    console.log(`  Parsed ${incoming.length} listing(s) from the export.`);
  } else if (args.json) {
    const jsonPath = path.resolve(process.cwd(), args.json);
    if (!existsSync(jsonPath)) fail(`File not found: ${jsonPath}`);
    console.log(`  Reading ${rel(jsonPath)} …`);
    const collected = jsonToListings(await readFile(jsonPath, "utf8"), jsonPath);
    incoming = collected.listings;
    source = "json";
    console.log(`  Parsed ${incoming.length} listing(s) with real Etsy URLs.`);

    if (collected.sections.length > 0) {
      // Etsy is authoritative for the section list, so replace rather than merge:
      // a section you deleted on Etsy should disappear here too.
      catalog.sections = collected.sections.map((s) => ({ ...s, count: 0 }));
      console.log(
        `  Imported ${collected.sections.length} Etsy section(s): ` +
          collected.sections.map((s) => s.title).join(", ")
      );
    } else {
      console.log("  No sections in the file (collector may predate section support).");
    }
  } else {
    console.log(`  Fetching ${RSS_URL} …`);
    incoming = await fetchRss();
    source = "rss";
    console.log(`  Feed returned ${incoming.length} listing(s) (the feed caps at 10).`);
  }

  const summary = mergeListings(catalog, incoming, { source });

  // Newest first — matches the storefront's default sort and keeps diffs readable.
  catalog.listings.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  recountSections(catalog);
  catalog.syncedAt = new Date().toISOString();

  console.log(
    `\n  ${summary.added} added · ${summary.updated} updated · ${summary.unchanged} unchanged`
  );
  console.log(`  Catalog: ${before} → ${catalog.listings.length} listing(s)`);

  if (summary.upgraded > 0) {
    console.log(
      `  ${summary.upgraded} listing(s) upgraded from shop-search to a direct listing link.`
    );
  }

  // Etsy's CSV export has no listing URLs, so CSV-sourced products link to a shop-scoped
  // search instead. They display and sell fine; the link is just one hop less direct.
  const searchLinked = catalog.listings.filter((l) => !l.url).length;
  if (searchLinked > 0) {
    console.log(
      `\n  ℹ ${searchLinked} of ${catalog.listings.length} listing(s) link via shop search rather than\n` +
        `    directly, because Etsy's CSV export omits listing URLs. They are fully visible\n` +
        `    and searchable on the site. Each becomes a direct link automatically once the\n` +
        `    RSS feed surfaces it, so no action is needed.`
    );
  }

  // Etsy exposes shop sections only through the API, which we don't have access to.
  // Neither the RSS feed nor the CSV export carries them, so categories are the one
  // thing that cannot be synced and must be defined by hand — flag that loudly rather
  // than letting the category UI silently vanish from the storefront.
  const missingSection = catalog.listings.filter((l) => l.sectionId == null).length;

  if (catalog.sections.length === 0) {
    console.log(
      `\n  ⚠ No categories defined, so the "Shop by Category" section and the category\n` +
        `    filters are hidden. Neither the RSS feed nor Etsy's CSV export includes shop\n` +
        `    sections, so define them yourself in ${rel(CATALOG_PATH)}:\n\n` +
        `      "sections": [\n` +
        `        { "id": 1, "title": "Wrapping Paper" },\n` +
        `        { "id": 2, "title": "Ornaments" }\n` +
        `      ]\n\n` +
        `    then add "sectionId": 1 to each listing. IDs are yours to choose — they only\n` +
        `    need to be unique and stable, since they end up in the ?sections= URL param.`
    );
  } else if (missingSection > 0) {
    console.log(
      `\n  ℹ ${missingSection} listing(s) have no sectionId, so they won't appear under any category filter.`
    );
  }

  if (args.dryRun) {
    console.log(`\n  --dry-run: ${rel(CATALOG_PATH)} was not written.\n`);
    return;
  }

  await saveCatalog(catalog);
  console.log(`\n  ✔ Wrote ${rel(CATALOG_PATH)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
