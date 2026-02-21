"use client";

import type { PillOption } from "@/types/etsy";

const PILLS: { value: PillOption; label: string }[] = [
  { value: "best",     label: "Best Sellers" },
  { value: "new",      label: "New Arrivals" },
  { value: "trending", label: "Trending"     },
];

interface SegmentedPillsProps {
  value: PillOption;
  onChange: (pill: PillOption) => void;
}

export function SegmentedPills({ value, onChange }: SegmentedPillsProps) {
  return (
    <div role="group" aria-label="Quick sort options" className="flex items-center gap-2 flex-wrap">
      {PILLS.map((pill) => (
        <button
          key={pill.value}
          onClick={() => onChange(pill.value)}
          aria-pressed={value === pill.value}
          className={`filter-pill ${value === pill.value ? 'active' : ''}`}
        >
          {pill.label}
        </button>
      ))}
    </div>
  );
}
