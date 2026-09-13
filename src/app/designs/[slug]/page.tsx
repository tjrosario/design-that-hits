import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllListings, getListingById, getRelatedListings, hasRealEtsyId } from "@/lib/shop";
import { idFromSlug, listingAltText, listingName, listingPath, listingSlug } from "@/lib/slug";
import { productTypeLabel, themeLabel } from "@/lib/facets";
import { collectionPath } from "@/lib/collections";
import { parseDescription } from "@/lib/description";
import { JsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/products/ProductCard";
import type { Listing } from "@/types/etsy";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designthathits.com";

/**
 * `priceValidUntil` for every offer: a year out from when this module was loaded.
 *
 * Google drops the price from a merchant listing result when the offer has no
 * priceValidUntil, and treats a past date as a stale price. There is no real expiry here
 * — these prices stand until the shop changes them — so a rolling year is the honest
 * answer, and a year of head room means it cannot go stale between deploys.
 *
 * Computed at module scope rather than in the component because react-hooks/purity
 * rejects `Date.now()` during render, and rightly so: a value that changes on every
 * re-render has no business in the output.
 */
const PRICE_VALID_UNTIL = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);

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

  /*
    Trim back to a boundary rather than chopping at character 155. Preference order is a
    sentence end, then any word break, then the hard cut — which is only reachable for
    text with no space at all in its first 155 characters. The old version fell straight
    from "no sentence end past character 80" to the hard cut, so a description whose first
    break landed early ended mid-word.
  */
  const cut = text.slice(0, 155);
  const sentenceEnd = cut.lastIndexOf(". ");
  if (sentenceEnd > 80) return `${cut.slice(0, sentenceEnd).trim()}…`;

  const wordEnd = cut.lastIndexOf(" ");
  return `${(wordEnd > 0 ? cut.slice(0, wordEnd) : cut).trim()}…`;
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
      /*
        No `type` here on purpose. This is a product page, so og:type should be "product",
        but Next's OpenGraphType union has no such member (see
        node_modules/next/dist/lib/metadata/types/opengraph-types.d.ts) and "website" is
        simply wrong — it is what stops Pinterest treating these as product Rich Pins.
        Omitting the field makes Next emit no og:type at all, leaving the page free to
        render the correct one itself. See ProductOpenGraph below.
      */
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

/**
 * The OpenGraph tags Next's Metadata API cannot express.
 *
 * og:type and the product:* namespace are what turn a share into a Pinterest product
 * Rich Pin — price and availability shown on the pin itself — which matters here because
 * Pinterest is a primary discovery surface for print-on-demand gifts.
 *
 * These are plain <meta> elements rendered in the page body; React hoists them into
 * <head>, and Next emits no competing og:type because generateMetadata omits it.
 */
function ProductOpenGraph({ listing }: { listing: Listing }) {
  return (
    <>
      <meta property="og:type" content="product" />
      <meta property="product:price:amount" content={listing.price.toFixed(2)} />
      <meta property="product:price:currency" content={listing.currency} />
      <meta property="product:availability" content="in stock" />
    </>
  );
}

export default async function DesignPage({ params }: PageProps) {
  const listing = await resolveListing(params);
  /*
    A miss here returns a correct 404 status, which is what deindexes the URL. Note that
    Next does not server-render the not-found body for a notFound() raised in an on-demand
    dynamic route — the markup arrives in the RSC payload and paints after hydration.
    Verified against a production build with both the root boundary and a trivial
    segment-level not-found.tsx, so it is framework behaviour rather than something this
    page controls. A top-level miss such as /nope renders app/not-found.tsx normally.
  */
  if (!listing) notFound();

  const name = listingName(listing);
  const descriptionBlocks = parseDescription(listing.description);
  const related = await getRelatedListings(listing, 4);
  const url = `${SITE_URL}${listingPath(listing)}`;
  const typeLabel = listing.productType ? productTypeLabel(listing.productType) : null;

  /*
    The middle breadcrumb is the product type's collection page. It used to be the
    equivalent filtered home URL, `/?types=sticker`; the collection is the same set of
    products at a real path, so the trail now points at the page that is meant to rank
    for the category rather than at a parameterised view of the home page.
  */
  const categoryCrumb =
    listing.productType && typeLabel
      ? { label: typeLabel, href: collectionPath(listing.productType) }
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
        /*
          The Etsy listing ID doubles as the SKU. It is the only stable, externally
          meaningful identifier this catalogue has — the CSV export's own `sku` column
          holds a comma-separated list of per-variant IDs, which is not a product-level
          SKU and is dropped during normalisation. Listings whose ID was synthesised from
          the title (see hasRealEtsyId) publish no identifier rather than a made-up one.
        */
        ...(hasRealEtsyId(listing) ? { sku: String(listing.id), productID: String(listing.id) } : {}),
        // Print-on-demand: every item is manufactured on order, so never anything but new.
        itemCondition: "https://schema.org/NewCondition",
        offers: {
          "@type": "Offer",
          price: listing.price.toFixed(2),
          priceCurrency: listing.currency,
          availability: "https://schema.org/InStock",
          itemCondition: "https://schema.org/NewCondition",
          priceValidUntil: PRICE_VALID_UNTIL,
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
      <ProductOpenGraph listing={listing} />
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
              alt={listingAltText(listing)}
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

          {descriptionBlocks.length > 0 && (
            <div className="mb-8">
              <h2
                className="text-lg mb-3"
                style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--text)" }}
              >
                About this design
              </h2>
              {/*
                Rendered from parsed blocks rather than dumped into one whitespace-pre-line
                paragraph. Sellers write real headings and bullet lists into Etsy's plain
                text field; as a single <p> that structure was visible but not readable —
                a screen reader got a run-on paragraph full of stray hyphens, and crawlers
                got no list markup at all. See lib/description.ts.
              */}
              <div className="text-sm leading-relaxed" style={{ color: "var(--text-soft)" }}>
                {descriptionBlocks.map((block, i) => {
                  if (block.kind === "heading") {
                    return (
                      <h3
                        key={i}
                        className="text-sm mt-5 mb-2 first:mt-0"
                        style={{ fontWeight: 600, color: "var(--text)" }}
                      >
                        {block.text}
                      </h3>
                    );
                  }
                  if (block.kind === "list") {
                    return (
                      <ul key={i} className="list-disc pl-5 space-y-1 mb-4 marker:text-[var(--brand)]">
                        {block.items.map((item, j) => (
                          <li key={j}>{item}</li>
                        ))}
                      </ul>
                    );
                  }
                  return (
                    <p key={i} className="mb-4 whitespace-pre-line">
                      {block.text}
                    </p>
                  );
                })}
              </div>
            </div>
          )}

          {listing.themes && listing.themes.length > 0 && (
            <div>
              <h2 className="eyebrow mb-3">Themes</h2>
              <ul className="flex flex-wrap gap-2">
                {listing.themes.map((theme) => (
                  <li key={theme}>
                    {/* Straight to the theme's collection page, not the equivalent
                        `/?themes=…` filter URL. That URL canonicalises to this one, so
                        pointing at it would spend every product page's internal links on
                        a URL that defers to somewhere else. Every theme a listing carries
                        has at least that listing in it, so it always has a collection. */}
                    <Link href={collectionPath(theme)} className="filter-pill inline-flex">
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
