"use client";

import type { FacetOption } from "@/types/etsy";

interface FacetGroupProps {
  /** Group heading, e.g. "Product Type". */
  legend: string;
  options: FacetOption[];
  selected: string[];
  onToggle: (optionId: string) => void;
  /**
   * Options beyond this are hidden behind a native <details> toggle. Themes in
   * particular run long, and a filter column that scrolls for a screen and a half buries
   * everything below it.
   */
  collapseAfter?: number;
}

/**
 * One group of checkbox filters (product type, theme, price band).
 *
 * Selection is OR within the group and AND across groups, matching the filtering in
 * lib/catalog.ts. Counts come from the whole catalog rather than the current results, so
 * options never vanish mid-browse.
 */
export function FacetGroup({
  legend,
  options,
  selected,
  onToggle,
  collapseAfter = 6,
}: FacetGroupProps) {
  if (options.length === 0) return null;

  const selectedSet = new Set(selected);
  const primary = options.slice(0, collapseAfter);
  const overflow = options.slice(collapseAfter);
  // Keep a selected option visible rather than hidden inside the collapsed section.
  const overflowHasSelection = overflow.some((o) => selectedSet.has(o.id));

  const slug = legend.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const renderOption = (option: FacetOption) => {
    const checked = selectedSet.has(option.id);
    const inputId = `facet-${slug}-${option.id}`;
    return (
      <label
        key={option.id}
        htmlFor={inputId}
        className="flex items-center gap-3 cursor-pointer rounded-xl px-3 py-2 text-sm font-medium transition-colors"
        style={{
          backgroundColor: checked ? "var(--surface-2)" : "transparent",
          color: "var(--text)",
        }}
      >
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(option.id)}
          className="h-4 w-4 rounded cursor-pointer flex-shrink-0"
          style={{ accentColor: "var(--brand)" }}
        />
        <span className="flex-1 truncate">{option.label}</span>
        <span
          className="text-xs flex-shrink-0 font-medium"
          style={{ color: checked ? "var(--text-soft)" : "var(--text-muted)" }}
        >
          {option.count}
        </span>
      </label>
    );
  };

  return (
    <fieldset className="mt-6">
      <legend
        className="text-xs font-black uppercase tracking-wider mb-3"
        style={{ color: "var(--text-muted)", fontFamily: "var(--font-display)" }}
      >
        {legend}
      </legend>

      <div className="space-y-1">{primary.map(renderOption)}</div>

      {overflow.length > 0 && (
        // <details> gives a keyboard-accessible disclosure with no extra state to manage.
        <details className="mt-1" open={overflowHasSelection}>
          <summary
            className="cursor-pointer px-3 py-2 text-xs font-semibold select-none"
            style={{ color: "var(--brand)" }}
          >
            {`Show ${overflow.length} more`}
          </summary>
          <div className="space-y-1">{overflow.map(renderOption)}</div>
        </details>
      )}
    </fieldset>
  );
}
