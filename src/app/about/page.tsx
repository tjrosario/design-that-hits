import type { Metadata } from "next";
import Image from "next/image";
import { JsonLd } from "@/components/JsonLd";
import { getRandomListings } from "@/lib/shop";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://designthathits.com";

export const metadata: Metadata = {
  title:       "About Us",
  description: "Learn about Design That Hits — a print-on-demand Etsy shop specialising in unique gifts, wrapping paper, and party designs crafted to make every occasion memorable.",
  alternates:  { canonical: `${SITE_URL}/about` },
  openGraph: {
    type:        "website",
    locale:      "en_US",
    siteName:    "Design That Hits",
    title:       "About Design That Hits",
    description: "Learn about Design That Hits — a print-on-demand Etsy shop specialising in unique gifts, wrapping paper, and party designs crafted to make every occasion memorable.",
    url:         `${SITE_URL}/about`,
    images: [{ url: `${SITE_URL}/og-image.jpg`, width: 1200, height: 630, alt: "Design That Hits – About Us" }],
  },
  twitter: {
    card:        "summary_large_image",
    title:       "About Design That Hits",
    description: "Learn about Design That Hits — print-on-demand gifts, wrapping paper, and party designs.",
  },
};

/*
  Revalidated hourly rather than rendered per request. The tile photos are chosen at
  random, so this keeps them changing over time without giving up caching on what is
  otherwise a static page.
*/
export const revalidate = 3600;

export default async function AboutPage() {
  // Chosen in the data layer, not here: React 19 requires render to be pure, so the
  // random pick lives in getRandomListings. Safe from hydration mismatches either way
  // because this is a server component — the selection is baked into the payload and
  // never recomputed on the client.
  const tilePhotos = await getRandomListings(4);
  const aboutJsonLd = {
    "@context":  "https://schema.org",
    "@type":     "AboutPage",
    "@id":       `${SITE_URL}/about#webpage`,
    url:          `${SITE_URL}/about`,
    name:         "About Design That Hits",
    description:  "Design That Hits is a print-on-demand Etsy shop specialising in unique gifts, wrapping paper, and party designs.",
    inLanguage:   "en-US",
    isPartOf:     { "@id": `${SITE_URL}/#website` },
    about:        { "@id": `${SITE_URL}/#organization` },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home",     item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "About Us", item: `${SITE_URL}/about` },
      ],
    },
  };

  return (
    <div>
      <JsonLd data={aboutJsonLd} />

      {/* Hero */}
      <section className="mx-auto max-w-screen-xl px-5 pt-6 pb-14">
        {/* Same treatment as the home hero: themed surface plus the brand glow, rather
            than the old fixed sand/pastel palette which fought both themes. */}
        <div
          className="rounded-3xl px-6 sm:px-10 py-16 md:py-20 text-center relative overflow-hidden"
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-soft)" }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundImage: "var(--gradient-hero)" }}
            aria-hidden="true"
          />
          <div className="relative z-10">
            <p className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: "var(--brand)", fontFamily: "var(--font-display)" }}>
              Our Story
            </p>
            <h1
              className="text-5xl md:text-7xl font-black uppercase leading-none mb-6"
              style={{ fontFamily: "var(--font-display)", color: "var(--text)" }}
            >
              Crafted to make<br />every moment<br />
              <span style={{ color: "var(--brand)" }}>Memorable.</span>
            </h1>
            <p className="text-base max-w-xl mx-auto" style={{ color: "var(--text-soft)" }}>
              We believe the little things — the wrapping paper, the party decoration — are what people remember most.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-screen-xl px-5 pb-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-14">
          {/*
            These used to sit on hardcoded pastel backgrounds (#E8C547, #7DC4A8 …) with
            themed foreground colours on top. In the dark theme that put near-white text
            on pale yellow — 1.55:1, where WCAG AA needs 4.5:1. Using the shared panel
            surface keeps text and background from the same palette, so contrast holds in
            both themes.
          */}
          {[
            { label: "Wrapping Paper",  desc: "Stand-out patterns for every occasion",  accent: "#FF6BA5" },
            { label: "Party Designs",   desc: "Banners, invites, decorations & more",   accent: "#7DC4A8" },
            { label: "Unique Gifts",    desc: "Thoughtful designs for people you love", accent: "#E8C547" },
            { label: "Print on Demand", desc: "Ordered and printed fresh, just for you", accent: "#8FB4F0" },
          ].map((item, i) => {
            const photo = tilePhotos[i]?.image?.url ?? null;
            return (
            <div
              key={item.label}
              className="about-tile panel p-5 min-h-[300px] flex flex-col justify-between"
              // Consumed by .about-tile's glow, dot and hover border in globals.css.
              style={{ ["--tile-accent" as string]: item.accent }}
            >
              {photo && (
                <Image
                  src={photo}
                  // Decorative: the tile's own heading already names the category, so
                  // announcing the product behind it would just add noise.
                  alt=""
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="about-tile__media"
                />
              )}
              <span className="about-tile__scrim" aria-hidden="true" />
              <span className="about-tile__dot" aria-hidden="true" />
              <div className="about-tile__content mt-4">
                <p
                  className="text-lg leading-tight"
                  style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--text)" }}
                >
                  {item.label}
                </p>
                <p className="text-xs leading-snug mt-1.5" style={{ color: "var(--text-soft)" }}>
                  {item.desc}
                </p>
              </div>
            </div>
            );
          })}
        </div>

        <div className="max-w-2xl">
          <h2 className="text-4xl font-black uppercase mb-4" style={{ fontFamily: "var(--font-display)", color: "var(--text)" }}>
            Where It All Began
          </h2>
          <p className="text-base leading-relaxed mb-4" style={{ color: "var(--text-muted)" }}>
            Design That Hits was born from a love of bold, meaningful design. We started with a simple belief: the wrapping is part of the gift, and every party deserves something that looks as good as it feels.
          </p>
          <p className="text-base leading-relaxed mb-8" style={{ color: "var(--text-muted)" }}>
            Our designs are print-on-demand — ordered when you need them, printed fresh and shipped directly. Every piece is made to be noticed, remembered, and treasured.
          </p>
          <a
            href="https://designthathits.etsy.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-cta inline-flex"
          >
            Shop on Etsy
            <span className="arrow-circle" aria-hidden="true">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
              </svg>
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}
