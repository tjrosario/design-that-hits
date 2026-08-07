"use client";

import type { ShopSection } from "@/types/etsy";

interface CategoryChipsProps {
  sections: ShopSection[];
  selectedIds: number[];
  onToggle: (id: number) => void;
}

export function CategoryChips({ sections, selectedIds, onToggle }: CategoryChipsProps) {
  if (sections.length === 0) return null;
  const selectedSet = new Set(selectedIds);
  const allSelected = selectedIds.length === 0;

  return (
    <div role="group" aria-label="Filter by category" className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
      <button
        onClick={() => selectedIds.forEach((id) => onToggle(id))}
        aria-pressed={allSelected}
        className={`filter-pill ${allSelected ? 'active' : ''}`}
      >
        All
      </button>
      {sections.map((section) => {
        const isSelected = selectedSet.has(section.id);
        return (
          <button
            key={section.id}
            onClick={() => onToggle(section.id)}
            aria-pressed={isSelected}
            /* `.filter-pill.active` already carries the brand gradient with
               --brand-ink on top, a pairing that is contrast-checked. The previous fixed
               pastel backgrounds put themed text on an unthemed colour and failed WCAG
               AA in dark mode. */
            className={`filter-pill flex items-center gap-1.5 whitespace-nowrap ${isSelected ? 'active' : ''}`}
          >
            {isSelected && (
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: 'currentColor', opacity: 0.65 }}
              />
            )}
            {section.title}
          </button>
        );
      })}
    </div>
  );
}
