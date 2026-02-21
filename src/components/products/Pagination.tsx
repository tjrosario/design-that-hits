"use client";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPage: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPage }: PaginationProps) {
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
    <nav className="mt-12 flex items-center justify-center gap-2" aria-label="Pagination">
      <button
        onClick={() => onPage(currentPage - 1)}
        disabled={currentPage === 1}
        className="filter-pill disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Previous page"
      >
        ← Prev
      </button>
      <div className="flex items-center gap-1.5">
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`e-${i}`} className="px-2 text-sm" style={{ color: 'var(--ink-muted)' }}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p as number)}
              className={`w-9 h-9 rounded-full text-xs font-black transition-colors ${p === currentPage ? '' : 'filter-pill'}`}
              style={p === currentPage ? {
                backgroundColor: 'var(--ink)',
                color: 'white',
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
