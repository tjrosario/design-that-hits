"use client";

import { useEffect, useState, useRef } from "react";
import type { Listing, ParsedQuery } from "@/types/etsy";
import { serializeQuery } from "@/lib/query";
import { ProductGrid } from "./ProductGrid";
import { Pagination } from "./Pagination";

const PAGE_SIZE = 24;

interface FetchResult {
  listings: Listing[];
  total: number;
  page: number;
  pageSize: number;
}

interface ProductGridContainerProps {
  query: ParsedQuery;
  isPending: boolean;
  onPage: (page: number) => void;
  onClear: () => void;
  /**
   * SSR-provided initial data from the server component.
   * Used on first render to avoid a client-side fetch waterfall,
   * which means product HTML is present in the initial server response
   * and is fully crawlable by search engines.
   */
  initialData: FetchResult | null;
}

export function ProductGridContainer({
  query,
  isPending,
  onPage,
  onClear,
  initialData,
}: ProductGridContainerProps) {
  // Seed state with SSR data — no loading flash on first paint
  const [data, setData] = useState<FetchResult | null>(initialData);
  const [loading, setLoading] = useState(initialData === null);
  const [error, setError] = useState<string | null>(null);

  // Track whether this is the very first render so we can skip
  // the redundant client fetch when initialData already matches the query.
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip fetching on first render if SSR data already covers this query.
    // After navigation (pill/filter/page change), always fetch.
    if (isFirstRender.current && initialData !== null) {
      isFirstRender.current = false;
      return;
    }
    isFirstRender.current = false;

    let cancelled = false;

    async function fetchListings() {
      setLoading(true);
      setError(null);

      const params = serializeQuery(query);
      const url = `/api/listings?${params.toString()}`;

      try {
        const res = await fetch(url);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const result: FetchResult = await res.json();
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
          setLoading(false);
        }
      }
    }

    fetchListings();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.q, query.sectionIds.join(","), query.sort, query.pill, query.page]);

  const isLoading = loading || isPending;
  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div>
      {!isLoading && data && (
        <p
          className="mb-6 text-xs"
          style={{ color: "var(--light)" }}
          aria-live="polite"
          aria-atomic="true"
        >
          {data.total === 0
            ? "No results found"
            : `${data.total} design${data.total !== 1 ? "s" : ""} found`}
        </p>
      )}

      <ProductGrid
        listings={data?.listings ?? []}
        loading={isLoading}
        error={error}
        onClear={onClear}
      />

      {!isLoading && !error && totalPages > 1 && (
        <Pagination currentPage={query.page} totalPages={totalPages} onPage={onPage} />
      )}
    </div>
  );
}
