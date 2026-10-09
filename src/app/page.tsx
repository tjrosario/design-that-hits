import type { Metadata } from "next";
import { Suspense } from "react";
import { getShopSections, getListings, getFacetGroups } from "@/lib/shop";
import { parseQuery } from "@/lib/query";
import { occasionLabel, productTypeLabel, themeLabel } from "@/lib/facets";
import {
  COLLECTION_PAGE_SIZE,
  collectionPagePath,
  collectionPath,
  getCollections,
  intersectionPath,
  resolveCollection,
  resolveIntersection,
  type Collection,
} from "@/lib/collections";
import { currentOccasions } from "@/lib/seasonal";
import { SOCIAL_URLS } from "@/lib/social";
import { CollectionTiles } from "@/components/collections/CollectionTiles";
import Link from "next/link";
import { listingPath } from "@/lib/slug";
import { ShopFront } from "@/components/ShopFront";
import { JsonLd } from "@/components/JsonLd";
import { HeroCarousel } from "@/components/HeroCarousel";
import type { Listing } from "@/types/etsy";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designthathits.com";

export const dynamic = "force-dynamic";

interface HomeProps {
  searchParams: Promise<Record<string, string>>;
}

/**
 * Human-readable name for a filtered view, used in its title and description.
 * Returns null for the unfiltered grid.
 */
function describeFilters(parsed: ReturnType<typeof parseQuery>): string | null {
  const parts = [
    ...parsed.occasions.map(occasionLabel),
    ...parsed.types.map(productTypeLabel),
    ...parsed.themes.map(themeLabel),
  ];
  if (parts.length > 0) return parts.join(" & ");
  if (parsed.sectionIds.length > 0) return "Category";
  if (parsed.priceBands.length > 0) return "By Price";
  return null;
}

