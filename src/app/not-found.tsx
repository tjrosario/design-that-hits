import type { Metadata } from "next";
import Link from "next/link";
import { getRandomListings } from "@/lib/shop";
import { listingName, listingPath } from "@/lib/slug";

/*
  WHY THIS EXISTS

  There are 366 product URLs in the sitemap and in Google's index. Etsy listings get
  delisted, sold out or renumbered, so some of those URLs will start 404ing. Next's stock
  404 is a bare "This page could not be found" with no navigation at all, which dead-ends
  both the visitor and the crawler.

  This one keeps them moving: real links into the catalogue plus four live products, so a
  crawler that lands here still finds its way back into the site.
*/

export const metadata: Metadata = {
  title: "Page not found",
  description: "That page has moved or the design is no longer available. Browse the rest of the collection.",
  /*
    Next emits its own <meta name="robots" content="noindex"> for a not-found response, so
    there are two robots tags on this page either way. This one still has to be declared:
    without it the root layout's `index, follow` is inherited, leaving Next's noindex
    sitting next to an explicit index directive and a googlebot tag also saying index.
    Declaring it replaces both with something consistent.
  */
  robots: { index: false, follow: true },
};

/*
  Cached for an hour like the other product-backed pages. Nothing here is per-visitor, and
  rendering it fresh on every 404 would mean loading the whole catalogue for what is often
  a bot hitting a dead URL.
*/
export const revalidate = 3600;

export default async function NotFound() {
  /*
    Suggestions are best-effort. If the catalogue is unreachable the page still has to
    render — a 404 that itself errors is the one thing worse than a 404.
  */
  let suggestions: Awaited<ReturnType<typeof getRandomListings>> = [];
  try {
    suggestions = await getRandomListings(4);
  } catch {
    suggestions = [];
  }

  return (
    <div className="mx-auto max-w-screen-xl px-5 py-16 sm:py-24">
      <div className="max-w-xl">
        <p className="eyebrow mb-4">404</p>
        <h1 className="display-title mb-5" style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)" }}>
          This one didn&apos;t <span className="display-accent">land</span>.
        </h1>
        <p className="text-base leading-relaxed mb-8" style={{ color: "var(--text-soft)" }}>
          The page you were after has moved, or the design is no longer available. The rest of the
          collection is very much still here.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/" className="btn-cta">
            Browse all designs
            <span className="arrow-circle" aria-hidden="true">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
              </svg>
            </span>
          </Link>
          <Link href="/about" className="btn-outline">
            About the shop
          </Link>
        </div>
      </div>

      {suggestions.length > 0 && (
        <section className="mt-16 sm:mt-20">
          <h2 className="display-title mb-6" style={{ fontSize: "clamp(1.3rem, 3vw, 1.8rem)" }}>
            Try one of <span className="display-accent">these</span>
          </h2>
          {/*
            Plain text links rather than the full product card. The card is a client
            component and this page renders on a dead URL that is often hit by a bot, so
            there is no reason to ship an interactive grid to it. Links are all a crawler
            needs to keep walking.
          */}
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            {suggestions.map((listing) => (
              <li key={listing.id}>
                <Link
                  href={listingPath(listing)}
                  className="text-sm hover:underline"
                  style={{ color: "var(--text-soft)" }}
                >
                  {listingName(listing)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
