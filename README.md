# Design That Hits – Storefront

A production-ready Next.js 16 storefront for [designthathits.etsy.com](https://designthathits.etsy.com), with full search, filtering, sorting, and pagination.

> **Note on product data.** This storefront was originally built against Etsy API v3. Etsy denied the API application, so products now come from a local catalog (`src/data/catalog.json`) with the public Etsy RSS feed layered on top for new arrivals. Neither source needs credentials. See [Product Data Sources](#product-data-sources). The Etsy API client is still present and dormant: set `ETSY_API_KEY` and the storefront switches back to it with no code changes.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Setup](#setup)
4. [Environment Variables](#environment-variables)
5. [Product Data Sources](#product-data-sources)
6. [Project Structure](#project-structure)
7. [Feature Documentation](#feature-documentation)
8. [Deployment to Vercel](#deployment-to-vercel)
9. [Manual Test Plan](#manual-test-plan)
10. [Caching Strategy](#caching-strategy)
11. [Known Limitations](#known-limitations)

---

## Architecture Overview

The storefront is a **Next.js 16 App Router** application. The home page is a server component that fetches shop sections at build/revalidation time. Client-side navigation updates URL query params, which trigger `useEffect`-based fetches to `/api/listings`, a route handler that resolves products on the server.

**Data flow:**
```
User action (search/filter/sort/pill)
  → Update URL params (router.push, no full reload)
  → ProductGridContainer useEffect detects param change
  → fetch /api/listings?...
  → Route handler calls lib/shop.ts
       → lib/catalog.ts   (src/data/catalog.json, the full catalog)
       → lib/rss.ts       (public Etsy feed, 10 newest, layered on top)
       → lib/etsy.ts      (Etsy API v3, only when ETSY_API_KEY is set)
  → Returns JSON → Renders ProductGrid
```

`lib/shop.ts` is the only module pages and route handlers import. It picks the source and returns the same `Listing` / `ShopSection` shapes either way, so nothing downstream knows or cares which one answered.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Images | next/image (optimized) |
| Product data | Local catalog JSON + public Etsy RSS feed (Etsy API v3 optional) |
| Deployment | Vercel |

---

## Setup

### Prerequisites

- Node.js 20.9+ (required by Next.js 16)
- npm or yarn or pnpm

No Etsy credentials are required.

### Installation

```bash
# Clone the repo
git clone <your-repo-url>
cd design-that-hits

# Install dependencies
npm install

# Copy env vars (all of them are optional)
cp .env.example .env.local

# Pull the newest listings from the public Etsy feed into the catalog
npm run sync:catalog

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SITE_URL` | Recommended | Your deployed site URL for SEO/OG metadata |
| `SHOP_DATA_SOURCE` | Optional | `auto` (default), `catalog`, or `etsy`. `auto` uses the Etsy API when `ETSY_API_KEY` is set, otherwise the local catalog |
| `SHOP_DISABLE_RSS` | Optional | Set to `1` to skip the live RSS overlay and serve only `catalog.json` |
| `ETSY_API_KEY` | Optional | Etsy API v3 keystring. Unavailable to us today. Setting it switches the storefront back to the live API |
| `RESEND_API_KEY` | Optional | For contact form email integration |
| `CONTACT_EMAIL` | Optional | Email to receive contact form submissions |

---

## Product Data Sources

Etsy denied our API v3 application, so the storefront gets products from the two sources
that are available to a shop owner without API access. Scraping the shop page is not one
of them: Etsy serves a 403 and a CAPTCHA to non-browser clients, and it would breach their
terms of service.

### 1. Local catalog (primary)

`src/data/catalog.json` holds the full catalog and is the source of truth. It is a plain,
hand-editable JSON file, imported at build time so it works in any runtime and costs
nothing per request. The tradeoff is that editing it requires a rebuild, which is fine
because it changes when you publish a product, not per request.

Only `title` is required per listing. Everything else has a sensible default. The listing
ID is derived from the Etsy URL when there is one, and synthesised from the title when
there is not (see the CSV backfill section below).

### 2. Public RSS feed (freshness overlay)

Every Etsy shop publishes `https://www.etsy.com/shop/<name>/rss` with no authentication.
`lib/shop.ts` layers it over the catalog at request time, so a product you list on Etsy
appears on the site within the 15 minute cache window without a redeploy.

**The feed returns only the 10 most recent listings.** There is no pagination, no search,
and no section data. It is a freshness signal, not a catalog, which is exactly why the
local catalog exists. If the feed is unreachable, the storefront quietly serves the
catalog alone.

The merge precedence is deliberate:

| Field | Wins from | Why |
|-------|-----------|-----|
| title, price, image, description | RSS | The feed reflects what Etsy shows buyers right now |
| sectionId, tags, favorites, views | Catalog | The feed does not carry them, so an overwrite would erase them |
| listings only in the feed | Added | New products published since your last sync |

### Keeping the catalog up to date

```bash
# Pull the 10 newest listings from the public feed and merge them in
npm run sync:catalog

# Backfill the entire shop from Etsy's own CSV export (see below)
npm run sync:catalog -- --csv ~/Downloads/EtsyListingsDownload.csv

# See what would change without writing
npm run sync:catalog -- --dry-run
```

Run the plain command regularly and the catalog accumulates every new listing as you
publish it. Fields you curate by hand (`sectionId`, `tags`, `favorites`, `views`) are never
overwritten by a sync; only the volatile ones are refreshed.

### Backfilling everything you listed before adopting this

The RSS feed only reaches back 10 listings, so use Etsy's own export to get everything else:

1. Etsy Shop Manager → Settings → Options → Download Data
2. Download **"Currently for sale listings"**
3. `npm run sync:catalog -- --csv <path-to-csv>`

That is the whole process. No per-listing curation, and re-running it is safe.

The export is complete, first-party data you already own, and it carries real Etsy **tags**
along with title, description, price, images, and SKU. Its one gap is that it contains no
listing IDs or URLs. Rather than block on that:

- Products imported from the CSV get a **stable synthetic ID** derived from the title, so
  they keep their identity across syncs.
- Their link points at a **shop-scoped Etsy search** for the exact title, which lands the
  buyer inside your shop on that product. One hop less direct than a listing link, but it
  needs no input from you.
- Whenever the RSS feed later surfaces one of those products, the sync **upgrades it to
  the real listing URL** automatically and reports how many it upgraded.

So every product is visible, searchable, and clickable from the moment you import.

### Getting real listing links for everything

For a shop with hundreds of products, shop-search links are a poor default: only ~10 ever
pass through the RSS window, so nearly everything would stay one hop from its listing.

`scripts/etsy-collect-listings.js` closes that gap. It collects every listing's ID and URL,
which is precisely what the CSV lacks.

It runs **in your own browser**, not on the server, and that is deliberate. Etsy answers
automated clients, including headless browsers, with a 403 and a CAPTCHA, so a server-side
scraper does not work and making one work would mean building bot-detection evasion. Your
logged-in browser has no such problem: it is a real session already entitled to view these
pages, and the script does what scrolling your shop does.

Be aware this is still automated collection against Etsy, which their Terms of Use
restrict. It is your shop and your data, and the call is yours.

```
1. Log in to Etsy, open https://www.etsy.com/shop/<YourShop>
2. DevTools (F12) → Console → paste scripts/etsy-collect-listings.js → Enter
   (you may need to type `allow pasting` first)
3. It walks your shop pages and downloads etsy-listings.json
4. npm run sync:catalog -- --json ~/Downloads/etsy-listings.json
```

**Run both imports for a complete catalog.** They carry disjoint data and merge by title:

| Import | Supplies | Missing |
|---|---|---|
| `--csv` | descriptions, prices, tags, hi-res images, SKU | listing IDs and URLs |
| `--json` | listing IDs and real URLs | descriptions and tags |

Order does not matter and re-running is safe. Where both have a value the better one wins:
the collector scrapes titles from image alt text (which Etsy truncates) and grid
thumbnails, so those never overwrite the CSV's full titles and hi-res images. Titles that
were truncated still match, via a prefix match that is only accepted when exactly one
catalog entry is a candidate, so an ambiguous match can never silently merge two products.

### Categories need to be defined by hand

Shop sections are the one thing neither source provides. Define them yourself in
`catalog.json`, then tag each listing:

```json
{
  "sections": [
    { "id": 1, "title": "Wrapping Paper" },
    { "id": 2, "title": "Ornaments" }
  ],
  "listings": [
    { "id": 4411327796, "title": "...", "url": "...", "sectionId": 1 }
  ]
}
```

IDs are yours to choose. They only need to be unique and stable, since they end up in the
`?sections=` URL param. Section counts are recomputed from the listings, so they cannot
drift. Until at least one section exists, the "Shop by Category" block and the category
filters are hidden, and everything else works normally.

### Best Sellers and Trending

`rank.ts` ranks on `numFavorers` and `views`. Neither the RSS feed nor the CSV export
provides them, so they default to 0 and both pills fall back to newest-first. Etsy shows a
public favorite count on each listing; filling in `favorites` in `catalog.json` for your
top products is what makes those two views meaningful.

### If Etsy ever approves an API application

Set `ETSY_API_KEY` and everything switches back to the live API. `lib/etsy.ts` is intact
and still speaks the same contract. Set `SHOP_DATA_SOURCE=catalog` to pin the local
catalog regardless.

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout, metadata, header/footer
│   ├── page.tsx                # Home page (server component)
│   ├── globals.css             # Tailwind + global styles
│   ├── sitemap.ts              # Auto-generated sitemap
│   ├── robots.ts               # robots.txt
│   ├── about/
│   │   └── page.tsx            # About page
│   ├── contact/
│   │   └── page.tsx            # Contact page
│   └── api/
│       ├── listings/route.ts   # Etsy listings proxy
│       ├── sections/route.ts   # Etsy sections proxy
│       └── contact/route.ts    # Contact form handler (stub)
├── components/
│   ├── layout/
│   │   ├── Header.tsx          # Sticky nav header
│   │   └── Footer.tsx          # Footer
│   ├── filters/
│   │   ├── SearchBar.tsx       # Debounced search input
│   │   ├── SegmentedPills.tsx  # New/Best/Trending pills
│   │   ├── SortDropdown.tsx    # Sort select
│   │   ├── CategoryChips.tsx   # Horizontal scroll chips
│   │   ├── FiltersSidebar.tsx  # Desktop sticky sidebar
│   │   └── FiltersDrawer.tsx   # Mobile slide-over drawer
│   ├── products/
│   │   ├── ProductGridContainer.tsx  # Data fetching + pagination
│   │   ├── ProductGrid.tsx           # Grid layout + states
│   │   ├── ProductCard.tsx           # Individual product card
│   │   ├── ProductCardSkeleton.tsx   # Loading skeleton
│   │   └── Pagination.tsx            # Page controls
│   ├── ShopFront.tsx           # Main orchestrator component
│   ├── ContactForm.tsx         # Contact form client component
│   └── JsonLd.tsx              # JSON-LD structured data
├── data/
│   └── catalog.json            # THE PRODUCT CATALOG (hand-editable, source of truth)
├── lib/
│   ├── shop.ts                 # Source facade — the only one pages/routes import
│   ├── catalog.ts              # Local catalog source + in-memory query engine
│   ├── rss.ts                  # Public Etsy shop feed client (10 newest, no auth)
│   ├── rss-parse.mjs           # Shared feed parser (also used by scripts/)
│   ├── etsy.ts                 # Etsy API v3 client — dormant, needs ETSY_API_KEY
│   ├── query.ts                # URL param parse/serialize + sync rules
│   └── rank.ts                 # Trending/Best sellers heuristics
└── types/
    ├── etsy.ts                 # Etsy API + app-level types
    ├── catalog.ts              # catalog.json shape
    └── shop.ts                 # Shared result/error contract for all sources

scripts/
├── sync-catalog.mjs            # Builds catalog.json from RSS, an Etsy CSV export, or collected JSON
└── etsy-collect-listings.js    # Browser-console collector — gets listing IDs + real URLs
```

---

## Feature Documentation

### Sync Rules: Pills ↔ Sort Dropdown

| Action | Result |
|--------|--------|
| Click "New" pill | Sets `sort=newest`, `pill=new` |
| Click "Best Sellers" pill | Sets `pill=best`, `sort=newest` (for API fetch), clears price sort |
| Click "Trending" pill | Sets `pill=trending`, `sort=newest` (for API fetch), clears price sort |
| Active pill clicked again | Deactivates pill (toggle off), falls back to `sort=newest` |
| Select "Price: Low→High" | Sets `sort=price_asc`, clears `pill` |
| Select "Price: High→Low" | Sets `sort=price_desc`, clears `pill` |
| Select "Newest" from dropdown | Sets `sort=newest`, keeps `pill=new` if set, else clears pill |

All state is **URL-driven** — links are shareable and bookmarkable.

### Category Chips Behavior

Chips use **multi-select** toggle behavior on both desktop and mobile. Clicking a chip toggles that category in/out of the selection. Clicking "All" deselects everything.

### Trending / Best Sellers Fallbacks

Since Etsy API v3 does not expose sales count:

**Best Sellers:** Ranked by `num_favorers` descending (favorites count is the best public proxy for popularity). Tie-broken by `views`.

**Trending:** Score = `(num_favorers / daysSinceCreated) × recencyBoost`. Items < 30 days old get 2× boost, items < 90 days old get 1.5×. This approximates rising engagement velocity.

Both fall back to newest-first when engagement data is missing, which is the case for
every listing until you fill in `favorites` in `catalog.json`. Without that final tiebreak
the ordering would be arbitrary rather than merely uninformative.

These heuristics are clearly marked in `src/lib/rank.ts`.

---

## Deployment to Vercel

### One-Click Deploy

1. Push this repo to GitHub/GitLab/Bitbucket
2. Import to [Vercel](https://vercel.com/new)
3. Vercel auto-detects Next.js — no configuration needed
4. Add environment variables in **Project Settings → Environment Variables**:
   - `NEXT_PUBLIC_SITE_URL` → e.g. `https://designthathits.com`

No Etsy credentials are needed. `src/data/catalog.json` is committed, so the build has
everything it needs. Run `npm run sync:catalog` and commit the result whenever you want
the deployed catalog refreshed.

### Manual Deploy

```bash
npm install -g vercel
vercel --prod
```

### Custom Domain

In Vercel Project Settings → Domains, add your custom domain. Update `NEXT_PUBLIC_SITE_URL` to match.

---

## Manual Test Plan

### Setup
- [ ] `npm run sync:catalog` reports listings and writes `src/data/catalog.json`
- [ ] Re-running it reports `0 added` (the merge is idempotent)
- [ ] `npm run dev` starts without errors
- [ ] Home page loads at `localhost:3000` and shows real products

### API Health
- [ ] `GET /api/sections` returns JSON with `sections` array
- [ ] `GET /api/listings` returns JSON with `listings` and `total`
- [ ] `GET /api/listings?q=gift` returns filtered results

### Search
- [ ] Type in search box — debounces ~400ms before fetching
- [ ] Results update to match query
- [ ] Clearing search returns all results
- [ ] URL updates to `?q=<term>` and is shareable

### Filtering
- [ ] Clicking a category chip filters products
- [ ] Multiple chips can be selected simultaneously
- [ ] "All" chip deselects all categories
- [ ] Sidebar checkboxes mirror chip state
- [ ] Applied filter count shows in mobile filter button
- [ ] Filter summary shows "N categories selected" in sidebar

### Sorting + Pills
- [ ] "New" pill activates → products sorted newest first
- [ ] "Best Sellers" pill activates → sorted by num_favorers
- [ ] "Trending" pill activates → sorted by trending score
- [ ] Clicking active pill again deactivates it
- [ ] "Price: Low→High" from dropdown clears active pill
- [ ] "Newest" from dropdown + "New" pill = compatible state
- [ ] All states reflected in URL query params

### Mobile
- [ ] "Filters" button opens slide-over drawer
- [ ] Drawer has focus trap (Tab cycles within drawer)
- [ ] Escape key closes drawer
- [ ] Category chips scroll horizontally
- [ ] Grid is 1-column on mobile

### Pagination
- [ ] Prev/Next buttons work
- [ ] Page numbers render correctly with ellipsis for large ranges
- [ ] Current page is highlighted with `aria-current="page"`
- [ ] Page resets to 1 when search/filter changes

### Accessibility
- [ ] Skip-to-content link appears on focus (Tab from page load)
- [ ] All interactive elements are keyboard navigable
- [ ] Product cards have descriptive `aria-label`
- [ ] Filter drawer uses `role="dialog"` and `aria-modal="true"`
- [ ] Search input has visible label (screen reader only)
- [ ] Color contrast meets WCAG AA (4.5:1 for normal text)

### SEO
- [ ] `<title>` tag is correct on home, about, contact
- [ ] OG meta tags present in `<head>`
- [ ] JSON-LD `WebSite` and `CollectionPage` present on home page
- [ ] `/sitemap.xml` returns valid XML
- [ ] `/robots.txt` allows crawling

### Error States
- [ ] Empty `listings` in `catalog.json` → friendly error shown in grid
- [ ] `SHOP_DISABLE_RSS=1` → storefront still renders from the catalog alone
- [ ] Empty search term + obscure category → "No results" + Clear button shown

### Performance
- [ ] Images load with `next/image` (optimized, lazy)
- [ ] Skeleton grid shows during loading
- [ ] No layout shift on load

---

## Caching Strategy

### Catalog source (current default)

| Data | Cache Duration | Strategy |
|------|---------------|----------|
| `catalog.json` | Until next deploy | Bundled at build time |
| Normalised listings | Process lifetime | In-memory, computed once |
| RSS overlay | 15 minutes | Next fetch revalidate |

**Tradeoffs:**
- Catalog reads are free, so search, filter, sort and pagination all run in memory with no upstream calls and no rate limits to respect
- A newly published Etsy listing appears within 15 minutes through the RSS overlay, with no redeploy
- Edits to existing catalog entries need a rebuild, since the JSON is bundled
- Set `SHOP_DISABLE_RSS=1` for fully reproducible builds with no network dependency

### Etsy API source (only when `ETSY_API_KEY` is set)

| Data | Cache Duration | Strategy |
|------|---------------|----------|
| Shop ID | 24 hours | In-memory + Next fetch cache |
| Shop sections | 30 minutes | Next fetch revalidate |
| Listings | 10 minutes | Next fetch revalidate per URL |
| Ranking (best/trending) | 10 minutes | Next fetch revalidate |

---

## Known Limitations

These all stem from having no Etsy API access. See [Product Data Sources](#product-data-sources).

1. **The catalog is synced, not fetched live.** Only the 10 newest listings arrive automatically via RSS. Everything else gets into `catalog.json` by re-running `npm run sync:catalog -- --csv <export>` after downloading a fresh export. There is no way around that download: the API is denied, the RSS feed is hard-capped at 10 with no pagination, and Etsy serves a CAPTCHA to any automated browser hitting the shop page.
2. **CSV-imported products link via shop search** until you also run the browser collector (`--json`). Etsy's export has no listing URLs. They are fully visible and searchable either way.
3. **Categories are hand-defined.** Neither the RSS feed nor the CSV export includes shop sections, so `sections` in `catalog.json` is yours to maintain. Until you add one, the category UI is hidden.
4. **No favorites or view counts.** Both default to 0, so "Best Sellers" and "Trending" fall back to newest-first until you fill in `favorites` by hand.
5. **No real-time inventory.** Nothing tells us when an item sells out, so a sold-out listing can stay visible until the next sync. Clicking through to Etsy always shows the true state.
6. **Catalog edits need a rebuild.** `catalog.json` is bundled at build time. New listings still appear without one, via the RSS overlay.
7. **Contact form is a stub.** Integrate Resend, SendGrid, or similar to send actual emails.
