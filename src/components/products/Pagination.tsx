"use client";

import Link from "next/link";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPage: (page: number) => void;
  /**
   * Real URL for a given page number.
   *
   * Every control that has somewhere to go is an <a> carrying this href, rather than the
   * bare <button> they all used to be. The click handler still drives the fast
   * client-side update, but the href is what makes the catalogue crawlable: without it a
   * search engine could not reach page 2 of any view by following links, so 342 of the
   * 366 products were discoverable only through the sitemap. It also restores what users
   * expect from a link — middle-click, cmd-click, "copy link address", hover preview.
   */
  hrefForPage: (page: number) => string;
  /** Spacing is left to the caller so the same control works above and below the grid. */
  className?: string;
  /** Distinguishes the two instances for assistive tech. */
  label?: string;
  /** A page change is in flight. The control stays visible and usable, just marked. */
  busy?: boolean;
}

/**
 * True when a click should be left alone for the browser to handle natively — a new tab,
 * a new window, a download. Intercepting these would break cmd-click on a link, which is
 * the most common way the button version silently failed people.
 */
function isModifiedClick(e: React.MouseEvent): boolean {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
}

export function Pagination({
  currentPage,
  totalPages,
  onPage,
  hrefForPage,
  className = "",
  label = "Pagination",
  busy = false,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: (number | "...")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  const go = (page: number) => (e: React.MouseEvent) => {
    if (isModifiedClick(e)) return;
    e.preventDefault();
    onPage(page);
  };

  const atStart = currentPage === 1;
  const atEnd = currentPage === totalPages;

  /*
    Prev/Next at the ends of the range stay <button disabled>, not links.

    There is no such thing as a disabled anchor: `aria-disabled` on an <a href> still
    leaves it focusable and followable, and dropping the href leaves a focusable element
    that does nothing. A disabled <button> is the honest element — and WCAG 1.4.3 exempts
    disabled controls from the contrast minimum, which a greyed-out <span> is not. Styling
    the edge state as a span failed contrast at 1.95:1 for exactly that reason.
  */
  const edgeClass = "filter-pill disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0";
  const armedClass = "filter-pill flex-shrink-0";

  return (
    /*
      Two layouts, not one that wraps.

      A 16 page catalogue renders seven number links plus Prev and Next. Letting that
      wrap on a phone produced a 166px tall block six rows deep at 320px — technically
      contained, but unusable. Below sm the numbers are replaced by a single "8 / 16"
      indicator and the row becomes Prev · position · Next, which fits on one line at
      every width. From sm up the full number list returns.

      Both variants are always in the DOM with CSS choosing between them, so there is no
      viewport-dependent rendering for the server to get wrong.
    */
    <nav
      className={`flex items-center justify-between gap-2 w-full sm:w-auto sm:flex-wrap sm:justify-end sm:gap-x-2 sm:gap-y-2 transition-opacity ${className}`}
      aria-label={label}
      aria-busy={busy || undefined}
      // Faded rather than hidden while a page loads: it stays in place, keeps its size
      // so nothing reflows, and still reads as "working on it".
      style={{ opacity: busy ? 0.55 : 1 }}
    >
      {atStart ? (
        <button type="button" disabled className={edgeClass} aria-label="Previous page">
          <span aria-hidden="true">←</span>
          <span className="hidden xs:inline sm:inline"> Prev</span>
        </button>
      ) : (
        <Link
          href={hrefForPage(currentPage - 1)}
          onClick={go(currentPage - 1)}
          className={armedClass}
          aria-label="Previous page"
          rel="prev"
        >
          <span aria-hidden="true">←</span>
          <span className="hidden xs:inline sm:inline"> Prev</span>
        </Link>
      )}

      {/*
        Compact position readout, phones only.

        Deliberately NOT aria-hidden. The numbered links that normally carry aria-current
        are `hidden` below sm, and display:none removes them from the accessibility tree —
        so on a phone this is the only thing telling a screen reader user where they are.
        The visible "8 / 16" is hidden from assistive tech and a spoken "Page 8 of 16"
        substituted, because a bare slash reads as noise.
      */}
      <span className="sm:hidden text-xs font-semibold tabular-nums" style={{ color: "var(--text-muted)" }}>
        <span className="sr-only">Page {currentPage} of {totalPages}</span>
        <span aria-hidden="true">
          {currentPage} / {totalPages}
        </span>
      </span>

      <div className="hidden sm:flex flex-wrap items-center justify-center gap-1.5">
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`e-${i}`} className="px-2 text-sm" style={{ color: "var(--text-muted)" }}>…</span>
          ) : (
            <Link
              key={p}
              href={hrefForPage(p as number)}
              onClick={go(p as number)}
              className={`w-9 h-9 rounded-full text-xs font-bold transition-colors flex items-center justify-center ${p === currentPage ? "" : "filter-pill"}`}
              style={p === currentPage ? {
                background: "var(--gradient-brand)",
                color: "var(--brand-ink)",
                fontFamily: "var(--font-display)",
                fontSize: "0.9rem",
              } : {}}
              aria-label={`Page ${p}`}
              aria-current={p === currentPage ? "page" : undefined}
            >
              {p}
            </Link>
          )
        )}
      </div>

      {atEnd ? (
        <button type="button" disabled className={edgeClass} aria-label="Next page">
          <span className="hidden xs:inline sm:inline">Next </span>
          <span aria-hidden="true">→</span>
        </button>
      ) : (
        <Link
          href={hrefForPage(currentPage + 1)}
          onClick={go(currentPage + 1)}
          className={armedClass}
          aria-label="Next page"
          rel="next"
        >
          <span className="hidden xs:inline sm:inline">Next </span>
          <span aria-hidden="true">→</span>
        </Link>
      )}
    </nav>
  );
}
