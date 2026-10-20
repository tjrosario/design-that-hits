import Link from "next/link";
import { ProductCard } from "@/components/products/ProductCard";
import type { Rail } from "@/lib/related";

/**
 * A horizontally scrolling row of products.
 *
 * Scroll rather than a wrapped grid, so ten products fit under a product page without
 * pushing the page to twice its length. CSS scroll-snap and no JavaScript: there is no
 * state to hydrate, it works before the bundle lands, and it degrades to an ordinary
 * scrollable list if the snap properties are unsupported.
 *
 * The region carries `tabIndex={0}` and a label. A scrollable box is operable by mouse
 * and touch for free, but a keyboard user can only reach it if it is focusable, and
 * without the label a screen reader announces an unnamed group.
 */
export function ProductRail({ rail }: { rail: Rail }) {
  const headingId = `rail-${rail.id}`;

  return (
    <section className="mt-12 sm:mt-16" aria-labelledby={headingId}>
      <div className="flex items-baseline justify-between gap-4 mb-5">
        <h2
          id={headingId}
          className="display-title"
          style={{ fontSize: "clamp(1.25rem, 2.8vw, 1.75rem)" }}
        >
          {rail.heading}
        </h2>
        <Link
          href={rail.href}
          className="text-sm whitespace-nowrap hover:underline flex-shrink-0"
          style={{ color: "var(--brand)" }}
        >
          See all
        </Link>
      </div>

      {/* The negative margin and matching padding let the row bleed to the viewport edge
          on a phone while the first card still lines up with the text above it. */}
      <div
        role="group"
        tabIndex={0}
        aria-labelledby={headingId}
        className="-mx-4 sm:-mx-5 px-4 sm:px-5 overflow-x-auto pb-2 snap-x snap-mandatory focus-visible:outline-2"
        style={{ scrollbarWidth: "thin" }}
      >
        <ul className="flex gap-4">
          {rail.listings.map((listing) => (
            <li
              key={listing.id}
              className="product-zone snap-start flex-shrink-0 w-[46%] sm:w-[31%] md:w-[23%] xl:w-[18%]"
            >
              <ProductCard listing={listing} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
