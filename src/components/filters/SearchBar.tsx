"use client";

import { useEffect, useRef, useState } from "react";

interface SearchBarProps {
  value: string;
  onSearch: (q: string) => void;
  debounceMs?: number;
}

export function SearchBar({ value, onSearch, debounceMs = 400 }: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setLocalValue(value); }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocalValue(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onSearch(v), debounceMs);
  };

  const handleClear = () => {
    setLocalValue("");
    if (timerRef.current) clearTimeout(timerRef.current);
    onSearch("");
  };

  return (
    <div className="relative flex-1">
      <label htmlFor="search-input" className="sr-only">Search products</label>
      <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" style={{ color: 'var(--ink-muted)' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <input
        id="search-input"
        type="search"
        value={localValue}
        onChange={handleChange}
        placeholder="Search designs..."
        className="w-full rounded-full border-0 py-2.5 pl-10 pr-9 text-sm font-medium focus:outline-none focus:ring-2"
        style={{
          backgroundColor: 'var(--white)',
          color: 'var(--ink)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
        autoComplete="off"
        aria-label="Search products"
      />
      {localValue && (
        <button
          onClick={handleClear}
          className="absolute inset-y-0 right-3 flex items-center px-1"
          style={{ color: 'var(--ink-muted)' }}
          aria-label="Clear search"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
