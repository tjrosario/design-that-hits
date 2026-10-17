/**
 * New arrivals.
 *
 * A static segment, so it takes precedence over `/collections/[slug]` and never has to
 * exist as a facet. It is not a collection in the registry sense: there is no `new` theme
 * or occasion, and the membership is a date range rather than a rule.
 *
 * No pagination. The window is short enough that the set stays well under one page, and a
 * page two of "new arrivals" would be a contradiction.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { newArrivals, NEW_ARRIVALS_DAYS } from "@/lib/arrivals";
import { JsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/products/ProductCard";
import { listingPath } from "@/lib/slug";
import { ORGANIZATION_ID, WEBSITE_ID } from "@/lib/site-graph";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designthathits.com";
const URL = `${SITE_URL}/collections/new`;

const TITLE = "New Arrivals";
const DESCRIPTION =
  "The designs added most recently, newest first. Wrapping paper, apparel and party designs, updated as they go live on Etsy.";

// Hourly: the catalog syncs every six hours, and this is the one page where being a few
// hours stale is the whole problem.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Design That Hits",
    title: `${TITLE} – Design That Hits`,
    description: DESCRIPTION,
    url: URL,
  },
  twitter: { card: "summary_large_image", title: `${TITLE} – Design That Hits`, description: DESCRIPTION },
};

export default async function NewArrivalsPage() {
  const listings = await newArrivals();

  const graph: Record<string, unknown>[] = [
    {
      "@type": "CollectionPage",
      "@id": `${URL}#collection`,
      name: `${TITLE} – Design That Hits`,
      url: URL,
      description: DESCRIPTION,
      inLanguage: "en-US",
      isPartOf: { "@id": WEBSITE_ID },
      publisher: { "@id": ORGANIZATION_ID },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: listings.length,
        itemListElement: listings.map((l, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${SITE_URL}${listingPath(l)}`,
        })),
      },
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${URL}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Collections", item: `${SITE_URL}/collections` },
        { "@type": "ListItem", position: 3, name: TITLE, item: URL },
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-screen-xl px-4 sm:px-5 py-6 sm:py-10">
      <JsonLd data={{ "@context": "https://schema.org", "@graph": graph }} />

      <nav aria-label="Breadcrumb" className="mb-6 text-xs sm:text-sm" style={{ color: "var(--text-muted)" }}>
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href="/" className="hover:underline">Home</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href="/collections" className="hover:underline">Collections</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" style={{ color: "var(--text-soft)" }}>{TITLE}</li>
        </ol>
      </nav>

      <header className="mb-8 sm:mb-10 max-w-2xl">
        <p className="eyebrow mb-3">Just dropped</p>
        <h1 className="display-title mb-4" style={{ fontSize: "clamp(2rem, 5.5vw, 3.2rem)" }}>
          {TITLE}
        </h1>
        <p className="text-sm sm:text-base leading-relaxed" style={{ color: "var(--text-soft)" }}>
          {DESCRIPTION}
        </p>
        {listings.length > 0 && (
          <p className="text-xs mt-4" style={{ color: "var(--text-muted)" }}>
            {listings.length} {listings.length === 1 ? "design" : "designs"} in the last {NEW_ARRIVALS_DAYS} days
          </p>
        )}
      </header>

      {listings.length === 0 ? (
        <p className="text-sm sm:text-base" style={{ color: "var(--text-soft)" }}>
          Nothing new in the last {NEW_ARRIVALS_DAYS} days.{" "}
          <Link href="/collections" className="hover:underline" style={{ color: "var(--brand)" }}>
            Browse the collections
          </Link>{" "}
          in the meantime.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {listings.map((listing, i) => (
            <ProductCard key={listing.id} listing={listing} priority={i < 4} />
          ))}
        </div>
      )}
    </div>
  );
}
