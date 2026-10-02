/**
 * The rendered body of any catalog landing page.
 *
 * One component behind two shapes: a collection (`/collections/cats`) and a product type
 * crossed with a theme (`/collections/wrapping-paper/cats`). They differ only in their
 * query, their copy and their breadcrumb, so they take a spec rather than a second
 * component that would drift from this one.
 *
 * Deeper pages are a path segment rather than `?page=2` so every page prerenders: reading
 * `searchParams` opts the route into dynamic rendering.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getListings } from "@/lib/shop";
import { JsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/products/ProductCard";
import { Pagination } from "@/components/products/Pagination";
import { listingPath, listingName } from "@/lib/slug";
import { COLLECTION_PAGE_SIZE, type CatalogSpec } from "@/lib/collections";
import type { Listing } from "@/types/etsy";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designthathits.com";

const absolute = (path: string) => `${SITE_URL}${path}`;

export async function CatalogPage({ spec, page }: { spec: CatalogSpec; page: number }) {
  const result = await getListings({
    ...spec.query,
    sortOn: "created",
    sortOrder: "desc",
    page,
    limit: COLLECTION_PAGE_SIZE,
  });

  /*
    A failed fetch is a 404 rather than an empty page. An indexable URL that renders no
    products gets crawled, judged thin, and drags the surrounding pages down with it.
  */
  if (!result.ok) notFound();

  const { listings, total } = result.data;
  const totalPages = Math.max(1, Math.ceil(total / COLLECTION_PAGE_SIZE));

  // Page 7 of a four-page view is a URL somebody guessed or a stale link.
  if (listings.length === 0 || page > totalPages) notFound();

  const url = absolute(spec.pagePath(page));
  const heading = page > 1 ? `${spec.label} – Page ${page}` : spec.label;
  const faq = page === 1 ? spec.detail?.faq : undefined;

  const graph: Record<string, unknown>[] = [
    {
      "@type": "CollectionPage",
      "@id": `${url}#collection`,
      name: `${spec.label} – Design That Hits`,
      url,
      description: spec.intro,
      inLanguage: "en-US",
      isPartOf: { "@id": `${SITE_URL}/#website` },
      publisher: { "@id": `${SITE_URL}/#organization` },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: total,
        itemListElement: listings.slice(0, 10).map((l: Listing, i: number) => ({
          "@type": "ListItem",
          // Continues across pages, so page 2 starts at 25 rather than restarting at 1.
          position: (page - 1) * COLLECTION_PAGE_SIZE + i + 1,
          item: {
            "@type": "Product",
            name: listingName(l),
            url: absolute(listingPath(l)),
            ...(l.image ? { image: l.image.url } : {}),
            offers: {
              "@type": "Offer",
              price: l.price.toFixed(2),
              priceCurrency: l.currency,
              availability: "https://schema.org/InStock",
              seller: { "@id": `${SITE_URL}/#organization` },
            },
          },
        })),
      },
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Collections", item: `${SITE_URL}/collections` },
        ...spec.trail.map((t, i) => ({
          "@type": "ListItem",
          position: 3 + i,
          name: t.name,
          item: absolute(t.href),
        })),
        {
          "@type": "ListItem",
          position: 3 + spec.trail.length,
          name: spec.label,
          item: absolute(spec.pagePath(1)),
        },
      ],
    },
  ];

  // Only page one carries the FAQ, so the deeper pages do not repeat the same answers.
  if (faq?.length) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    });
  }

  return (
    <div className="mx-auto max-w-screen-xl px-4 sm:px-5 py-6 sm:py-10">
      <JsonLd data={{ "@context": "https://schema.org", "@graph": graph }} />

      {/* Visible breadcrumb, mirroring the structured data. */}
      <nav aria-label="Breadcrumb" className="mb-6 text-xs sm:text-sm" style={{ color: "var(--text-muted)" }}>
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href="/" className="hover:underline">Home</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href="/collections" className="hover:underline">Collections</Link></li>
          {spec.trail.map((t) => (
            <li key={t.href} className="flex items-center gap-1.5">
              <span aria-hidden="true">/</span>
              <Link href={t.href} className="hover:underline">{t.name}</Link>
            </li>
          ))}
          <li aria-hidden="true">/</li>
          <li aria-current="page" style={{ color: "var(--text-soft)" }}>{spec.label}</li>
        </ol>
      </nav>

      <header className="mb-8 sm:mb-10 max-w-2xl">
        <p className="eyebrow mb-3">{spec.eyebrow}</p>
        <h1 className="display-title mb-4" style={{ fontSize: "clamp(2rem, 5.5vw, 3.2rem)" }}>
          {heading}
        </h1>
        <p className="text-sm sm:text-base leading-relaxed" style={{ color: "var(--text-soft)" }}>
          {spec.intro}
        </p>
        <p className="text-xs mt-4" style={{ color: "var(--text-muted)" }}>
          {total} {total === 1 ? "design" : "designs"}
        </p>
      </header>

      {/* The first row loads eagerly: the grid starts near the top, so one of these photos
          is the LCP element and lazy-loading it is the classic way to lose LCP. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {listings.map((listing, i) => (
          <ProductCard key={listing.id} listing={listing} priority={i < 4} />
        ))}
      </div>

      {totalPages > 1 && (
        /* No `onPage` handler: this view is server-rendered, so the control works as plain
           links, which is what makes every page reachable by following hrefs. */
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          hrefs={Array.from({ length: totalPages }, (_, i) => spec.pagePath(i + 1))}
          className="mt-10"
          label={`${spec.label} pagination`}
        />
      )}

      {/* Cross-links. Page one only: the deeper pages exist to be crawled through, and
          repeating the same link block on each would just dilute it. */}
      {page === 1 && spec.related && spec.related.items.length > 0 && (
        <section className="mt-14">
          <h2 className="display-title mb-5" style={{ fontSize: "clamp(1.3rem, 3vw, 1.9rem)" }}>
            {spec.related.heading}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {spec.related.items.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="filter-pill inline-flex">
                  {item.label}
                  <span className="ml-1.5 opacity-60">{item.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {page === 1 && spec.detail?.body?.length ? (
        <section className="mt-14 max-w-2xl">
          {spec.detail.body.map((block) => (
            <div key={block.heading} className="mb-8">
              <h2 className="display-title mb-3" style={{ fontSize: "clamp(1.3rem, 3vw, 1.9rem)" }}>
                {block.heading}
              </h2>
              {block.paragraphs.map((p) => (
                <p key={p} className="text-sm sm:text-base leading-relaxed mb-3" style={{ color: "var(--text-soft)" }}>
                  {p}
                </p>
              ))}
            </div>
          ))}
        </section>
      ) : null}

      {faq?.length ? (
        <section className="mt-6 max-w-2xl">
          <h2 className="display-title mb-5" style={{ fontSize: "clamp(1.3rem, 3vw, 1.9rem)" }}>
            Common questions
          </h2>
          <dl>
            {faq.map((item) => (
              <div key={item.q} className="mb-6">
                <dt className="text-sm sm:text-base font-semibold mb-1.5" style={{ color: "var(--text)" }}>
                  {item.q}
                </dt>
                <dd className="text-sm sm:text-base leading-relaxed" style={{ color: "var(--text-soft)" }}>
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Self-canonical per page, matching the rule the home grid follows: pointing page two at
 * page one tells Google the deeper pages are duplicates and discourages crawling past the
 * first two dozen products.
 */
export function catalogMetadata(spec: CatalogSpec, page: number): Metadata {
  const suffix = page > 1 ? ` – Page ${page}` : "";
  // Bare: the root layout's title template appends the brand to child segments, and
  // restating it here produces "Cats – Design That Hits | Design That Hits".
  const title = `${spec.label}${suffix}`;
  const socialTitle = `${spec.label}${suffix} – Design That Hits`;
  const url = absolute(spec.pagePath(page));

  return {
    title,
    description: spec.intro,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: "Design That Hits",
      title: socialTitle,
      description: spec.intro,
      url,
    },
    twitter: { card: "summary_large_image", title: socialTitle, description: spec.intro },
  };
}
