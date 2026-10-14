/**
 * Private planning view: what to design next.
 *
 * Not linked from anywhere, `noindex, nofollow`, and disallowed in robots.txt. It carries
 * no customer data, only aggregates of the public catalog, so it is unlisted rather than
 * authenticated. If that ever stops being true it needs a real gate before anything
 * sensitive goes on it.
 */

import type { Metadata } from "next";
import { MIN_INTERSECTION_PRODUCTS as MIN_PRODUCTS } from "@/lib/collections";
import Link from "next/link";
import { buildStudioReport, THIN_AXIS, type Opportunity } from "@/lib/studio";
import { collectionPath } from "@/lib/collections";
import { occasionLabel } from "@/lib/facets";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Studio",
  robots: { index: false, follow: false },
};

const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/New_York",
});

function OpportunityRow({ item }: { item: Opportunity }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3" style={{ borderTop: "1px solid var(--border-soft)" }}>
      <span className="text-sm sm:text-base font-semibold" style={{ color: "var(--text)" }}>
        {item.a.label} + {item.b.label}
      </span>
      {item.seasonal && (
        <span
          className="text-[0.65rem] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold"
          style={{ background: "var(--gradient-brand)", color: "var(--brand-ink)" }}
        >
          In season
        </span>
      )}
      <span className="text-sm tabular-nums" style={{ color: "var(--text-muted)" }}>
        {item.count} {item.count === 1 ? "design" : "designs"}
        {item.shortfall > 0 && (
          <>
            {" · "}
            <strong style={{ color: "var(--text-soft)" }}>
              {item.shortfall} more, then copy
            </strong>
          </>
        )}
      </span>
    </li>
  );
}

export default async function StudioPage() {
  const report = await buildStudioReport();
  const thin = report.axes.filter((a) => a.count < THIN_AXIS);

  return (
    <div className="mx-auto max-w-screen-lg px-4 sm:px-5 py-8 sm:py-12">
      <header className="mb-10">
        <p className="eyebrow mb-3">Planning</p>
        <h1 className="display-title mb-3" style={{ fontSize: "clamp(1.9rem, 5vw, 2.8rem)" }}>
          What to design next
        </h1>
        <p className="text-sm sm:text-base leading-relaxed max-w-2xl" style={{ color: "var(--text-soft)" }}>
          Built from the {report.totalListings} listings in the catalog and the facet rules, as of{" "}
          {dateFormat.format(report.generatedAt)}. Every figure here is first-party. There is no
          Etsy-wide trending data in it, because no Etsy API tier exposes any.
        </p>
      </header>

      {report.openOccasions.length > 0 && (
        <section className="mb-10 rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border-soft)" }}>
          <h2 className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
            Selling now
          </h2>
          <p className="text-sm sm:text-base" style={{ color: "var(--text-soft)" }}>
            {report.openOccasions.map((slug) => (
              <Link key={slug} href={collectionPath(slug)} className="hover:underline mr-3" style={{ color: "var(--text)" }}>
                {occasionLabel(slug)}
              </Link>
            ))}
          </p>
        </section>
      )}

      {/*
        The cheapest work on the site: these already have the products, so a label and an
        intro in INTERSECTIONS is the entire remaining cost of a new indexable page.
      */}
      <section className="mb-12">
        <h2 className="display-title mb-1" style={{ fontSize: "clamp(1.3rem, 3vw, 1.8rem)" }}>
          Write copy, get a page
        </h2>
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          Already past {MIN_PRODUCTS} products. A page needs stock <em>and</em> a hand-written entry in{" "}
          <code className="text-xs">INTERSECTIONS</code>, and these are only missing the entry. No design
          work at all.
        </p>
        {report.copyOnly.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-soft)" }}>Nothing waiting on copy.</p>
        ) : (
          <ul>
            {report.copyOnly.map((item) => (
              <OpportunityRow key={`${item.a.slug}|${item.b.slug}`} item={item} />
            ))}
          </ul>
        )}
      </section>

      <section className="mb-12">
        <h2 className="display-title mb-1" style={{ fontSize: "clamp(1.3rem, 3vw, 1.8rem)" }}>
          A few designs short
        </h2>
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          Within four designs of {MIN_PRODUCTS}. These need the designs first and then copy, so they
          cost more than the list above.
        </p>
        {report.needsDesigns.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-soft)" }}>Nothing within reach.</p>
        ) : (
          <ul>
            {report.needsDesigns.map((item) => (
              <OpportunityRow key={`${item.a.slug}|${item.b.slug}`} item={item} />
            ))}
          </ul>
        )}
      </section>

      <section className="mb-12">
        <h2 className="display-title mb-1" style={{ fontSize: "clamp(1.3rem, 3vw, 1.8rem)" }}>
          Thinnest shelves
        </h2>
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          Occasions and themes under {THIN_AXIS} designs. A shelf this light reads as an
          afterthought to a shopper who lands on it.
        </p>
        <ul className="flex flex-wrap gap-2">
          {thin.map((a) => (
            <li key={a.slug}>
              <Link href={collectionPath(a.slug)} className="filter-pill inline-flex">
                {a.label}
                <span className="ml-1.5 tabular-nums opacity-75">{a.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-12">
        <h2 className="display-title mb-1" style={{ fontSize: "clamp(1.3rem, 3vw, 1.8rem)" }}>
          Product mix
        </h2>
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          What the catalog is made of, which is worth seeing next to the shelves above.
        </p>
        <ul>
          {report.byType.map((a) => (
            <li key={a.slug} className="flex items-center gap-3 py-1.5">
              <span className="text-sm w-44 flex-shrink-0" style={{ color: "var(--text-soft)" }}>{a.label}</span>
              {/* The track takes the remaining width and the fill is a share of it, so the
                  widest bar cannot squeeze the label out of its own row. */}
              <span className="flex-1 h-2 rounded-full" style={{ background: "var(--border-soft)" }}>
                <span
                  className="block h-2 rounded-full"
                  style={{
                    width: `${Math.max(2, (a.count / report.totalListings) * 100)}%`,
                    background: "var(--gradient-brand)",
                  }}
                />
              </span>
              <span className="text-xs tabular-nums w-10 text-right flex-shrink-0" style={{ color: "var(--text-muted)" }}>{a.count}</span>
            </li>
          ))}
        </ul>
      </section>

      {/*
        Stated rather than silently absent, so the page is honest about what it cannot
        see. Both are a key away, and the note says which key.
      */}
      <section className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border-soft)" }}>
        <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
          Not here yet
        </h2>
        <ul className="text-sm space-y-2" style={{ color: "var(--text-soft)" }}>
          <li>
            <strong style={{ color: "var(--text)" }}>Your own views and favorites.</strong> Every listing carries zero,
            because the CSV export and the RSS feed do not include them. An Etsy Seller App key would fill them in on
            the next sync, and that tier is approved in minutes for your own shop.
          </li>
          <li>
            <strong style={{ color: "var(--text)" }}>Pinterest trending keywords.</strong> API v5 returns up to fifty per
            region with growth figures. It needs the business account and an app with the{" "}
            <code className="text-xs">user_accounts:read</code> scope.
          </li>
          <li>
            <strong style={{ color: "var(--text)" }}>Etsy-wide trends.</strong> Not coming. No Etsy tier exposes trending
            or keyword volume, so anything claiming to show it is either scraping search or guessing.
          </li>
        </ul>
      </section>
    </div>
  );
}
