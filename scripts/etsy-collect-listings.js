/**
 * scripts/etsy-collect-listings.js
 *
 * Collects every listing in your Etsy shop (ID, URL, title, and where available price
 * and image) and downloads the result as JSON for `npm run sync:catalog -- --json`.
 *
 * ─── WHY THIS RUNS IN YOUR BROWSER, NOT ON THE SERVER ────────────────────────────
 *
 * Etsy's CSV export is the only complete source of your catalog, but it contains no
 * listing IDs or URLs, so CSV-imported products cannot link directly to their listing.
 * The public RSS feed has real URLs but is hard-capped at 10 items with no pagination.
 *
 * A server-side scraper does not work: Etsy answers automated clients, including
 * headless browsers, with a 403 and a CAPTCHA. Getting around that would mean building
 * bot-detection evasion, which is brittle and escalates badly.
 *
 * Your own browser has none of those problems. It is a real, logged-in session already
 * permitted to view these pages, and this script does exactly what scrolling your shop
 * does: same-origin fetches of your own shop pages, reading the resulting HTML.
 *
 * Note this is still automated collection against Etsy, which their Terms of Use
 * restrict. It is your shop and your data, and the call is yours.
 *
 * ─── HOW TO USE ──────────────────────────────────────────────────────────────────
 *
 *   1. Log in to Etsy and open your public shop page:
 *        https://www.etsy.com/shop/DesignThatHits
 *   2. Open DevTools (F12) → Console.
 *      Firefox/Chrome may require you to type `allow pasting` first.
 *   3. Paste this entire file and press Enter.
 *   4. It walks your shop pages, logging progress, then downloads
 *      `etsy-listings.json` to your Downloads folder.
 *   5. Back in the repo:
 *        npm run sync:catalog -- --json ~/Downloads/etsy-listings.json
 *
 * Pair it with the CSV import to get a complete, properly linked catalog:
 * the CSV supplies descriptions, prices and tags, this supplies IDs and real URLs.
 */

