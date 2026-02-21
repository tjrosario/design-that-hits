"use client";

import type { Listing } from "@/types/etsy";
import { ProductCard } from "./ProductCard";
import { ProductCardSkeleton } from "./ProductCardSkeleton";

const BADGE_COLORS = [
  '#E8C547','#7DC4A8','#E88C6A','#A8C4E8',
  '#C8A8E8','#E8A8B8','#C4D4A0','#F0C090',
];

interface ProductGridProps {
  listings: Listing[];
  loading: boolean;
  error: string | null;
  onClear: () => void;
}

export function ProductGrid({ listings, loading, error, onClear }: ProductGridProps) {
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center" role="alert">
        <p
          className="text-4xl font-black uppercase mb-2"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}
        >
          Something went wrong
        </p>
        <p className="text-sm mb-6 max-w-sm" style={{ color: 'var(--ink-muted)' }}>{error}</p>
        <a
          href="https://designthathits.etsy.com"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-cta"
        >
          Visit Etsy directly
          <span className="arrow-circle">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" />
            </svg>
          </span>
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4"
        aria-busy="true"
        aria-label="Loading products"
      >
        {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p
          className="text-4xl font-black uppercase mb-2"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}
        >
          No Results
        </p>
        <p className="text-sm mb-6" style={{ color: 'var(--ink-muted)' }}>
          Try adjusting your search or filters.
        </p>
        <button onClick={onClear} className="filter-pill active">
          Clear all filters
        </button>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4" aria-label={`${listings.length} products`}>
      {listings.map((listing, i) => (
        <li key={listing.id}>
          <ProductCard listing={listing} badgeColor={BADGE_COLORS[i % BADGE_COLORS.length]} />
        </li>
      ))}
    </ul>
  );
}