export async function generateMetadata({ searchParams }: HomeProps): Promise<Metadata> {
  const params = await searchParams;
  const parsed = parseQuery(params);
  const { q, page } = parsed;

  const isSearch = q.length > 0;
  const filterName = describeFilters(parsed);

  const pageSuffix = page > 1 ? ` – Page ${page}` : "";

  const title = isSearch
    ? `Search: "${q}"${pageSuffix} – Design That Hits`
    : filterName
    ? `${filterName}${pageSuffix} – Design That Hits`
    : `Design That Hits – Unique Print-on-Demand Gifts & Designs${pageSuffix}`;

  const description = isSearch
    ? `Search results for "${q}" — print-on-demand gifts, wrapping paper, and party designs.`
    : filterName
    ? `${filterName} designs from Design That Hits — print-on-demand gifts, wrapping paper, and party designs, printed fresh and shipped direct.`
    : "Print-on-demand gifts, wrapping paper, and party designs. Unique, high-quality designs that make every occasion special.";

  /*
    CANONICALS

    Self-referencing, built from the parsed values rather than the raw query string, so
    parameter order and junk params can't mint duplicate URLs. Two deliberate omissions:

      - `sort` and `pill` only reorder the same set of products, so they collapse onto
        the unsorted view rather than becoming separate indexable duplicates.
      - `page` IS included. Paginated views used to canonicalise to page 1, which tells
        Google the deeper pages are duplicates and quietly discourages crawling past the
        first 24 products. Each page now canonicalises to itself.
  */
  const qs = new URLSearchParams();
  if (q)                          qs.set("q",        q);
  if (parsed.sectionIds.length)   qs.set("sections", parsed.sectionIds.join(","));
  if (parsed.types.length)        qs.set("types",    parsed.types.join(","));
  if (parsed.themes.length)       qs.set("themes",   parsed.themes.join(","));
  if (parsed.occasions.length)    qs.set("occasions", parsed.occasions.join(","));
  if (parsed.priceBands.length)   qs.set("price",    parsed.priceBands.join(","));
  if (page > 1)                   qs.set("page",     String(page));

  /*
    A filter view with a real page of its own canonicalises to it, which consolidates every
    link and share of the filtered URL onto the URL meant to rank instead of splitting them.

    Two shapes qualify. One facet maps to its collection (`?types=sticker` to
    `/collections/sticker`). One product type plus one theme maps to the intersection page
    (`?types=wrapping-paper&themes=cats` to `/collections/wrapping-paper/cats`), which only
    exists for pairs with enough products to carry one. Anything else keeps its own
    canonical and is handled by `robots`.
  */
  /*
    Nothing outside the three category axes. A price band or a section filter has no page
    of its own, so a view carrying one keeps its own canonical.
  */
  const onlyFacets = !q && !parsed.sectionIds.length && !parsed.priceBands.length;
  const axisTotal = parsed.types.length + parsed.themes.length + parsed.occasions.length;

  /* Exactly one facet maps to its collection: `?occasions=christmas` to
     `/collections/christmas`. */
  const soleFacet =
    onlyFacets && axisTotal === 1
      ? parsed.types[0] ?? parsed.themes[0] ?? parsed.occasions[0]
      : null;
  const facetCollection = soleFacet ? await resolveCollection(soleFacet) : null;

  /*
    One theme plus one product type or occasion maps to the intersection page, when the
    pair has enough products to have earned one. `?occasions=christmas&themes=cats` is
    `/collections/christmas/cats`.
  */
  const pairPrimary =
    onlyFacets && axisTotal === 2 && parsed.themes.length === 1
      ? parsed.types[0] ?? parsed.occasions[0] ?? null
      : null;
  const facetIntersection = pairPrimary
    ? await resolveIntersection(pairPrimary, parsed.themes[0])
    : null;

  /*
    Only canonicalise to a page that exists. `?themes=cats&page=40` would otherwise point
    its canonical at `/collections/cats/pages/40`, which 404s, and a canonical aimed at a
    missing page is worse than one aimed at itself.
  */
  const targetCount = facetCollection?.count ?? facetIntersection?.count;
  const targetHasPage =
    targetCount === undefined || page <= Math.max(1, Math.ceil(targetCount / COLLECTION_PAGE_SIZE));

  const canonicalTarget = !targetHasPage
    ? null
    : facetCollection
    ? collectionPagePath(facetCollection.slug, page)
    : facetIntersection
    ? intersectionPath(facetIntersection.primary.slug, facetIntersection.secondary.slug, page)
    : null;

  const canonicalUrl = canonicalTarget
    ? `${SITE_URL}${canonicalTarget}`
    : qs.toString()
    ? `${SITE_URL}/?${qs}`
    : SITE_URL;

  /*
    Combinations of two or more facets, price bands and section filters are near-duplicate
    slices of the catalogue, and the number of them grows multiplicatively with the facet
    list. They were indexable back when they were the only category views that existed;
    now that every single facet has a collection page, indexing the combinations spends
    crawl budget on pages that will never outrank the collection they overlap. `follow`
    keeps the product links inside them crawlable.
  */
  const isFacetCombination =
    !isSearch &&
    !canonicalTarget &&
    axisTotal + parsed.priceBands.length + parsed.sectionIds.length > 1;

  /*
    Page 2 and deeper of a view with no page of its own. These are thin slices of the same
    catalogue, they compete for crawl budget with the collection pages that are meant to
    rank, and nothing is lost by dropping them: every product is in the sitemap and linked
    from a collection whose own pagination is static and crawlable.

    Deliberately excludes anything that canonicalises elsewhere. Those already point at a
    real page, and pairing noindex with a canonical aimed somewhere else is a contradiction
    Google may resolve by dropping the canonical target instead.
  */
  const isDeepPage = !canonicalTarget && page > 1;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    /*
      What stays out of the index here:

        - Search. `q` is visitor-supplied, so it can generate unbounded near-duplicate
          URLs.
        - Facet combinations. See isFacetCombination above.
        - Page 2 and deeper, unless the view canonicalises to a collection. See isDeepPage.

      Single-facet views are not excluded — they canonicalise to their collection page
      instead, which consolidates rather than discards them. Everything else, the plain
      home grid and its pagination, stays indexable and self-canonical. `follow` is set
      throughout so product links stay crawlable either way.
    */
    robots: isSearch || isFacetCombination || isDeepPage
      ? { index: false, follow: true }
      : { index: true,  follow: true },
    // A page-level `openGraph` REPLACES the one in the root layout rather than merging
    // into it, so every field the social preview needs has to be restated here. Omitting
    // them silently dropped og:type and og:image from the home page.
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: "Design That Hits",
      title,
      description,
      url: canonicalUrl,
    },
  };
}

