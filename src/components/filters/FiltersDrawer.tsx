"use client";

import { useEffect, useRef } from "react";
import type { FacetGroups, ShopSection } from "@/types/etsy";
import type { FacetKey } from "@/lib/query";
import { FiltersSidebar } from "./FiltersSidebar";

interface FiltersDrawerProps {
  open: boolean;
  onClose: () => void;
  sections: ShopSection[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  onClear: () => void;
  hasFilters: boolean;
  facets: FacetGroups;
  selectedTypes: string[];
  selectedThemes: string[];
  selectedPriceBands: string[];
  onFacetToggle: (key: FacetKey, optionId: string) => void;
}

export function FiltersDrawer({
  open,
  onClose,
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
}: FiltersDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { if (open) closeButtonRef.current?.focus(); }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col shadow-2xl"
        style={{ backgroundColor: 'var(--bg)' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <p
            className="font-black uppercase text-lg"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}
          >
            Filters
          </p>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="rounded-full p-2 transition-colors"
            style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
            aria-label="Close filters"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <FiltersSidebar
            sections={sections}
            selectedIds={selectedIds}
            onToggle={onToggle}
            onClear={onClear}
            hasFilters={hasFilters}
            facets={facets}
            selectedTypes={selectedTypes}
            selectedThemes={selectedThemes}
            selectedPriceBands={selectedPriceBands}
            onFacetToggle={onFacetToggle}
          />
        </div>
        <div className="p-5 border-t" style={{ borderColor: 'var(--border)' }}>
          <button onClick={onClose} className="btn-cta w-full justify-center">
            View Results
            <span className="arrow-circle">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
              </svg>
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
