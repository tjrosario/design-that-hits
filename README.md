# Design That Hits – Storefront

A production-ready Next.js 14 storefront for [designthathits.etsy.com](https://designthathits.etsy.com). Pulls live Etsy listings via Etsy API v3 and presents them with full search, filtering, sorting, and pagination.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Setup](#setup)
4. [Environment Variables](#environment-variables)
5. [Etsy API Auth Notes](#etsy-api-auth-notes)
6. [Project Structure](#project-structure)
7. [Feature Documentation](#feature-documentation)
8. [Deployment to Vercel](#deployment-to-vercel)
9. [Manual Test Plan](#manual-test-plan)
10. [Caching Strategy](#caching-strategy)
11. [Known Limitations](#known-limitations)

---

## Architecture Overview

The storefront is a **Next.js 14 App Router** application. The home page is a server component that fetches shop sections at build/revalidation time. Client-side navigation updates URL query params, which trigger `useEffect`-based fetches to `/api/listings` — a route handler that calls the Etsy API on the server, keeping your API key secret.

**Data flow:**
```
User action (search/filter/sort/pill)
  → Update URL params (router.push, no full reload)
  → ProductGridContainer useEffect detects param change
  → fetch /api/listings?...
  → Route handler calls lib/etsy.ts → Etsy API v3
  → Returns JSON → Renders ProductGrid
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Images | next/image (optimized) |
| API | Etsy API v3 (keystring auth) |
| Deployment | Vercel |

---

## Setup

### Prerequisites

- Node.js 18.17+ (required by Next.js 14)
- npm or yarn or pnpm
- An Etsy developer account and API key

### Installation

```bash
# Clone the repo
git clone <your-repo-url>
cd design-that-hits

# Install dependencies
npm install

# Copy and fill in env vars
cp .env.example .env.local
# Edit .env.local with your ETSY_API_KEY

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ETSY_API_KEY` | ✅ Yes | Your Etsy API v3 keystring |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Your deployed site URL for SEO/OG metadata |
| `RESEND_API_KEY` | Optional | For contact form email integration |
| `CONTACT_EMAIL` | Optional | Email to receive contact form submissions |

---

## Etsy API Auth Notes

### Authentication Method: API Key (Keystring)

Etsy API v3 supports two auth methods:
1. **OAuth 2.0** – Required for actions on behalf of a user (checkout, orders, etc.)
2. **API Key (keystring)** – Sufficient for **public read-only** data

This storefront uses **API Key only**. No OAuth flow is needed because we only read:
- Shop info (public)
- Shop sections (public)
- Active listings (public)

### Getting Your API Key

1. Go to [Etsy Developers](https://www.etsy.com/developers/your-apps)
2. Create a new app (or use an existing one)
3. Copy the **Keystring** (shown on your app page)
4. Set it as `ETSY_API_KEY` in your `.env.local`

### Rate Limits

Etsy API v3 has a rate limit of **10 requests/second** with burst capacity. Our implementation:
- Caches responses (10–30 min via Next.js fetch cache)
- Uses exponential backoff on 429 responses (up to 3 retries)
- Caches shop_id for 24 hours (rarely changes)

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
├── lib/
│   ├── etsy.ts                 # Etsy API client (retry, cache)
│   ├── query.ts                # URL param parse/serialize + sync rules
│   └── rank.ts                 # Trending/Best sellers heuristics
└── types/
    └── etsy.ts                 # TypeScript types
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

These heuristics are clearly marked in `src/lib/rank.ts`.

---

## Deployment to Vercel

### One-Click Deploy

1. Push this repo to GitHub/GitLab/Bitbucket
2. Import to [Vercel](https://vercel.com/new)
3. Vercel auto-detects Next.js — no configuration needed
4. Add environment variables in **Project Settings → Environment Variables**:
   - `ETSY_API_KEY` → your Etsy keystring
   - `NEXT_PUBLIC_SITE_URL` → e.g. `https://designthathits.com`

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
- [ ] `ETSY_API_KEY` is set in `.env.local`
- [ ] `npm run dev` starts without errors
- [ ] Home page loads at `localhost:3000`

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
- [ ] Remove `ETSY_API_KEY` → friendly error shown in grid
- [ ] Empty search term + obscure category → "No results" + Clear button shown

### Performance
- [ ] Images load with `next/image` (optimized, lazy)
- [ ] Skeleton grid shows during loading
- [ ] No layout shift on load

---

## Caching Strategy

| Data | Cache Duration | Strategy |
|------|---------------|----------|
| Shop ID | 24 hours | In-memory + Next fetch cache |
| Shop sections | 30 minutes | Next fetch revalidate |
| Listings | 10 minutes | Next fetch revalidate per URL |
| Ranking (best/trending) | 10 minutes | Next fetch revalidate |

**Tradeoffs:**
- Longer cache = fewer API calls = lower chance of rate limiting
- Shorter cache = fresher data
- New listings may take up to 10 minutes to appear in the storefront
- For a shop updating listings infrequently, 30-minute caching is ideal

---

## Known Limitations

1. **No real-time sales data** — Etsy API v3 does not expose sales count for public shops. "Best Sellers" uses `num_favorers` as a proxy.
2. **100 listing cap for ranking** — Trending/Best Sellers fetch up to 100 listings (Etsy max per page). For shops with 100+ listings, early results may not include all items.
3. **Search limited to title/tags/description** — Etsy's public listing search endpoint matches on keywords; it does not support advanced boolean search.
4. **No real-time inventory** — Listing availability is cached; sold-out items may briefly appear.
5. **Contact form is a stub** — Integrate Resend, SendGrid, or similar to send actual emails.
