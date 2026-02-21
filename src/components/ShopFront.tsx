"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { ShopSection, Listing } from "@/types/etsy";
import {
  parseQuery, serializeQuery,
  applyPillChange, applySortChange, applySectionToggle, clearFilters,
} from "@/lib/query";
import { SearchBar } from "@/components/filters/SearchBar";
import { SegmentedPills } from "@/components/filters/SegmentedPills";
import { SortDropdown } from "@/components/filters/SortDropdown";
import { CategoryChips } from "@/components/filters/CategoryChips";
import { FiltersSidebar } from "@/components/filters/FiltersSidebar";
import { FiltersDrawer } from "@/components/filters/FiltersDrawer";
import { ProductGridContainer } from "@/components/products/ProductGridContainer";
import type { ParsedQuery, PillOption, SortOption } from "@/types/etsy";

interface InitialData {
  listings: Listing[];
  total: number;
  page: number;
  pageSize: number;
}

interface ShopFrontProps {
  sections: ShopSection[];
  initialParams: Record<string, string>;
  initialData: InitialData | null;
}

export function ShopFront({ sections, initialParams, initialData }: ShopFrontProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const parsed = parseQuery(initialParams);

  const navigate = useCallback(
    (newQuery: Partial<ParsedQuery>) => {
      const params = serializeQuery(newQuery as ParsedQuery);
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [router, pathname]
  );

  const handleSearch  = useCallback((q: string)         => navigate({ ...parsed, q, page: 1 }), [navigate, parsed]);
  const handlePill    = useCallback((pill: PillOption)   => navigate(applyPillChange(parsed, pill === parsed.pill ? null : pill)), [navigate, parsed]);
  const handleSort    = useCallback((sort: SortOption)   => navigate(applySortChange(parsed, sort)), [navigate, parsed]);
  const handleSection = useCallback((id: number)         => navigate(applySectionToggle(parsed, id)), [navigate, parsed]);
  const handleClear   = useCallback(()                   => navigate(clearFilters(parsed)), [navigate, parsed]);
  const handlePage    = useCallback((page: number)       => navigate({ ...parsed, page }), [navigate, parsed]);

  const hasFilters = parsed.q !== "" || parsed.sectionIds.length > 0;

  const sectionLabel =
    parsed.pill === "best"     ? "BEST SELLERS" :
    parsed.pill === "trending" ? "TRENDING NOW" :
    parsed.pill === "new"      ? "NEW ARRIVALS" :
    "MAKE EVERY DESIGN MEMORABLE";

  return (
    <div className="mx-auto max-w-screen-xl px-5 py-10">
      {/* Section heading — Prismora-style bold headline */}
      <div className="mb-8 text-center">
        <h2
          className="text-4xl md:text-5xl font-black uppercase"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}
        >
          {sectionLabel}
        </h2>
      </div>

      <div className="flex gap-8">
        {/* Sidebar - desktop */}
        <aside className="hidden lg:block w-56 flex-shrink-0">
          <div className="sticky top-[73px] max-h-[calc(100vh-90px)] overflow-y-auto pr-1">
            <FiltersSidebar
              sections={sections}
              selectedIds={parsed.sectionIds}
              onToggle={handleSection}
              onClear={handleClear}
              hasFilters={hasFilters}
            />
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          {/* Controls */}
          <div className="flex flex-col gap-3 mb-6">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setDrawerOpen(true)}
                className="lg:hidden filter-pill flex items-center gap-2"
                aria-label="Open filters"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4h18M7 12h10M11 20h2" />
                </svg>
                Filters
                {parsed.sectionIds.length > 0 && (
                  <span className="rounded-full w-4 h-4 flex items-center justify-center text-white text-[9px] font-black" style={{ backgroundColor: 'var(--orange)' }}>
                    {parsed.sectionIds.length}
                  </span>
                )}
              </button>
              <div className="flex-1"><SearchBar value={parsed.q} onSearch={handleSearch} /></div>
              <SortDropdown value={parsed.sort} onChange={handleSort} />
            </div>
            <SegmentedPills value={parsed.pill} onChange={handlePill} />
            <CategoryChips sections={sections} selectedIds={parsed.sectionIds} onToggle={handleSection} />
          </div>

          <ProductGridContainer
            query={parsed}
            isPending={isPending}
            onPage={handlePage}
            onClear={handleClear}
            initialData={initialData}
          />
        </div>
      </div>

      <FiltersDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sections={sections}
        selectedIds={parsed.sectionIds}
        onToggle={handleSection}
        onClear={handleClear}
        hasFilters={hasFilters}
      />
    </div>
  );
}