export default async function HomePage({ searchParams }: HomeProps) {
  const params = await searchParams;
  const parsed = parseQuery(params);

  /*
    Every query the page needs, in one round. The hero used to be awaited on its own after
    this block resolved, which made it a second serial hop for no reason — nothing in it
    depends on the grid. It matters more now that this route is CDN-cached: the render only
    runs on a cache miss, so the miss should be as cheap as possible.
  */
  const [sections, facets, collections, heroResult, listingsResult] = await Promise.all([
    getShopSections(),
    getFacetGroups(),
    getCollections(),
    // Fetched independently of the grid. Sourcing the hero from initialData meant it went
    // blank on the Best Sellers / Trending routes, where initialData is deliberately null
    // so the grid can rank on the client.
    getListings({ limit: 12, sortOn: "created", sortOrder: "desc" }),
    parsed.pill === "best" || parsed.pill === "trending"
      ? Promise.resolve(null)
      : getListings({
          q:          parsed.q || undefined,
          sectionIds: parsed.sectionIds.length > 0 ? parsed.sectionIds : undefined,
          types:      parsed.types.length > 0 ? parsed.types : undefined,
          themes:     parsed.themes.length > 0 ? parsed.themes : undefined,
          occasions:  parsed.occasions.length > 0 ? parsed.occasions : undefined,
          priceBands: parsed.priceBands.length > 0 ? parsed.priceBands : undefined,
          sortOn:     parsed.sort === "price_asc" || parsed.sort === "price_desc" ? "price" : "created",
          sortOrder:  parsed.sort === "price_asc" ? "asc" : "desc",
          page:       parsed.page,
          limit:      24,
        }),
  ]);

  /*
    The occasions in season today, most urgent first. An empty list is a real outcome, and
    the band below renders nothing when it happens.
  */
  const seasonalCollections = currentOccasions()
    .map((slug) => {
      const match = collections.find((c) => c.slug === slug);
      // A window slug that no longer matches an occasion id in lib/facets.ts would
      // otherwise drop the chip for that whole season with nothing to show for it.
      if (!match) console.warn(`[seasonal] no collection for slug "${slug}"`);
      return match;
    })
    .filter((c): c is Collection => c !== undefined);

  /*
    Seasonal occasions first, then product types, then the biggest themes, capped at eight
    so the block stays two rows on a desktop. The full set is one click further on, at
    /collections.
  */
  const homeCollections = [
    ...seasonalCollections,
    ...collections.filter((c) => c.kind === "type"),
    ...collections.filter((c) => c.kind === "theme").sort((a, b) => b.count - a.count),
  ].slice(0, 8);

  const initialData =
    listingsResult && listingsResult.ok
      ? { listings: listingsResult.data.listings, total: listingsResult.data.total, page: parsed.page, pageSize: 24 }
      : null;

  const heroListings = (heroResult.ok ? heroResult.data.listings : [])
    .filter((l) => l.image)
    .slice(0, 8);

  // ── JSON-LD: WebSite with SearchAction ────────────────────────────────────
  const websiteJsonLd = {
    "@type":    "WebSite",
    "@id":      `${SITE_URL}/#website`,
    name:        "Design That Hits",
    url:          SITE_URL,
    description: "Print-on-demand gifts, wrapping paper, and party designs for every occasion.",
    inLanguage:  "en-US",
    potentialAction: {
      "@type":        "SearchAction",
      target:         { "@type": "EntryPoint", urlTemplate: `${SITE_URL}?q={search_term_string}` },
      "query-input":  "required name=search_term_string",
    },
  };

  // ── JSON-LD: Organization ─────────────────────────────────────────────────
  const orgJsonLd = {
    "@type":      "Organization",
    "@id":        `${SITE_URL}/#organization`,
    name:          "Design That Hits",
    url:            SITE_URL,
    logo: {
      "@type":    "ImageObject",
      url:        `${SITE_URL}/brand-logo.png`,
      width:      192,
      height:     192,
    },
    sameAs: SOCIAL_URLS,
    contactPoint: {
      "@type":            "ContactPoint",
      contactType:        "customer service",
      email:              "hello@designthathits.com",
      availableLanguage:  "English",
    },
  };

  // ── JSON-LD: CollectionPage + ItemList of products ────────────────────────
  const collectionJsonLd: Record<string, unknown> = {
    "@type":      "CollectionPage",
    "@id":        `${SITE_URL}/#collection`,
    name:          "Design That Hits – Product Catalog",
    url:            SITE_URL,
    description:   "Browse all print-on-demand designs, gifts, wrapping paper and party decorations.",
    inLanguage:    "en-US",
    isPartOf:      { "@id": `${SITE_URL}/#website` },
    publisher:     { "@id": `${SITE_URL}/#organization` },
  };

  if (initialData && initialData.listings.length > 0) {
    /*
      Summary format: position and url only, per Google's ItemList spec for a page that
      links out to detail pages. Two fixes in one here. The embedded Product nodes were
      trimmed copies that Search Console evaluated as merchant listings and reported as
      missing description, identifier, return policy and shipping. And the url pointed at
      the Etsy listing, off-domain, where the spec requires the summary page's own domain.
    */
    collectionJsonLd.mainEntity = {
      "@type":         "ItemList",
      numberOfItems:   initialData.total,
      itemListElement: initialData.listings.map((l: Listing, i: number) => ({
        "@type":  "ListItem",
        position: i + 1,
        url:      `${SITE_URL}${listingPath(l)}`,
      })),
    };
  }

  // ── JSON-LD: BreadcrumbList ───────────────────────────────────────────────
  const breadcrumbJsonLd = {
    "@type":     "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    ],
  };

  return (
    <>
      {/*
        All structured data goes out as a single @graph rather than four separate
        <script> tags. Same meaning to crawlers — the entities already cross-reference
        each other by @id — but one inline script instead of four, which is both cleaner
        HTML and less React dev-console noise about scripts inside components.
      */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [websiteJsonLd, orgJsonLd, collectionJsonLd, breadcrumbJsonLd],
        }}
      />

      {/* Hero — text first on mobile, side-by-side from md up */}
      <section className="mx-auto max-w-screen-xl px-4 sm:px-5 pt-4 pb-8 sm:pb-10">
        <div
          className="relative overflow-hidden rounded-[26px] sm:rounded-[32px] flex flex-col md:flex-row md:items-stretch md:min-h-[520px]"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-soft)",
          }}
        >
          {/* Brand glow. Purely decorative, so it is hidden from assistive tech and
              never intercepts pointer events. */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundImage: "var(--gradient-hero)" }}
            aria-hidden="true"
          />

          {/* Text */}
          <div className="relative z-10 flex flex-col justify-center w-full md:w-[55%] px-6 py-12 sm:px-9 sm:py-14 md:px-12 md:py-20">
            <p className="eyebrow mb-4 sm:mb-5 fade-up">The Special Taste</p>

            <h1
              className="display-title mb-5 rise-up"
              style={{ fontSize: "clamp(2.5rem, 7.5vw, 4.5rem)" }}
            >
              Get Your Own
              <br />
              Bite of <span className="display-accent">Satisfaction</span>
            </h1>

            <p
              className="text-sm sm:text-base leading-relaxed mb-8 fade-up-3"
              style={{ color: "var(--text-soft)", maxWidth: "32rem" }}
            >
              Unique gifts, wrapping paper and party designs that make every occasion feel
              extra special. Printed on demand, shipped from our Etsy shop.
            </p>

            <div className="fade-up-3 flex flex-wrap items-center gap-3">
              <a href="#listings" className="btn-cta">
                Browse Designs
                <span className="arrow-circle" aria-hidden="true">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
                  </svg>
                </span>
              </a>
              <a
                href="https://designthathits.etsy.com"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline"
              >
                Visit the Etsy shop
              </a>
            </div>
          </div>

          {/*
            Rotating product showcase, filling the right half edge to edge.

            Hidden below md: stacked under the copy it would push the CTAs well below the
            fold on a phone, and the whole point of the hero is the call to action.
          */}
          {heroListings.length > 0 && (
            // Absolutely positioned and deliberately wider than the visible image needs
            // to be. The extra width slides under the text column, giving the mask a long
            // ramp to fade across instead of a narrow, abrupt one.
            <div className="hidden md:block absolute inset-y-0 right-0 w-[62%] overflow-hidden">
              <HeroCarousel listings={heroListings} />
            </div>
          )}

        </div>
      </section>

      {/*
        Seasonal band, above the grid. Occasion collections had no link from the home page
        before this, including Christmas, which is over half the catalog.
      */}
      {seasonalCollections.length > 0 && (
        <section className="mx-auto max-w-screen-xl px-4 sm:px-5 pb-8 sm:pb-10">
          <div className="panel px-6 py-8 sm:px-10 sm:py-10">
            <p className="eyebrow mb-3">Shop the season</p>
            <h2 className="display-title mb-4" style={{ fontSize: "clamp(1.6rem, 3.6vw, 2.4rem)" }}>
              In season <span className="display-accent">right now</span>
            </h2>
            <p
              className="text-sm sm:text-base leading-relaxed mb-7"
              style={{ color: "var(--text-soft)", maxWidth: "32rem" }}
            >
              The occasions people are shopping for today. Everything else is in the grid below.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              {seasonalCollections.map((c, i) => (
                <Link
                  key={c.slug}
                  href={collectionPath(c.slug)}
                  // Ordered by which occasion closes first, so the primary button is the
                  // one with the least time left to shop rather than the biggest range.
                  className={i === 0 ? "btn-cta" : "btn-outline"}
                >
                  {c.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Shop section — scroll-margin-top offsets the sticky header height (~65px) */}
      <section id="listings" style={{ scrollMarginTop: '72px' }}>
        <Suspense>
          <ShopFront
            sections={sections}
            facets={facets}
            initialParams={params}
            initialData={initialData}
          />
        </Suspense>
      </section>

      {/* Category explore */}
      {/*
        Shop by collection.

        This block used to render Etsy shop sections linking to `/?sections=<id>`, and it
        never appeared: the catalogue carries no sections at all (`sections: []`, and not
        one of the 366 listings has a sectionId), so the guard was always false and the
        home page shipped no category links whatsoever. The collections are the real
        category axis, and putting them here is what takes them from two clicks away
        (footer, then hub) to one.
      */}
      {collections.length > 0 && (
        <section className="mx-auto max-w-screen-xl px-4 sm:px-5 py-12 sm:py-16">
          <div className="text-center mb-8 sm:mb-10">
            <p className="eyebrow mb-3">Browse the shop</p>
            <h2 className="display-title" style={{ fontSize: "clamp(1.9rem, 4.5vw, 3rem)" }}>
              Shop by <span className="display-accent">Collection</span>
            </h2>
          </div>

          <CollectionTiles collections={homeCollections} />

          <div className="text-center mt-8">
            <Link href="/collections" className="btn-outline">
              See all {collections.length} collections
            </Link>
          </div>
        </section>
      )}

      {/* Closing CTA band */}
      <section className="mx-auto max-w-screen-xl px-4 sm:px-5 pb-14 sm:pb-20">
        <div className="brand-band rounded-[26px] sm:rounded-[32px] px-6 py-12 sm:px-12 sm:py-16 text-center">
          <h2
            className="display-title mb-4"
            style={{ fontSize: "clamp(1.8rem, 4.5vw, 2.9rem)", color: "var(--brand-ink)" }}
          >
            Let Us Help You Celebrate
          </h2>
          <p
            className="text-sm sm:text-base mx-auto mb-8"
            style={{ color: "rgba(255,255,255,0.88)", maxWidth: "34rem" }}
          >
            Birthdays, Valentine&apos;s Day, graduations, Christmas and everything in between.
          </p>
          <a
            href="https://designthathits.etsy.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline"
            style={{ borderColor: "rgba(255,255,255,0.5)", color: "var(--brand-ink)" }}
          >
            Shop all designs on Etsy
          </a>
        </div>
      </section>
    </>
  );
}
