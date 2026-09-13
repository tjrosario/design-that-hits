/**
 * The rendered body of a collection page.
 *
 * Shared by `/collections/[slug]` (page one) and `/collections/[slug]/pages/[n]`
 * (everything deeper). Those are two routes rather than one route with a `?page=`
 * parameter so that every page of every collection can be statically prerendered:
 * reading `searchParams` opts a route into dynamic rendering, which would have traded
 * the whole catalogue's TTFB for a tidier URL shape.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getListings } from "@/lib/shop";
import { JsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/products/ProductCard";
import { Pagination } from "@/components/products/Pagination";
import { listingPath, listingName } from "@/lib/slug";
import {
  COLLECTION_PAGE_SIZE,
  collectionIntro,
  collectionPagePath,
  collectionQuery,
  collectionUrl,
  type Collection,
} from "@/lib/collections";
import type { Listing } from "@/types/etsy";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designthathits.com";

export async function CollectionView({ collection, page }: { collection: Collection; page: number }) {
  const result = await getListings({
    ...collectionQuery(collection),
    sortOn: "created",
    sortOrder: "desc",
    page,
    limit: COLLECTION_PAGE_SIZE,
  });

  /*
    A failed fetch is a 404 rather than an empty page. An indexable URL that renders no
    products is worse than no URL at all: it gets crawled, judged thin, and drags the
    surrounding pages down with it.
  */
  if (!result.ok) notFound();

  const { listings, total } = result.data;
  const totalPages = Math.max(1, Math.ceil(total / COLLECTION_PAGE_SIZE));

  // Page 7 of a four-page collection is a URL somebody guessed or a stale link.
  if (listings.length === 0 || page > totalPages) notFound();

  const intro = collectionIntro(collection);
  const url = collectionUrl(collection.slug, page);
  const heading = page > 1 ? `${collection.label} – Page ${page}` : collection.label;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#collection`,
        name: `${collection.label} – Design That Hits`,
        url,
        description: intro,
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
              url: `${SITE_URL}${listingPath(l)}`,
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
          { "@type": "ListItem", position: 3, name: collection.label, item: collectionUrl(collection.slug, 1) },
        ],
      },
    ],
  };

  return (
    <div className="mx-auto max-w-screen-xl px-4 sm:px-5 py-6 sm:py-10">
      <JsonLd data={jsonLd} />

      {/* Visible breadcrumb, mirroring the structured data. */}
      <nav aria-label="Breadcrumb" className="mb-6 text-xs sm:text-sm" style={{ color: "var(--text-muted)" }}>
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href="/" className="hover:underline">Home</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href="/collections" className="hover:underline">Collections</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" style={{ color: "var(--text-soft)" }}>{collection.label}</li>
        </ol>
      </nav>

      <header className="mb-8 sm:mb-10 max-w-2xl">
        <p className="eyebrow mb-3">{collection.kind === "type" ? "Product type" : "Theme"}</p>
        <h1 className="display-title mb-4" style={{ fontSize: "clamp(2rem, 5.5vw, 3.2rem)" }}>
          {heading}
        </h1>
        <p className="text-sm sm:text-base leading-relaxed" style={{ color: "var(--text-soft)" }}>
          {intro}
        </p>
        <p className="text-xs mt-4" style={{ color: "var(--text-muted)" }}>
          {total} {total === 1 ? "design" : "designs"}
        </p>
      </header>

      {/*
        The first row loads eagerly. On a collection page the grid starts near the top of
        the viewport, so one of these photos is the LCP element — and every one of them
        was `loading="lazy"` with no preload, which is the classic way to lose LCP: the
        browser cannot even discover the image until layout runs, then fetches it at low
        priority. Four covers the widest row the grid ever renders.
      */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {listings.map((listing, i) => (
          <ProductCard key={listing.id} listing={listing} priority={i < 4} />
        ))}
      </div>

      {totalPages > 1 && (
        /*
          No `onPage` handler: this view is server-rendered, so there is no client state
          to update and the control works as plain links. That is also what makes every
          page of the collection reachable by a crawler following hrefs.
        */
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          hrefs={Array.from({ length: totalPages }, (_, i) => collectionPagePath(collection.slug, i + 1))}
          className="mt-10"
          label={`${collection.label} pagination`}
        />
      )}
    </div>
  );
}

/**
 * Metadata for a collection page.
 *
 * Self-canonical per page, matching the rule the home grid already follows: pointing
 * page two at page one tells Google the deeper pages are duplicates and discourages it
 * from crawling past the first twenty-four products.
 */
export function collectionMetadata(collection: Collection, page: number): Metadata {
  const intro = collectionIntro(collection);
  const suffix = page > 1 ? ` – Page ${page}` : "";
  // Bare, like every other page here: the root layout's title template appends the brand
  // to child segments, and restating it produces "Cats – Design That Hits | Design That
  // Hits". The share cards below do want the brand, so they spell it out.
  const title = `${collection.label}${suffix}`;
  const socialTitle = `${collection.label}${suffix} – Design That Hits`;

  return {
    title,
    description: intro,
    alternates: { canonical: collectionUrl(collection.slug, page) },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: "Design That Hits",
      title: socialTitle,
      description: intro,
      url: collectionUrl(collection.slug, page),
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: intro,
    },
  };
}
