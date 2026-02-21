"use client";

import type { ShopSection } from "@/types/etsy";

const BADGE_COLORS = ['#E8C547','#7DC4A8','#E88C6A','#A8C4E8','#C8A8E8','#E8A8B8','#C4D4A0','#F0C090'];

interface FiltersSidebarProps {
  sections: ShopSection[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  onClear: () => void;
  hasFilters: boolean;
}

export function FiltersSidebar({ sections, selectedIds, onToggle, onClear, hasFilters }: FiltersSidebarProps) {
  const selectedSet = new Set(selectedIds);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p
          className="text-xs font-black uppercase tracking-widest"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)', fontSize: '0.85rem' }}
        >
          Filters
        </p>
        {hasFilters && (
          <button
            onClick={onClear}
            className="text-xs font-semibold underline underline-offset-2"
            style={{ color: 'var(--orange)' }}
          >
            Clear all
          </button>
        )}
      </div>

      {selectedIds.length > 0 && (
        <p className="mb-4 text-xs font-medium px-3 py-2 rounded-xl" style={{ backgroundColor: 'var(--cream-dark)', color: 'var(--ink-soft)' }}>
          {selectedIds.length === 1 ? '1 category selected' : `${selectedIds.length} categories selected`}
        </p>
      )}

      <fieldset>
        <legend className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-display)' }}>
          Categories
        </legend>
        <div className="space-y-1">
          {sections.map((section, i) => {
            const checked = selectedSet.has(section.id);
            const id = `sidebar-section-${section.id}`;
            return (
              <label
                key={section.id}
                htmlFor={id}
                className="flex items-center gap-3 cursor-pointer rounded-xl px-3 py-2 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: checked ? BADGE_COLORS[i % BADGE_COLORS.length] : 'transparent',
                  color: 'var(--ink)',
                }}
              >
                <input
                  id={id}
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(section.id)}
                  className="h-3.5 w-3.5 rounded cursor-pointer"
                  style={{ accentColor: 'var(--ink)' }}
                  aria-label={`Filter by ${section.title}`}
                />
                <span className="flex-1 truncate">{section.title}</span>
                {section.count > 0 && (
                  <span className="text-xs flex-shrink-0 font-medium" style={{ color: checked ? 'var(--ink-soft)' : 'var(--ink-muted)' }}>
                    {section.count}
                  </span>
                )}
              </label>
            );
          })}
          {sections.length === 0 && (
            <p className="text-xs px-2" style={{ color: 'var(--ink-muted)' }}>No categories available</p>
          )}
        </div>
      </fieldset>
    </div>
  );
}
