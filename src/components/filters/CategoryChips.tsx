"use client";

import type { ShopSection } from "@/types/etsy";

const BADGE_COLORS = ['#E8C547','#7DC4A8','#E88C6A','#A8C4E8','#C8A8E8','#E8A8B8','#C4D4A0','#F0C090'];

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
      {sections.map((section, i) => {
        const isSelected = selectedSet.has(section.id);
        return (
          <button
            key={section.id}
            onClick={() => onToggle(section.id)}
            aria-pressed={isSelected}
            className="filter-pill flex items-center gap-1.5 whitespace-nowrap"
            style={isSelected ? {
              background: BADGE_COLORS[i % BADGE_COLORS.length],
              borderColor: BADGE_COLORS[i % BADGE_COLORS.length],
              color: 'var(--ink)',
            } : {}}
          >
            {isSelected && (
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: 'var(--ink)', opacity: 0.5 }}
              />
            )}
            {section.title}
          </button>
        );
      })}
    </div>
  );
}
