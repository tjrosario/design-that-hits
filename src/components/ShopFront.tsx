"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { FacetGroups, ShopSection, Listing } from "@/types/etsy";
import type { FacetKey } from "@/lib/query";
import {
  parseQuery, serializeQuery,
  applyPillChange, applySortChange, applySectionToggle, applyFacetToggle,
  clearFilters, hasActiveFilters,
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
  facets: FacetGroups;
  initialParams: Record<string, string>;
  initialData: InitialData | null;
}

export function ShopFront({ sections, facets, initialParams, initialData }: ShopFrontProps) {
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
  const handleFacet   = useCallback(
    (key: FacetKey, optionId: string) => navigate(applyFacetToggle(parsed, key, optionId)),
    [navigate, parsed]
  );

  const hasFilters = hasActiveFilters(parsed);

  // Badge on the mobile Filters button. Counts every ticked box across all groups so it
  // reflects what the drawer actually holds, not just the categories.
  const activeFilterCount =
    parsed.sectionIds.length +
    parsed.types.length +
    parsed.themes.length +
    parsed.priceBands.length;

  // Heading splits into a plain lead and an accented word, matching the display style
  // used across the site ("Best <em>Sellers</em>").
  const [headingLead, headingAccent] =
    parsed.pill === "best"     ? ["Best", "Sellers"] :
    parsed.pill === "trending" ? ["Trending", "Now"] :
    parsed.pill === "new"      ? ["New", "Arrivals"] :
    ["Best Designs", "For You"];

  return (
    <div className="mx-auto max-w-screen-xl px-4 sm:px-5 py-10 sm:py-14">
      <div className="mb-8 sm:mb-10 text-center">
        <p className="eyebrow mb-3">The full collection</p>
        <h2 className="display-title" style={{ fontSize: "clamp(1.9rem, 4.5vw, 3rem)" }}>
          {headingLead} <span className="display-accent">{headingAccent}</span>
        </h2>
      </div>

      <div className="flex gap-6 xl:gap-8">
        {/* Sidebar - desktop */}
        {/*
          A <section> with a label, not an <aside>. <aside> is the complementary landmark,
          and a complementary landmark nested inside <main> is a WCAG structure failure
          (axe: landmark-complementary-is-top-level) — complementary content is meant to
          sit alongside main, not within it. These filters belong to the product list, so
          a labelled region is the correct role.
        */}
        <section
          aria-label="Filter products"
          className="hidden lg:block w-60 xl:w-64 flex-shrink-0"
        >
          <div className="sticky top-[84px] max-h-[calc(100vh-104px)] overflow-y-auto pr-1 scrollbar-hide">
            <FiltersSidebar
              sections={sections}
              selectedIds={parsed.sectionIds}
              onToggle={handleSection}
              onClear={handleClear}
              hasFilters={hasFilters}
              facets={facets}
              selectedTypes={parsed.types}
              selectedThemes={parsed.themes}
              selectedPriceBands={parsed.priceBands}
              onFacetToggle={handleFacet}
            />
          </div>
        </section>

        <div className="flex-1 min-w-0">
          {/* Controls */}
          <div className="flex flex-col gap-3 mb-6">
            {/* Wraps rather than overflowing: at 320px the Filters button, search field
                and sort select cannot sit on one line, and without wrapping the select
                pushed the whole page into horizontal scroll. */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => setDrawerOpen(true)}
                className="lg:hidden filter-pill flex items-center gap-2"
                aria-label="Open filters"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4h18M7 12h10M11 20h2" />
                </svg>
                Filters
                {activeFilterCount > 0 && (
                  <span
                    className="rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold"
                    style={{ background: 'var(--gradient-brand)', color: 'var(--brand-ink)' }}
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>
              {/* order-first pulls search above the Filters/Sort controls on phones,
                  where w-full gives it its own full-width line. From sm up it returns to
                  the same row and simply takes the leftover space. */}
              <div className="w-full order-first sm:order-none sm:w-auto sm:flex-1 sm:min-w-[150px]">
                <SearchBar value={parsed.q} onSearch={handleSearch} />
              </div>
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
        facets={facets}
        selectedTypes={parsed.types}
        selectedThemes={parsed.themes}
        selectedPriceBands={parsed.priceBands}
        onFacetToggle={handleFacet}
      />
    </div>
  );
}
