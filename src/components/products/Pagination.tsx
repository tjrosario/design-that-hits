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
    // flex-wrap is load-bearing on small screens: a 16-page catalog renders ~9 number
    // buttons plus Prev/Next, which overflows a 360px viewport and causes the whole page
    // to scroll sideways. Wrapping keeps it contained at any width.
    // justify-end on wide screens, centred once it wraps on narrow ones.
    <nav
      className={`flex flex-wrap items-center justify-center sm:justify-end gap-x-2 gap-y-2 transition-opacity ${className}`}
      aria-label={label}
      aria-busy={busy || undefined}
      // Faded rather than hidden while a page loads: it stays in place, keeps its size
      // so nothing reflows, and still reads as "working on it".
      style={{ opacity: busy ? 0.55 : 1 }}
    >
      <button
        onClick={() => onPage(currentPage - 1)}
        disabled={currentPage === 1}
        className="filter-pill disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Previous page"
      >
        ← Prev
      </button>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
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
        className="filter-pill disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Next page"
      >
        Next →
      </button>
    </nav>
  );
}
