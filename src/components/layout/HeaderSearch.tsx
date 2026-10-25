"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Search from any page.
 *
 * The home page owns the actual search: it parses `q`, filters and renders results. This
 * is only a way in from the other 540 pages, which had none, so it hands off to `/?q=`
 * rather than duplicating that logic. `/?q=` is already `noindex, follow`, so no new
 * indexable surface comes with it.
 *
 * A real `<form action="/" method="get">`, so it submits without JavaScript. The submit
 * handler upgrades that to a client-side navigation when the bundle is there.
 */
export function HeaderSearch({
  className = "",
  inputId,
  autoFocus = false,
  onNavigate,
}: {
  className?: string;
  inputId: string;
  autoFocus?: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");

  return (
    <form
      action="/"
      method="get"
      role="search"
      className={`relative ${className}`}
      onSubmit={(event) => {
        event.preventDefault();
        const q = value.trim();
        router.push(q ? `/?q=${encodeURIComponent(q)}` : "/");
        onNavigate?.();
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        Search designs
      </label>
      <input
        id={inputId}
        name="q"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search designs..."
        autoComplete="off"
        // Set only in the mobile panel, which opens on a deliberate press, so moving
        // focus here is what the press was for.
        autoFocus={autoFocus}
        className="w-full rounded-full py-2 pl-9 pr-3 text-sm font-medium focus:outline-none"
        style={{
          backgroundColor: "var(--surface-2)",
          color: "var(--text)",
          border: "1px solid var(--border-soft)",
        }}
      />
      {/* Submit rather than a decorative glyph, so the form is operable by pointer
          alone with no keyboard and with no JavaScript. */}
      <button
        type="submit"
        className="absolute inset-y-0 left-0 flex items-center px-3"
        style={{ color: "var(--text-muted)" }}
        aria-label="Search"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>
    </form>
  );
}
