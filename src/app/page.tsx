import type { Metadata } from "next";
import { Suspense } from "react";
import { getShopSections, getListings, getFacetGroups } from "@/lib/shop";
import { parseQuery } from "@/lib/query";
import { productTypeLabel, themeLabel } from "@/lib/facets";
import { collectionPagePath, resolveCollection } from "@/lib/collections";
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
  if (parsed.priceBands.length)   qs.set("price",    parsed.priceBands.join(","));
  if (page > 1)                   qs.set("page",     String(page));

  /*
    A single-facet filter view has a real page of its own now — `/collections/stickers`
    rather than `/?types=sticker` — showing exactly the same products with better copy.
    Canonicalising to it consolidates every link and every share of the filtered URL onto
    the one URL meant to rank, instead of splitting them across two.

    Only a lone facet qualifies. `?types=sticker&themes=cats` is a genuine intersection
    with no page of its own, so it keeps its own canonical and is handled by `robots`.
  */
  const soleFacet =
    !q && !parsed.sectionIds.length && !parsed.priceBands.length
      ? parsed.types.length === 1 && !parsed.themes.length
        ? parsed.types[0]
        : parsed.themes.length === 1 && !parsed.types.length
        ? parsed.themes[0]
        : null
      : null;
  const facetCollection = soleFacet ? await resolveCollection(soleFacet) : null;

  const canonicalUrl = facetCollection
    ? `${SITE_URL}${collectionPagePath(facetCollection.slug, page)}`
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
    !facetCollection &&
    parsed.types.length + parsed.themes.length + parsed.priceBands.length + parsed.sectionIds.length > 1;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    /*
      What stays out of the index here:

        - Search. `q` is visitor-supplied, so it can generate unbounded near-duplicate
          URLs.
        - Facet combinations. See isFacetCombination above.

      Single-facet views are not excluded — they canonicalise to their collection page
      instead, which consolidates rather than discards them. Everything else, the plain
      home grid and its pagination, stays indexable and self-canonical. `follow` is set
      throughout so product links stay crawlable either way.
    */
    robots: isSearch || isFacetCombination
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
  const [sections, facets, heroResult, listingsResult] = await Promise.all([
    getShopSections(),
    getFacetGroups(),
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
          priceBands: parsed.priceBands.length > 0 ? parsed.priceBands : undefined,
          sortOn:     parsed.sort === "price_asc" || parsed.sort === "price_desc" ? "price" : "created",
          sortOrder:  parsed.sort === "price_asc" ? "asc" : "desc",
          page:       parsed.page,
          limit:      24,
        }),
  ]);

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
    sameAs: [
      "https://designthathits.etsy.com",
      // Add your Instagram / Pinterest URLs here when available
    ],
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
    collectionJsonLd.mainEntity = {
      "@type":         "ItemList",
      numberOfItems:   initialData.total,
      itemListElement: initialData.listings.slice(0, 10).map((l: Listing, i: number) => ({
        "@type":    "ListItem",
        position:    i + 1,
        item: {
          "@type":  "Product",
          name:      l.title,
          url:       l.url,
          offers: {
            "@type":            "Offer",
            price:               l.price.toFixed(2),
            priceCurrency:       l.currency,
            availability:        "https://schema.org/InStock",
            seller: { "@id":    `${SITE_URL}/#organization` },
          },
          ...(l.image ? { image: l.image.url } : {}),
        },
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
              className="display-title mb-5 fade-up-2"
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
      {sections.length > 0 && (
        <section className="mx-auto max-w-screen-xl px-4 sm:px-5 py-12 sm:py-16">
          <div className="text-center mb-8 sm:mb-10">
            <p className="eyebrow mb-3">Browse the shop</p>
            <h2 className="display-title" style={{ fontSize: "clamp(1.9rem, 4.5vw, 3rem)" }}>
              Shop by <span className="display-accent">Category</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {sections.slice(0, 8).map((s) => (
              <a
                key={s.id}
                href={`/?sections=${s.id}`}
                className="panel group relative p-4 sm:p-5 flex flex-col justify-between min-h-[120px] transition-transform hover:-translate-y-1"
                aria-label={`Browse ${s.title} designs`}
              >
                <span
                  className="text-[11px] font-semibold tracking-wide px-2.5 py-1 rounded-full self-start"
                  style={{ background: "var(--brand-wash)", color: "var(--brand)" }}
                >
                  {s.count > 0 ? `${s.count} designs` : "Browse"}
                </span>
                <div className="flex items-end justify-between gap-2 mt-4">
                  <p
                    className="text-base sm:text-lg leading-tight"
                    style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--text)" }}
                  >
                    {s.title}
                  </p>
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-transform group-hover:rotate-45"
                    style={{ background: "var(--gradient-brand)", color: "var(--brand-ink)" }}
                    aria-hidden="true"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
                    </svg>
                  </span>
                </div>
              </a>
            ))}
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
