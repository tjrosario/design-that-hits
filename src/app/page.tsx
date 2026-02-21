import type { Metadata } from "next";
import { Suspense } from "react";
import { getShopSections, getListings } from "@/lib/etsy";
import { parseQuery } from "@/lib/query";
import { ShopFront } from "@/components/ShopFront";
import { JsonLd } from "@/components/JsonLd";
import type { Listing } from "@/types/etsy";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designthathits.com";

export const dynamic = "force-dynamic";

interface HomeProps {
  searchParams: Promise<Record<string, string>>;
}

export async function generateMetadata({ searchParams }: HomeProps): Promise<Metadata> {
  const params = await searchParams;
  const { q, sectionIds } = parseQuery(params);

  const isSearch   = q.length > 0;
  const isFiltered = sectionIds.length > 0;

  const title = isSearch
    ? `Search: "${q}" – Design That Hits`
    : isFiltered
    ? "Browse by Category – Design That Hits"
    : "Design That Hits – Unique Print-on-Demand Gifts & Designs";

  const description = isSearch
    ? `Search results for "${q}" — print-on-demand gifts, wrapping paper, and party designs.`
    : isFiltered
    ? "Browse our curated collections of print-on-demand gifts, wrapping paper, and party designs."
    : "Print-on-demand gifts, wrapping paper, and party designs. Unique, high-quality designs that make every occasion special.";

  // Build canonical URL — filtered/search pages are indexable with canonical pointing here
  const qs = new URLSearchParams();
  if (q)                   qs.set("q",        q);
  if (sectionIds.length > 0) qs.set("sections", sectionIds.join(","));
  const canonicalUrl = qs.toString() ? `${SITE_URL}?${qs}` : SITE_URL;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    // Prevent search/filter result pages from competing with the main page
    robots: isSearch || isFiltered
      ? { index: false, follow: true }
      : { index: true,  follow: true },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
    },
  };
}

export default async function HomePage({ searchParams }: HomeProps) {
  const params = await searchParams;
  const parsed = parseQuery(params);

  const [sections, listingsResult] = await Promise.all([
    getShopSections(),
    parsed.pill === "best" || parsed.pill === "trending"
      ? Promise.resolve(null)
      : getListings({
          q:          parsed.q || undefined,
          sectionIds: parsed.sectionIds.length > 0 ? parsed.sectionIds : undefined,
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

  // ── JSON-LD: WebSite with SearchAction ────────────────────────────────────
  const websiteJsonLd = {
    "@context": "https://schema.org",
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
    "@context":   "https://schema.org",
    "@type":      "Organization",
    "@id":        `${SITE_URL}/#organization`,
    name:          "Design That Hits",
    url:            SITE_URL,
    logo: {
      "@type":    "ImageObject",
      url:        `${SITE_URL}/icon-192.png`,
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
    "@context":   "https://schema.org",
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
    "@context":  "https://schema.org",
    "@type":     "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    ],
  };

  return (
    <>
      <JsonLd data={websiteJsonLd} />
      <JsonLd data={orgJsonLd} />
      <JsonLd data={collectionJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />

      {/* Hero */}
      <section className="mx-auto max-w-screen-xl px-5 pb-6">
        <div
          className="relative overflow-hidden rounded-3xl"
          style={{ backgroundColor: "#C8BEA8", minHeight: "460px" }}
        >
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(ellipse at 30% 50%, #E8DCC8 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, #D4C4A8 0%, transparent 50%)",
            }}
          />
          <div className="absolute inset-y-0 left-0 w-1/2 md:w-[55%]">
            <div className="relative h-full flex items-end">
              <div className="absolute bottom-0 left-8 w-36 h-48 md:w-48 md:h-64 rounded-2xl opacity-60" style={{ backgroundColor: "#7DC4A8" }} />
              <div className="absolute bottom-0 left-28 md:left-40 w-32 h-56 md:w-44 md:h-72 rounded-2xl opacity-70" style={{ backgroundColor: "#2C2820" }} />
              <div className="absolute bottom-0 left-16 md:left-24 w-36 h-52 md:w-48 rounded-2xl" style={{ backgroundColor: "#E8C070" }} />
              <div
                className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap"
                style={{ background: "rgba(255,255,255,0.3)", color: "var(--ink)", backdropFilter: "blur(8px)" }}
              >
                📸 Add hero image in page.tsx
              </div>
            </div>
          </div>

          <div className="relative z-10 ml-auto w-1/2 md:w-[45%] h-full flex flex-col justify-center px-8 md:px-10 py-12">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3 fade-up" style={{ color: "var(--ink-soft)" }}>
              Print-on-demand · Etsy shop
            </p>
            <h1
              className="text-5xl md:text-6xl lg:text-7xl font-black uppercase leading-none mb-5 fade-up-2"
              style={{ fontFamily: "var(--font-display)", color: "var(--ink)", letterSpacing: "-0.01em" }}
            >
              Designs that<br />
              <span style={{ color: "var(--orange)" }}>Hit</span><br />
              Different.
            </h1>
            <p className="text-sm leading-relaxed mb-8 max-w-xs fade-up-3" style={{ color: "var(--ink-soft)" }}>
              Unique gifts, wrapping paper &amp; party designs that make every occasion feel extra special.
            </p>
            <div className="fade-up-3">
              <a href="#listings" className="btn-cta">
                Discover More
                <span className="arrow-circle" aria-hidden="true">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
                  </svg>
                </span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Shop section */}
      <section id="listings">
        <Suspense>
          <ShopFront sections={sections} initialParams={params} initialData={initialData} />
        </Suspense>
      </section>

      {/* Category explore */}
      {sections.length > 0 && (
        <section className="mx-auto max-w-screen-xl px-5 py-14">
          <h2
            className="text-4xl md:text-5xl font-black uppercase mb-8"
            style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
          >
            Shop by Category
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {sections.slice(0, 8).map((s, i) => {
              const bgs = ["#E8C547","#7DC4A8","#E88C6A","#A8C4E8","#C8A8E8","#E8A8B8","#C4D4A0","#F0C090"];
              return (
                <a
                  key={s.id}
                  href={`/?sections=${s.id}`}
                  className="group relative rounded-2xl p-5 flex flex-col justify-between min-h-[110px] transition-transform hover:-translate-y-1"
                  style={{ backgroundColor: bgs[i % bgs.length] }}
                  aria-label={`Browse ${s.title} designs`}
                >
                  <span
                    className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-full self-start"
                    style={{ background: "rgba(0,0,0,0.12)", color: "var(--ink)" }}
                  >
                    {s.count > 0 ? `${s.count} designs` : "Browse"}
                  </span>
                  <div className="flex items-end justify-between mt-3">
                    <p className="text-lg font-black uppercase leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
                      {s.title}
                    </p>
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center ml-2 flex-shrink-0 transition-transform group-hover:rotate-45"
                      style={{ background: "rgba(0,0,0,0.15)" }}
                      aria-hidden="true"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="var(--ink)" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
                      </svg>
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
