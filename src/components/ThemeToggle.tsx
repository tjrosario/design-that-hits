"use client";

import { useCallback } from "react";
import { THEME_STORAGE_KEY } from "./ThemeScript";

/**
 * Dark/light switch.
 *
 * The rendered markup is identical on the server and the client: both icons are always
 * present and CSS decides which is visible, keyed off the `data-theme` attribute that
 * ThemeScript set before paint. That is what keeps this hydration-safe — reading the
 * stored theme during render would make the server and client disagree on the first
 * pass and produce a mismatch.
 *
 * The label stays constant ("Switch theme") for the same reason: text that depends on
 * the current theme would differ between server and client render.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const toggle = useCallback(() => {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode or blocked storage: the theme still applies for this page view,
      // it just will not be remembered. Not worth surfacing to the visitor.
    }
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      className={`icon-btn ${className}`}
      aria-label="Switch between dark and light theme"
      title="Switch theme"
    >
      {/* Shown while dark is active: click to go light. */}
      <svg
        className="theme-icon-light h-[18px] w-[18px]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path
          strokeLinecap="round"
          d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        />
      </svg>

      {/* Shown while light is active: click to go dark. */}
      <svg
        className="theme-icon-dark h-[18px] w-[18px]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
        />
      </svg>
    </button>
  );
}