(async () => {
  "use strict";

  // Pace requests so this reads like browsing rather than hammering the site.
  const DELAY_MS = 1200;
  // Hard stop so a selector change or redirect loop cannot spin forever.
  const MAX_PAGES = 200;

  const shopMatch = /\/shop\/([^/?#]+)/.exec(location.pathname);
  if (!shopMatch) {
    console.error(
      "%cNot on a shop page.",
      "color:#c00;font-weight:bold",
      "\nOpen https://www.etsy.com/shop/<YourShopName> and run this again."
    );
    return;
  }
  const shopName = shopMatch[1];

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /**
   * Visible page text, with script/style/noscript stripped out.
   *
   * `body.textContent` includes the contents of <script> tags, and Etsy inlines
   * reCAPTCHA config on ordinary pages. Testing that raw text for "captcha" reports a
   * challenge on every page. Strip the non-rendered nodes before looking at the text.
   */
  function visibleText(doc) {
    const body = doc.body;
    if (!body) return "";
    const clone = body.cloneNode(true);
    clone.querySelectorAll("script,style,noscript,template").forEach((n) => n.remove());
    return (clone.textContent || "").replace(/\s+/g, " ");
  }

  /** Pulls listings out of a shop-page document. */
  function extractListings(doc) {
    const found = new Map();

    for (const anchor of doc.querySelectorAll('a[href*="/listing/"]')) {
      const href = anchor.getAttribute("href") || "";
      const idMatch = /\/listing\/(\d+)/.exec(href);
      if (!idMatch) continue;

      const id = Number(idMatch[1]);
      if (!Number.isSafeInteger(id) || id <= 0) continue;

      // Strip tracking params; keep the canonical /listing/<id>/<slug> form.
      const url = new URL(href, location.origin);
      const canonical = `${url.origin}${url.pathname}`;

      // Etsy has changed these class names repeatedly, so prefer stable signals:
      // the image alt text and the link's own title/aria-label carry the product name.
      const img = anchor.querySelector("img");
      const title =
        (anchor.getAttribute("title") || "").trim() ||
        (anchor.getAttribute("aria-label") || "").trim() ||
        (img && (img.getAttribute("alt") || "").trim()) ||
        anchor.textContent.replace(/\s+/g, " ").trim();

      const imageUrl =
        (img && (img.getAttribute("src") || img.getAttribute("data-src"))) || "";

      // Price text varies by locale and layout; take the first currency-looking string
      // inside the card and let the importer treat it as advisory only.
      const card = anchor.closest("li") || anchor.parentElement || anchor;
      const priceText = (card.textContent || "").replace(/\s+/g, " ");
      const priceMatch = /(\d[\d,]*\.\d{2})/.exec(priceText);

      // A product card usually has several anchors to the same listing (image, title,
      // sometimes the price). Merge them and keep the best value seen for each field
      // rather than trusting whichever anchor happened to come first.
      const prev = found.get(id) || { id, url: canonical, title: "", price: null, image: null };
      found.set(id, {
        id,
        url: canonical,
        title: title.length > prev.title.length ? title : prev.title,
        price: prev.price ?? (priceMatch ? Number(priceMatch[1].replace(/,/g, "")) : null),
        image: prev.image ?? (imageUrl && imageUrl.startsWith("http") ? imageUrl : null),
      });
    }

    for (const listing of found.values()) {
      if (!listing.title) listing.title = `Listing ${listing.id}`;
    }

    return [...found.values()];
  }

  // Results accumulate across runs. If Etsy only lets us read one page at a time, you
  // can click through your shop and re-run this on each page; everything merges into a
  // single download. Run `localStorage.removeItem("dth:collected")` to start over.
  const STORE_KEY = "dth:collected";

  /**
   * Reads the shop's section navigation.
   *
   * Sections are the taxonomy you curated in Etsy, and they are the one piece of data
   * neither the CSV export nor the RSS feed exposes. The shop sidebar links to each one
   * as ?section_id=<id>, so the nav gives us both the ID and the display name.
   */
  function extractSections(doc) {
    const sections = new Map();

    for (const anchor of doc.querySelectorAll('a[href*="section_id="]')) {
      const href = anchor.getAttribute("href") || "";
      const idMatch = /section_id=(\d+)/.exec(href);
      if (!idMatch) continue;

      const id = Number(idMatch[1]);
      if (!Number.isSafeInteger(id) || id <= 0) continue;

      // Nav entries read like "T-Shirts & Apparel 35" — strip the trailing count so the
      // stored title matches what a shopper sees on the chip.
      let title = (anchor.textContent || "").replace(/\s+/g, " ").trim();
      title = title.replace(/\s*\(?\d+\)?$/, "").trim();
      if (!title) continue;

      const prev = sections.get(id);
      if (!prev || title.length > prev.length) sections.set(id, title);
    }

    return [...sections.entries()].map(([id, title]) => ({ id, title }));
  }

  const all = new Map();

  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
    if (Array.isArray(saved)) {
      for (const listing of saved) {
        if (listing && Number.isSafeInteger(listing.id)) all.set(listing.id, listing);
      }
    }
  } catch {
    // Corrupt or unavailable storage is not worth failing over; start fresh.
  }

  if (all.size > 0) {
    console.log(`  carried over ${all.size} listing(s) from previous runs`);
  }

  console.log(`%cCollecting listings for ${shopName}…`, "font-weight:bold");

  // Baseline from the page already rendered in front of you. This always reflects what
  // you can actually see, so it both seeds the results and tells us whether the
  // fetch-and-parse approach below is finding the same thing.
  const liveListings = extractListings(document);
  for (const listing of liveListings) all.set(listing.id, listing);
  console.log(`  live page (rendered DOM): ${liveListings.length} listing(s)`);

  // Sections come from the nav on the rendered page, which is where Etsy puts them.
  const sections = extractSections(document);
  console.log(
    sections.length
      ? `  sections found: ${sections.map((s) => s.title).join(", ")}`
      : "  sections found: none (shop may not use them)"
  );

  let fetchWorks = true;

  /**
   * Walks a paginated shop URL, calling back with each page's listings.
   * Returns the number of pages successfully read.
   */
  async function walkPages(buildUrl, label, onPage) {
    let page = 1;
    let emptyStreak = 0;
    let pagesRead = 0;

    while (page <= MAX_PAGES) {
      const pageUrl = buildUrl(page);

      let doc;
      let finalUrl = pageUrl;
      try {
        // Same-origin and same session: this is the request the page itself would make.
        const res = await fetch(pageUrl, { credentials: "include" });
        finalUrl = res.url || pageUrl;
        if (!res.ok) {
          console.warn(`  ${label} page ${page}: HTTP ${res.status} — stopping.`);
          break;
        }
        doc = new DOMParser().parseFromString(await res.text(), "text/html");
      } catch (err) {
        console.warn(`  ${label} page ${page}: request failed (${err.message}) — stopping.`);
        break;
      }

      const listings = extractListings(doc);

      // Only suspect a challenge when the page yielded nothing. A page full of listings
      // is self-evidently the real shop, whatever words appear elsewhere in its markup.
      if (listings.length === 0) {
        const text = visibleText(doc);
        const challenged =
          /unusual traffic|verify you are a human|are you a robot|security check/i.test(text) ||
          /captcha/i.test(doc.title || "") ||
          /\/challenge|captcha/i.test(finalUrl);

        if (challenged) {
          console.warn(
            `%c  ${label} page ${page}: Etsy returned a verification challenge — stopping.`,
            "color:#c60"
          );
          console.warn(
            "  Open the shop page in a normal tab, complete the check, then re-run. " +
              "Anything collected so far is still saved below."
          );
        } else if (page === 1) {
          // Page 1 returning no listings while the rendered page has them means the grid
          // is built client-side and simply is not in the server HTML.
          fetchWorks = false;
          console.warn(`%c  ${label} page ${page}: fetched HTML contains no listing links.`, "color:#c60");
          console.log("  Diagnostics (paste these back if this is wrong):");
          console.log("    fetched title :", JSON.stringify((doc.title || "").slice(0, 120)));
          console.log("    final URL     :", finalUrl);
          console.log("    HTML length   :", doc.documentElement.outerHTML.length);
          console.log("    /listing/ hits:", (doc.documentElement.outerHTML.match(/\/listing\/\d+/g) || []).length);
          console.log("    visible text  :", JSON.stringify(text.slice(0, 200)));
        }
        break;
      }

      pagesRead++;
      const added = onPage(listings, page);

      // Etsy clamps out-of-range pages to the last real one, so "no new listings" is the
      // reliable end signal rather than an empty page. Two in a row to be safe.
      if (added === 0) {
        emptyStreak++;
        if (emptyStreak >= 2) break;
      } else {
        emptyStreak = 0;
      }

      page++;
      await sleep(DELAY_MS);
    }

    return pagesRead;
  }

  // Pass 1: the whole shop.
  await walkPages(
    (page) => `${location.origin}/shop/${shopName}?page=${page}`,
    "shop",
    (listings, page) => {
      const before = all.size;
      for (const listing of listings) {
        const prev = all.get(listing.id);
        // Preserve any section already stamped on a previous run.
        all.set(listing.id, prev ? { ...listing, ...pickSection(prev) } : listing);
      }
      const added = all.size - before;
      console.log(`  page ${page}: found ${listings.length}, new ${added}, total ${all.size}`);
      return added;
    }
  );

  function pickSection(entry) {
    return entry && entry.sectionId
      ? { sectionId: entry.sectionId, sectionTitle: entry.sectionTitle }
      : {};
  }

  // Pass 2: each section, stamping its ID onto the listings it contains. A listing can
  // only belong to one Etsy section, so the first section claiming it wins.
  for (const section of sections) {
    let stamped = 0;
    await walkPages(
      (page) =>
        `${location.origin}/shop/${shopName}?section_id=${section.id}&page=${page}`,
      `section "${section.title}"`,
      (listings) => {
        let fresh = 0;
        for (const listing of listings) {
          const entry = all.get(listing.id) || listing;
          if (!entry.sectionId) {
            entry.sectionId = section.id;
            entry.sectionTitle = section.title;
            stamped++;
            fresh++;
          }
          all.set(listing.id, entry);
        }
        return fresh;
      }
    );
    console.log(`  section "${section.title}": ${stamped} listing(s) assigned`);
    await sleep(DELAY_MS);
  }

  const listings = [...all.values()];

  if (listings.length === 0) {
    console.error(
      "%cCollected nothing.",
      "color:#c00;font-weight:bold",
      "\nNeither the rendered page nor the fetched HTML contained /listing/<id> links.",
      "\nPaste the diagnostics above back and I can adjust the extraction."
    );
    return;
  }

  if (!fetchWorks && liveListings.length > 0) {
    console.warn(
      `%cOnly the page you are looking at could be read (${liveListings.length} listing(s)).`,
      "color:#c60;font-weight:bold"
    );
    console.warn(
      "  Etsy builds the shop grid client-side, so paging via fetch returns empty HTML.\n" +
        "  Workaround: click through to the next page of your shop and re-run this script\n" +
        "  on each one. Every run merges into the same file, so nothing is lost — but tell\n" +
        "  me and I will switch this to a method that pages on its own."
    );
  }

  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(listings));
  } catch {
    console.warn("  (could not persist to localStorage; re-runs will not accumulate)");
  }

  const payload = {
    shop: shopName,
    collectedAt: new Date().toISOString(),
    sections,
    listings,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "etsy-listings.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);

  const withPrice = listings.filter((l) => l.price !== null).length;
  const withSection = listings.filter((l) => l.sectionId).length;
  console.log(
    `%cDone. ${listings.length} listing(s) collected ` +
      `(${withPrice} with a price, ${withSection} assigned to a section).`,
    "color:#080;font-weight:bold"
  );
  console.log("Saved etsy-listings.json. Next:");
  console.log("  npm run sync:catalog -- --json ~/Downloads/etsy-listings.json");
})();
