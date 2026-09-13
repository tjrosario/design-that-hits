import Link from "next/link";
import { collectionPath, type Collection } from "@/lib/collections";

/**
 * The category tile grid, shared by the home page and the /collections hub.
 *
 * Extracted from the hub when the home page grew its own copy. The two were always going
 * to drift apart otherwise, and a category tile that looks different depending on where
 * you found it is a small but real trust cost on a storefront.
 */
export function CollectionTiles({ collections }: { collections: Collection[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {collections.map((c) => (
        <Link
          key={c.slug}
          href={collectionPath(c.slug)}
          className="panel group relative p-4 sm:p-5 flex flex-col justify-between min-h-[120px] transition-transform hover:-translate-y-1"
        >
          <span
            className="text-[11px] font-semibold tracking-wide px-2.5 py-1 rounded-full self-start"
            style={{ background: "var(--brand-wash)", color: "var(--brand)" }}
          >
            {c.count} {c.count === 1 ? "design" : "designs"}
          </span>
          <div className="flex items-end justify-between gap-2 mt-4">
            <p
              className="text-base sm:text-lg leading-tight"
              style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--text)" }}
            >
              {c.label}
            </p>
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-transform group-hover:rotate-45"
              style={{ background: "var(--gradient-brand)", color: "var(--brand-ink)" }}
              aria-hidden="true"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
              </svg>
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
