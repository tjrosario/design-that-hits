"use client";

import type { Listing } from "@/types/etsy";
import { ProductCard } from "./ProductCard";
import { ProductCardSkeleton } from "./ProductCardSkeleton";

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
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}
        >
          Something went wrong
        </p>
        <p className="text-sm mb-6 max-w-sm" style={{ color: 'var(--text-muted)' }}>{error}</p>
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
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4"
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
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}
        >
          No Results
        </p>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          Try adjusting your search or filters.
        </p>
        <button onClick={onClear} className="filter-pill active">
          Clear all filters
        </button>
      </div>
    );
  }

  return (
    // Single column on phones: at two-up the cards are too small for the artwork to
    // read, which is the whole point of the product.
    <ul
      className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4"
      aria-label={`${listings.length} products`}
    >
      {listings.map((listing) => (
        // product-zone is the stationary hover target; the card inside it does the moving.
        <li key={listing.id} className="product-zone">
          <ProductCard listing={listing} />
        </li>
      ))}
    </ul>
  );
}
