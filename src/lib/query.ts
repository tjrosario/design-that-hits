/**
 * lib/query.ts
 *
 * Utilities for parsing and serializing URL search params.
 * All params are stored in a canonical, stable order to ensure consistent cache keys.
 *
 * Canonical param order: q, sections, sort, pill, page
 */

import type { ParsedQuery, SortOption, PillOption, SearchParams } from "@/types/etsy";

const VALID_SORTS: SortOption[] = ["newest", "price_asc", "price_desc"];
const VALID_PILLS: PillOption[] = ["new", "best", "trending"];

export function parseQuery(params: Record<string, string | string[] | undefined>): ParsedQuery {
  const q = typeof params.q === "string" ? params.q.trim() : "";

  const sectionsRaw = typeof params.sections === "string" ? params.sections : "";
  const sectionIds = sectionsRaw
    ? sectionsRaw
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n) && n > 0)
    : [];

  const sortRaw = typeof params.sort === "string" ? params.sort : "";
  const sort: SortOption = (VALID_SORTS as string[]).includes(sortRaw)
    ? (sortRaw as SortOption)
    : "newest";

  const pillRaw = typeof params.pill === "string" ? params.pill : "";
  const pill: PillOption = (VALID_PILLS as string[]).includes(pillRaw)
    ? (pillRaw as PillOption)
    : null;

  const pageRaw = typeof params.page === "string" ? parseInt(params.page, 10) : 1;
  const page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;

  return { q, sectionIds, sort, pill, page };
}

export function serializeQuery(parsed: Partial<ParsedQuery>): URLSearchParams {
  const params = new URLSearchParams();

  if (parsed.q) params.set("q", parsed.q);

  if (parsed.sectionIds && parsed.sectionIds.length > 0) {
    params.set("sections", [...parsed.sectionIds].sort((a, b) => a - b).join(","));
  }

  if (parsed.sort && parsed.sort !== "newest") params.set("sort", parsed.sort);

  if (parsed.pill) params.set("pill", parsed.pill);

  if (parsed.page && parsed.page > 1) params.set("page", String(parsed.page));

  return params;
}

export function buildQueryString(partial: Partial<ParsedQuery>): string {
  const params = serializeQuery(partial);
  const str = params.toString();
  return str ? `?${str}` : "";
}

/**
 * Sync rules:
 * - Pill "new"      => sort=newest, pill=new
 * - Pill "best"     => pill=best, clear price sorts (sort stays newest for fetch)
 * - Pill "trending" => pill=trending, clear price sorts
 * - Sort price_asc/desc => clear pill
 * - Sort newest     => keep current pill if it's "new", else clear pill
 */
export function applyPillChange(
  current: ParsedQuery,
  pill: PillOption
): Partial<ParsedQuery> {
  if (pill === "new") {
    return { ...current, pill: "new", sort: "newest", page: 1 };
  }
  if (pill === "best" || pill === "trending") {
    return { ...current, pill, sort: "newest", page: 1 };
  }
  // clearing pill
  return { ...current, pill: null, page: 1 };
}

export function applySortChange(
  current: ParsedQuery,
  sort: SortOption
): Partial<ParsedQuery> {
  if (sort === "price_asc" || sort === "price_desc") {
    return { ...current, sort, pill: null, page: 1 };
  }
  // newest: keep pill=new if set, otherwise clear pill
  if (sort === "newest") {
    const pill = current.pill === "new" ? "new" : null;
    return { ...current, sort, pill, page: 1 };
  }
  return { ...current, sort, page: 1 };
}

export function applySectionToggle(
  current: ParsedQuery,
  sectionId: number
): Partial<ParsedQuery> {
  const ids = new Set(current.sectionIds);
  if (ids.has(sectionId)) {
    ids.delete(sectionId);
  } else {
    ids.add(sectionId);
  }
  return { ...current, sectionIds: Array.from(ids), page: 1 };
}

export function clearFilters(current: ParsedQuery): Partial<ParsedQuery> {
  return { q: "", sectionIds: [], sort: "newest", pill: null, page: 1 };
}
