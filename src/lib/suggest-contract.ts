/**
 * The shape the search box and the suggest endpoint agree on.
 *
 * Separate from `suggest.ts` because that module imports `filterListings`, which imports
 * the 1.3 MB bundled catalog. A client component importing a value from there pulls the
 * whole catalog into the shared client chunk on a webpack build; Turbopack, the default
 * here, tree-shakes it, so this is a landmine rather than a live regression. This file
 * imports nothing, so it cannot drag anything with it.
 */

export type Suggestion =
  | { kind: "collection"; label: string; href: string; count: number }
  | { kind: "product"; label: string; href: string }
  | { kind: "query"; label: string; href: string; count: number };

/** One character matches most of the catalog, which is noise rather than a suggestion. */
export const MIN_QUERY_CHARS = 2;

/** Past this nothing in the catalog can match, so it is only a way to waste work. */
export const MAX_QUERY_CHARS = 64;
