"use client";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPage: (page: number) => void;
  /** Spacing is left to the caller so the same control works above and below the grid. */
  className?: string;
  /** Distinguishes the two instances for assistive tech. */
  label?: string;
  /** A page change is in flight. The control stays visible and usable, just marked. */
  busy?: boolean;
}

export function Pagination({
  currentPage,
  totalPages,
  onPage,
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

  return (
    /*
      Two layouts, not one that wraps.

      A 16 page catalogue renders seven number buttons plus Prev and Next. Letting that
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
      <button
        onClick={() => onPage(currentPage - 1)}
        disabled={currentPage === 1}
        className="filter-pill disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
        aria-label="Previous page"
      >
        <span aria-hidden="true">←</span>
        <span className="hidden xs:inline sm:inline"> Prev</span>
      </button>

      {/*
        Compact position readout, phones only.

        Deliberately NOT aria-hidden. The numbered buttons that normally carry
        aria-current are `hidden` below sm, and display:none removes them from the
        accessibility tree — so on a phone this is the only thing telling a screen reader
        user where they are. The visible "8 / 16" is hidden from assistive tech and a
        spoken "Page 8 of 16" substituted, because a bare slash reads as noise.
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
            <span key={`e-${i}`} className="px-2 text-sm" style={{ color: 'var(--text-muted)' }}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p as number)}
              className={`w-9 h-9 rounded-full text-xs font-bold transition-colors flex items-center justify-center ${p === currentPage ? '' : 'filter-pill'}`}
              style={p === currentPage ? {
                background: 'var(--gradient-brand)',
                color: 'var(--brand-ink)',
                fontFamily: 'var(--font-display)',
                fontSize: '0.9rem',
              } : {}}
              aria-label={`Page ${p}`}
              aria-current={p === currentPage ? "page" : undefined}
            >
              {p}
            </button>
          )
        )}
      </div>
      <button
        onClick={() => onPage(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="filter-pill disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
        aria-label="Next page"
      >
        <span className="hidden xs:inline sm:inline">Next </span>
        <span aria-hidden="true">→</span>
      </button>
    </nav>
  );
}
