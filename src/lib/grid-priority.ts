/**
 * lib/grid-priority.ts
 *
 * How eagerly each card in a product grid should fetch its photo.
 *
 * One place, because the rule is repeated across every grid and the cost of getting it
 * wrong is paid in LCP on the pages that rank.
 */

/**
 * Cards fetched up front. One, because in Next 16 `loading="eager"` also emits a
 * `<link rel="preload">`, so every eager card competes at top priority with the one that
 * decides LCP. On a phone the grid is a single column, which made that three wasted
 * full-width downloads ahead of the only card on screen.
 */
export const EAGER_CARDS = 1;

export interface GridImagePriority {
  /** Fetch immediately rather than lazily. Also preloads, in this version of Next. */
  eager: boolean;
  /** Fetch ahead of everything else. */
  lcp: boolean;
}

/**
 * The first card loads up front and is prioritized; everything else is lazy.
 *
 * The rest of the first row is lazy on purpose. A lazy image inside the viewport is still
 * fetched straight away, so a wide screen loses only the head start, while a phone stops
 * paying for three images it cannot see.
 */
export function gridImagePriority(index: number, eagerCount = EAGER_CARDS): GridImagePriority {
  return { eager: index < eagerCount, lcp: index === 0 && eagerCount > 0 };
}
