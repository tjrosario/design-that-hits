import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllListings, getListingById, getRelatedListings } from "@/lib/shop";
import { idFromSlug, listingName, listingPath, listingSlug } from "@/lib/slug";
import { productTypeLabel, themeLabel } from "@/lib/facets";
import { JsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/products/ProductCard";
import type { Listing } from "@/types/etsy";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designthathits.com";

/*
  WHY THESE PAGES EXIST

  Before this, every product linked straight to Etsy, so the site had exactly three
  indexable URLs while the catalogue held ~96,000 words of product copy and 2,050 Etsy
  tags that no search engine could see. Each product now has a page on this domain
  carrying its own description, Product structured data and a breadcrumb trail, with
  Etsy kept as the buy action.

  Revalidated daily: the copy changes only when the catalogue is re-synced, so there is
  no reason to render these per request.
*/
export const revalidate = 86400;

/**
 * Prerender every product at build time.
 *
 * 366 pages is well within what a static build handles comfortably, and it means the
 * whole catalogue is crawlable immediately rather than waiting for first-visit
 * generation.
 */
export async function generateStaticParams() {
  const listings = await getAllListings();
  return listings.map((listing) => ({ slug: listingSlug(listing) }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function resolveListing(slugPromise: PageProps["params"]): Promise<Listing | null> {
  const { slug } = await slugPromise;
  const id = idFromSlug(slug);
  if (id === null) return null;
  return getListingById(id);
}

function formatPrice(price: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(price);
  } catch {
    return `${price.toFixed(2)} ${currency}`;
  }
}

/** First sentence or two of the description, trimmed to a sensible meta length. */
function metaDescription(listing: Listing): string {
  const text = listing.description.replace(/\s+/g, " ").trim();
  if (!text) {
    return `${listingName(listing)} — print-on-demand design from Design That Hits.`;
  }
  if (text.length <= 155) return text;
  const cut = text.slice(0, 155);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(" "));
  return `${cut.slice(0, lastStop > 80 ? lastStop : 155).trim()}…`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const listing = await resolveListing(params);
  if (!listing) return { title: "Design not found" };

  const url = `${SITE_URL}${listingPath(listing)}`;
  const name = listingName(listing);
  const description = metaDescription(listing);

  return {
    title: name,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: "Design That Hits",
      title: name,
      description,
      url,
      // The product photo makes a far better share card than the generic site image.
      ...(listing.image ? { images: [{ url: listing.image.url, alt: listing.image.altText || name }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: name,
      description,
      ...(listing.image ? { images: [listing.image.url] } : {}),
    },
  };
}

export default async function DesignPage({ params }: PageProps) {
  const listing = await resolveListing(params);
  if (!listing) notFound();

  const name = listingName(listing);
  const related = await getRelatedListings(listing, 4);
  const url = `${SITE_URL}${listingPath(listing)}`;
  const typeLabel = listing.productType ? productTypeLabel(listing.productType) : null;

  /*
    The middle breadcrumb is the product-type filter view rather than a separate index
    page. That view is a real, indexable URL listing exactly this category, so the trail
    matches where a visitor would actually go "up" to.
  */
  const categoryCrumb =
    listing.productType && typeLabel
      ? { label: typeLabel, href: `/?types=${listing.productType}` }
      : null;

  const productJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": `${url}#product`,
        name,
        // The full pipe-separated Etsy title, kept as a secondary name so its keyword
        // blocks stay machine-readable without becoming the displayed product name.
        ...(listing.title !== name ? { alternateName: listing.title } : {}),
        description: listing.description || name,
        url,
        ...(listing.image ? { image: [listing.image.url] } : {}),
        ...(typeLabel ? { category: typeLabel } : {}),
        ...(listing.tags.length ? { keywords: listing.tags.join(", ") } : {}),
        brand: { "@type": "Brand", name: "Design That Hits" },
        offers: {
          "@type": "Offer",
          price: listing.price.toFixed(2),
          priceCurrency: listing.currency,
          availability: "https://schema.org/InStock",
          // The offer points at Etsy because that is where the transaction happens.
          url: listing.url,
          seller: { "@id": `${SITE_URL}/#organization` },
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          ...(categoryCrumb
            ? [{ "@type": "ListItem", position: 2, name: categoryCrumb.label, item: `${SITE_URL}${categoryCrumb.href}` }]
            : []),
          { "@type": "ListItem", position: categoryCrumb ? 3 : 2, name, item: url },
        ],
      },
    ],
  };

  return (
    <div className="mx-auto max-w-screen-xl px-4 sm:px-5 py-6 sm:py-10">
      <JsonLd data={productJsonLd} />

      {/* Visible breadcrumb, mirroring the structured data. */}
      <nav aria-label="Breadcrumb" className="mb-6 text-xs" style={{ color: "var(--text-muted)" }}>
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:underline">Home</Link>
          </li>
          {categoryCrumb && (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link href={categoryCrumb.href} className="hover:underline">{categoryCrumb.label}</Link>
              </li>
            </>
          )}
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="truncate max-w-[16rem] sm:max-w-none" style={{ color: "var(--text-soft)" }}>
            {name}
          </li>
        </ol>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10">
        {/* Image */}
        <div
          className="relative rounded-3xl overflow-hidden"
          style={{ background: "var(--surface)", border: "1px solid var(--border-soft)", aspectRatio: "1 / 1" }}
        >
          {listing.image ? (
            <Image
              src={listing.image.url}
              alt={listing.image.altText || name}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
              // The product photo is the LCP element on this page.
              priority
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
              No image available
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="flex flex-col">
          {typeLabel && <p className="eyebrow mb-3">{typeLabel}</p>}

          <h1
            className="display-title mb-4"
            style={{ fontSize: "clamp(1.7rem, 3.4vw, 2.6rem)" }}
          >
            {name}
          </h1>

          <p
            className="text-2xl mb-6"
            style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--text)" }}
          >
            {formatPrice(listing.price, listing.currency)}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <a
              href={listing.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-cta flex-1"
            >
              Buy on Etsy
              <span className="arrow-circle" aria-hidden="true">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
                </svg>
              </span>
            </a>
            <Link href="/" className="btn-outline flex-1">
              Browse all designs
            </Link>
          </div>

          {listing.description && (
            <div className="mb-8">
              <h2
                className="text-lg mb-3"
                style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--text)" }}
              >
                About this design
              </h2>
              {/*
                whitespace-pre-line keeps the paragraph breaks Etsy authors write into the
                description. Rendering it as one block would turn 260 words into a wall.
              */}
              <p
                className="text-sm leading-relaxed whitespace-pre-line"
                style={{ color: "var(--text-soft)" }}
              >
                {listing.description}
              </p>
            </div>
          )}

          {listing.themes && listing.themes.length > 0 && (
            <div>
              <h2 className="eyebrow mb-3">Themes</h2>
              <ul className="flex flex-wrap gap-2">
                {listing.themes.map((theme) => (
                  <li key={theme}>
                    {/* Links back into the filtered grid, which gives crawlers a real
                        path between products and their category views. */}
                    <Link href={`/?themes=${theme}`} className="filter-pill inline-flex">
                      {themeLabel(theme)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-14 sm:mt-20">
          <h2
            className="display-title mb-6"
            style={{ fontSize: "clamp(1.4rem, 3vw, 2rem)" }}
          >
            You might also <span className="display-accent">like</span>
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {related.map((item) => (
              <li key={item.id} className="product-zone">
                <ProductCard listing={item} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
