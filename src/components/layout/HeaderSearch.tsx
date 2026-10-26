"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MIN_QUERY_CHARS } from "@/lib/suggest";
import type { Suggestion } from "@/lib/suggest";

/**
 * Search from any page, with typeahead.
 *
 * The home page owns the actual search: it parses `q`, filters and renders results. This
 * is only a way in from the other 556 pages, so it hands off to `/?q=` rather than
 * duplicating that logic. `/?q=` is already `noindex, follow`, so no new indexable
 * surface comes with it.
 *
 * A real `<form action="/" method="get">`, so it submits without JavaScript. Suggestions
 * and the submit handler are the enhancement on top.
 *
 * Built to the ARIA combobox pattern: the input owns `aria-expanded` and
 * `aria-activedescendant`, and the highlighted option is referenced by id rather than
 * focused, so focus never leaves the input and typing is never interrupted.
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
  const listId = useId();
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);

  const query = value.trim();

  useEffect(() => {
    // Below the floor there is nothing to ask for. Stale suggestions are not cleared
    // here, because `visible` already gates on the query length; clearing would be a
    // setState in an effect body, which React 19's compiler rejects, and it would buy
    // nothing a derived check does not.
    if (query.length < MIN_QUERY_CHARS) return;

    // Abort rather than race: without this a slow early keystroke can resolve after a
    // fast later one and replace the newer list with a staler one.
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/suggest?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : { suggestions: [] }))
        .then((data) => {
          setSuggestions(data.suggestions ?? []);
          setActive(-1);
        })
        // An abort is the expected path on every keystroke, and a failed suggestion
        // lookup must never break the form underneath it.
        .catch(() => {});
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // A click outside is a dismissal. Pointerdown rather than click, so the list is gone
  // before the press lands on whatever is underneath it.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const visible = open && query.length >= MIN_QUERY_CHARS && suggestions.length > 0;

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
    onNavigate?.();
  };

  const submit = () => {
    if (active >= 0 && suggestions[active]) {
      go(suggestions[active].href);
      return;
    }
    go(query ? `/?q=${encodeURIComponent(query)}` : "/");
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      setActive(-1);
      return;
    }
    if (!visible) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      // Wraps through -1, which is "no option highlighted", so arrowing back past the
      // top returns the typed text rather than jumping to the bottom.
      const next = active + step;
      setActive(next < -1 ? suggestions.length - 1 : next >= suggestions.length ? -1 : next);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <form
        action="/"
        method="get"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
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
          onChange={(event) => {
            setValue(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search designs..."
          autoComplete="off"
          role="combobox"
          aria-expanded={visible}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
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

      <ul
        id={listId}
        role="listbox"
        aria-label="Search suggestions"
        hidden={!visible}
        className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl py-1 shadow-lg"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-soft)",
          minWidth: "17rem",
        }}
      >
        {suggestions.map((suggestion, index) => (
          <li
            key={`${suggestion.kind}-${suggestion.href}`}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === active}
            // Pointerdown, not click: a click fires after blur, by which time the list
            // has closed and the press lands on nothing.
            onPointerDown={(event) => {
              event.preventDefault();
              go(suggestion.href);
            }}
            onMouseEnter={() => setActive(index)}
            className="flex cursor-pointer items-baseline justify-between gap-3 px-4 py-2 text-sm"
            style={{
              background: index === active ? "var(--surface-2)" : "transparent",
              color: "var(--text)",
            }}
          >
            <span className="truncate">
              {suggestion.kind === "query" ? (
                <>
                  Search for <span style={{ color: "var(--brand)" }}>{suggestion.label}</span>
                </>
              ) : (
                suggestion.label
              )}
            </span>
            {suggestion.kind !== "product" && (
              <span className="flex-shrink-0 text-xs" style={{ color: "var(--text-muted)" }}>
                {suggestion.count}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
