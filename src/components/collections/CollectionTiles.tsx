import Image from "next/image";
import Link from "next/link";
import { collectionPath, type Collection } from "@/lib/collections";

interface CollectionTilesProps {
  collections: Collection[];
  /**
   * How many tiles to load eagerly. Set it to the first row on a page where these sit
   * near the top, leave it at 0 where they are below the fold.
   */
  priorityCount?: number;
}

/**
 * The category tile grid, shared by the home page and the /collections hub.
 *
 * Each tile leads with a product from the collection. A grid of text panels made the two
 * pages read as a site map rather than a storefront, and on a shop the picture is what
 * tells someone whether a category is for them.
 */
export function CollectionTiles({ collections, priorityCount = 0 }: CollectionTilesProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {collections.map((c, i) => (
        <Link
          key={c.slug}
          href={collectionPath(c.slug)}
          className="panel group relative overflow-hidden flex flex-col justify-between min-h-[150px] p-4 sm:p-5 transition-transform hover:-translate-y-1"
        >
          {c.imageUrl && (
            <>
              <Image
                src={c.imageUrl}
                alt=""
                fill
                // Matches this grid inside a max-w-screen-xl (1280px) container: two
                // columns on a phone, three from md, four from lg where 25% is 320px.
                sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 320px"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                priority={i < priorityCount}
              />
              {/* Scrim, so the label keeps its contrast over any photo. */}
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0.12) 100%)" }}
                aria-hidden="true"
              />
            </>
          )}

          <span
            className="relative z-10 text-[11px] font-semibold tracking-wide px-2.5 py-1 rounded-full self-start"
            style={
              c.imageUrl
                ? { background: "rgba(255,255,255,0.92)", color: "var(--brand)" }
                : { background: "var(--brand-wash)", color: "var(--brand)" }
            }
          >
            {c.count} {c.count === 1 ? "design" : "designs"}
          </span>

          <div className="relative z-10 flex items-end justify-between gap-2 mt-4">
            <p
              className="text-base sm:text-lg leading-tight"
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                color: c.imageUrl ? "#fff" : "var(--text)",
                textShadow: c.imageUrl ? "0 1px 3px rgba(0,0,0,0.5)" : undefined,
              }}
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
