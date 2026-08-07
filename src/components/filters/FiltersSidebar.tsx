"use client";

import type { FacetGroups, ShopSection } from "@/types/etsy";
import type { FacetKey } from "@/lib/query";
import { FacetGroup } from "./FacetGroup";

interface FiltersSidebarProps {
  sections: ShopSection[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  onClear: () => void;
  hasFilters: boolean;
  /** Secondary filter groups with counts. */
  facets: FacetGroups;
  selectedTypes: string[];
  selectedThemes: string[];
  selectedPriceBands: string[];
  onFacetToggle: (key: FacetKey, optionId: string) => void;
}

export function FiltersSidebar({
  sections,
  selectedIds,
  onToggle,
  onClear,
  hasFilters,
  facets,
  selectedTypes,
  selectedThemes,
  selectedPriceBands,
  onFacetToggle,
}: FiltersSidebarProps) {
  const selectedSet = new Set(selectedIds);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p
          className="text-xs font-black uppercase tracking-widest"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text)', fontSize: '0.85rem' }}
        >
          Filters
        </p>
        {hasFilters && (
          <button
            onClick={onClear}
            className="text-xs font-semibold underline underline-offset-2"
            style={{ color: 'var(--brand)' }}
          >
            Clear all
          </button>
        )}
      </div>

      {selectedIds.length > 0 && (
        <p className="mb-4 text-xs font-medium px-3 py-2 rounded-xl" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-soft)' }}>
          {selectedIds.length === 1 ? '1 category selected' : `${selectedIds.length} categories selected`}
        </p>
      )}

      {/* Categories come from real Etsy shop sections. Hidden entirely when the shop
          has none, rather than showing an empty group. */}
      <fieldset className={sections.length === 0 ? "hidden" : undefined}>
        <legend className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
          Categories
        </legend>
        <div className="space-y-1">
          {sections.map((section) => {
            const checked = selectedSet.has(section.id);
            const id = `sidebar-section-${section.id}`;
            return (
              <label
                key={section.id}
                htmlFor={id}
                className="flex items-center gap-3 cursor-pointer rounded-xl px-3 py-2 text-sm font-medium transition-colors"
                /* Selected state used to paint a fixed pastel (#E8C547 …) behind themed
                   text, which in dark mode meant near-white on pale yellow — the same
                   sub-2:1 contrast failure found on the About and Contact pages. axe did
                   not flag it here only because no Etsy sections are defined yet, so
                   these labels never render. Using the theme surface keeps foreground and
                   background from one palette. */
                style={{
                  backgroundColor: checked ? 'var(--surface-2)' : 'transparent',
                  color: 'var(--text)',
                }}
              >
                <input
                  id={id}
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(section.id)}
                  className="h-4 w-4 rounded cursor-pointer flex-shrink-0"
                  style={{ accentColor: 'var(--brand)' }}
                  aria-label={`Filter by ${section.title}`}
                />
                <span className="flex-1 truncate">{section.title}</span>
                {section.count > 0 && (
                  <span className="text-xs flex-shrink-0 font-medium" style={{ color: checked ? 'var(--text-soft)' : 'var(--text-muted)' }}>
                    {section.count}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </fieldset>

      <FacetGroup
        legend="Product Type"
        options={facets.productTypes}
        selected={selectedTypes}
        onToggle={(id) => onFacetToggle("types", id)}
      />

      <FacetGroup
        legend="Theme"
        options={facets.themes}
        selected={selectedThemes}
        onToggle={(id) => onFacetToggle("themes", id)}
        collapseAfter={6}
      />

      <FacetGroup
        legend="Price"
        options={facets.priceBands}
        selected={selectedPriceBands}
        onToggle={(id) => onFacetToggle("priceBands", id)}
        collapseAfter={99}
      />
    </div>
  );
}
