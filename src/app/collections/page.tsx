import type { Metadata } from "next";
import Link from "next/link";
import { getCollections, collectionPath } from "@/lib/collections";
import { shareImageUrl } from "@/lib/share-image";
import { CollectionTiles } from "@/components/collections/CollectionTiles";
import { JsonLd } from "@/components/JsonLd";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designthathits.com";

/*
  The hub every collection hangs off.

  Its job is structural as much as editorial: without it each collection would be
  reachable only from the filter UI and the sitemap, which makes them orphans as far as
  internal linking is concerned. One hub page, linked from the footer, puts every
  category two clicks from the home page for a crawler and for a person.
*/
export const revalidate = 86400;

// Bare: the root layout's title template appends the brand to child segments.
const TITLE = "Shop by Collection";
const SOCIAL_TITLE = "Shop by Collection – Design That Hits";
const DESCRIPTION =
  "Shop print-on-demand designs by occasion, by product or by theme. Christmas, Halloween and birthday gift wrap, plus apparel, ornaments and wall art.";

const baseMetadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/collections` },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Design That Hits",
    title: SOCIAL_TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/collections`,
  },
  twitter: {
    card: "summary_large_image",
    title: SOCIAL_TITLE,
    description: DESCRIPTION,
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const collections = await getCollections();
  // The first tile on the page, so the share card matches what a visitor lands on.
  const hero = collections.find((c) => c.kind === "occasion" && c.imageUrl)?.imageUrl
    ?? collections.find((c) => c.imageUrl)?.imageUrl;
  const share = hero ? { url: shareImageUrl(hero), alt: SOCIAL_TITLE } : null;

  return {
    ...baseMetadata,
    openGraph: {
      ...baseMetadata.openGraph,
      ...(share ? { images: [share] } : {}),
    },
    twitter: {
      ...baseMetadata.twitter,
      ...(share ? { images: [share] } : {}),
    },
  };
}

export default async function CollectionsPage() {
  const collections = await getCollections();
  const occasions = collections.filter((c) => c.kind === "occasion");
  const types = collections.filter((c) => c.kind === "type");
  const themes = collections.filter((c) => c.kind === "theme");

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${SITE_URL}/collections#collection`,
        name: SOCIAL_TITLE,
        url: `${SITE_URL}/collections`,
        description: DESCRIPTION,
        inLanguage: "en-US",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        publisher: { "@id": `${SITE_URL}/#organization` },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: collections.length,
          // Ordered to match the sections below, because ItemList position is meant to
          // describe where an item appears on the page.
          itemListElement: [...occasions, ...types, ...themes].map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: c.label,
            url: `${SITE_URL}${collectionPath(c.slug)}`,
            ...(c.imageUrl ? { image: c.imageUrl } : {}),
          })),
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${SITE_URL}/collections#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Collections", item: `${SITE_URL}/collections` },
        ],
      },
    ],
  };

  return (
    <div className="mx-auto max-w-screen-xl px-4 sm:px-5 py-6 sm:py-10">
      <JsonLd data={jsonLd} />

      <nav aria-label="Breadcrumb" className="mb-6 text-xs sm:text-sm" style={{ color: "var(--text-muted)" }}>
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href="/" className="hover:underline">Home</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" style={{ color: "var(--text-soft)" }}>Collections</li>
        </ol>
      </nav>

      <header className="mb-10 max-w-2xl">
        <p className="eyebrow mb-3">Browse the shop</p>
        <h1 className="display-title mb-4" style={{ fontSize: "clamp(2rem, 5.5vw, 3.2rem)" }}>
          Shop by <span className="display-accent">Collection</span>
        </h1>
        <p className="text-sm sm:text-base leading-relaxed" style={{ color: "var(--text-soft)" }}>
          Every design in the shop, sorted three ways: by the occasion you are buying for, by what it is
          printed on, and by what it is about.
        </p>
      </header>

      {occasions.length > 0 && (
        <section className="mb-12">
          <h2 className="display-title mb-5" style={{ fontSize: "clamp(1.4rem, 3vw, 2rem)" }}>
            By occasion
          </h2>
          <CollectionTiles collections={occasions} priorityCount={4} />
        </section>
      )}

      {types.length > 0 && (
        <section className="mb-12">
          <h2 className="display-title mb-5" style={{ fontSize: "clamp(1.4rem, 3vw, 2rem)" }}>
            By product
          </h2>
          {/* Two eager tiles: the occasions grid above is five tiles, so the top of this
              one can still sit inside the fold on a desktop viewport. */}
          <CollectionTiles collections={types} priorityCount={2} />
        </section>
      )}

      {themes.length > 0 && (
        <section className="mb-4">
          <h2 className="display-title mb-5" style={{ fontSize: "clamp(1.4rem, 3vw, 2rem)" }}>
            By theme
          </h2>
          <CollectionTiles collections={themes} />
        </section>
      )}
    </div>
  );
}
