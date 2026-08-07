/**
 * lib/rss-parse.mjs
 *
 * Pure parsing logic for the Etsy public shop RSS feed. No network, no Next.js.
 *
 * Authored as ESM JavaScript rather than TypeScript on purpose: both the app
 * (via lib/rss.ts) and the standalone `npm run sync:catalog` script need it, and the
 * script runs on bare Node with no TS loader. JSDoc gives us typing on both sides.
 *
 * @typedef {import("@/types/etsy").Listing} Listing
 */

// ─── Entity decoding ──────────────────────────────────────────────────────────

/** @type {Record<string, string>} */
const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

/**
 * The feed double-encodes: the <description> body is HTML, escaped once into XML.
 * One pass gets us the HTML; htmlToText runs it again after stripping tags.
 * Idempotent on text containing no entities.
 *
 * @param {string} input
 * @returns {string}
 */
export function decodeEntities(input) {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body) => {
    if (body[0] === "#") {
      const codePoint =
        body[1] === "x" || body[1] === "X"
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return match;
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return match;
      }
    }
    const named = NAMED_ENTITIES[String(body).toLowerCase()];
    return named ?? match;
  });
}

/**
 * Turns description HTML into readable plain text, preserving paragraph breaks.
 * @param {string} html
 * @returns {string}
 */
export function htmlToText(html) {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── XML field extraction ─────────────────────────────────────────────────────

/**
 * @param {string} xml
 * @param {string} tag
 * @returns {string | null}
 */
function tagContent(xml, tag) {
  // [\s\S] rather than the s flag — keeps this parseable by older Node without transpile.
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(xml);
  if (!match) return null;
  const raw = match[1].trim();
  const cdata = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(raw);
  return cdata ? cdata[1] : raw;
}

/**
 * Etsy listing URLs are /listing/<id>/<slug>. The ID is the stable key we dedupe on.
 * @param {string} url
 * @returns {number | null}
 */
export function listingIdFromUrl(url) {
  const match = /\/listing\/(\d+)/.exec(url);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * Removes only Etsy's ?ref=rss tracking param, leaving any other query intact.
 * @param {string} url
 * @returns {string}
 */
function stripRefParam(url) {
  return url.replace(/([?&])ref=rss(&|$)/, (_m, lead, trail) =>
    lead === "?" && trail === "&" ? "?" : trail === "&" ? lead : ""
  );
}

/**
 * "21.83 USD" → { price: 21.83, currency: "USD" }
 * @param {string} descriptionHtml
 * @returns {{ price: number, currency: string } | null}
 */
function parsePrice(descriptionHtml) {
  const block = /<p class="price">([\s\S]*?)<\/p>/i.exec(descriptionHtml);
  if (!block) return null;
  const match = /([\d.,]+)\s*([A-Z]{3})/.exec(htmlToText(block[1]));
  if (!match) return null;
  // Strip thousands separators; the decimal point is always "." in this feed.
  const price = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(price)) return null;
  return { price, currency: match[2] };
}

/**
 * @param {string} descriptionHtml
 * @returns {string | null}
 */
function parseImage(descriptionHtml) {
  const match = /<img[^>]+src="([^"]+)"/i.exec(descriptionHtml);
  return match ? decodeEntities(match[1]) : null;
}

/**
 * @param {string} descriptionHtml
 * @returns {string}
 */
function parseDescriptionText(descriptionHtml) {
  const block = /<p class="description">([\s\S]*?)<\/p>/i.exec(descriptionHtml);
  return htmlToText(block ? block[1] : descriptionHtml);
}

/**
 * Drops the " by <ShopName>" suffix Etsy appends to every feed title.
 * @param {string} title
 * @param {string} [shopName]
 * @returns {string}
 */
function cleanTitle(title, shopName) {
  const trimmed = title.trim();
  if (shopName) {
    const suffix = ` by ${shopName}`;
    if (trimmed.toLowerCase().endsWith(suffix.toLowerCase())) {
      return trimmed.slice(0, -suffix.length).trim() || trimmed;
    }
  }
  return trimmed;
}

// ─── Feed parsing ─────────────────────────────────────────────────────────────

/**
 * Parses a raw RSS document into Listings.
 *
 * Returns a Result rather than throwing, matching the convention in lib/etsy.ts.
 * Items missing a usable listing ID are skipped — without one we cannot dedupe
 * against the catalog, which makes them unusable rather than merely incomplete.
 *
 * @param {string} xml
 * @returns {{ ok: true, data: Listing[] } | { ok: false, error: { code: string, message: string } }}
 */
export function parseRssFeed(xml) {
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g);

  if (!itemBlocks) {
    // A feed with zero listings is legal; a response that is not RSS at all is not.
    if (/<rss[\s>]/i.test(xml)) return { ok: true, data: [] };
    return { ok: false, error: { code: "PARSE_ERROR", message: "Response was not an RSS document" } };
  }

  // Channel title is "Etsy Shop for <ShopName>" — used to strip the per-item suffix.
  const channelTitle = tagContent(xml, "title") ?? "";
  const shopNameMatch = /Etsy Shop for\s+(.+)$/i.exec(decodeEntities(channelTitle).trim());
  const shopName = shopNameMatch ? shopNameMatch[1].trim() : undefined;

  /** @type {Listing[]} */
  const listings = [];

  for (const block of itemBlocks) {
    const rawLink = tagContent(block, "link");
    const rawTitle = tagContent(block, "title");
    if (!rawLink || !rawTitle) continue;

    const url = stripRefParam(decodeEntities(rawLink));
    const id = listingIdFromUrl(url);
    if (id === null) continue;

    const descriptionHtml = decodeEntities(tagContent(block, "description") ?? "");
    const money = parsePrice(descriptionHtml);
    const imageUrl = parseImage(descriptionHtml);
    const pubDate = tagContent(block, "pubDate");
    const publishedMs = pubDate ? Date.parse(pubDate) : NaN;
    const createdAt = Number.isFinite(publishedMs)
      ? Math.floor(publishedMs / 1000)
      : Math.floor(Date.now() / 1000);

    const title = cleanTitle(decodeEntities(rawTitle), shopName);

    listings.push({
      id,
      title,
      description: parseDescriptionText(descriptionHtml),
      url,
      price: money?.price ?? 0,
      currency: money?.currency ?? "USD",
      // The feed carries no engagement data. Zeroes are honest here — real favourite
      // and view counts are supplied by hand in catalog.json.
      numFavorers: 0,
      views: 0,
      createdAt,
      updatedAt: createdAt,
      sectionId: null,
      tags: [],
      image: imageUrl ? { url: imageUrl, altText: title } : null,
    });
  }

  return { ok: true, data: listings };
}
