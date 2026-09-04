import type { Metadata } from "next";
import Link from "next/link";
import { getCollections, collectionPath } from "@/lib/collections";
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
  "Browse every category of print-on-demand design, from wrapping paper and stickers to apparel, ornaments and wall art, plus themes like cats, gothic, retro and floral.";

export const metadata: Metadata = {
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

export default async function CollectionsPage() {
  const collections = await getCollections();
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
          itemListElement: collections.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: c.label,
            url: `${SITE_URL}${collectionPath(c.slug)}`,
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
          Every design in the shop, sorted two ways: by what it is printed on, and by what it is about.
        </p>
      </header>

      {types.length > 0 && (
        <section className="mb-12">
          <h2 className="display-title mb-5" style={{ fontSize: "clamp(1.4rem, 3vw, 2rem)" }}>
            By product
          </h2>
          <CollectionTiles collections={types} />
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
