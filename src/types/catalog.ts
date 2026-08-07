/**
 * types/catalog.ts
 *
 * Shape of src/data/catalog.json — the local product catalog that replaced the
 * Etsy API after our API application was denied.
 *
 * The file is meant to be hand-editable, so almost every field is optional and the
 * loader in lib/catalog.ts fills in sensible defaults. Only `title` and `url` are
 * genuinely required: the URL is what links the card to Etsy and what the listing ID
 * is derived from.
 */

export interface CatalogImage {
  url: string;
  altText?: string;
}

export interface CatalogListing {
  /**
   * Etsy listing ID. Derived from `url` when present. Listings imported from Etsy's
   * CSV export have neither (the export omits both), so lib/catalog.ts synthesises a
   * stable ID from the title instead. See SYNTHETIC_ID_BASE there.
   */
  id?: number;
  title: string;
  /**
   * Canonical Etsy listing URL.
   *
   * Optional because Etsy's CSV export contains no listing URLs or IDs, and that export
   * is the only complete source of the catalog. Entries without one fall back to a
   * shop-scoped Etsy search for the title, which still lands the buyer on the product.
   * The RSS feed upgrades them to real listing URLs as it surfaces them.
   */
  url?: string;
  description?: string;
  price?: number;
  currency?: string;
  /** Unix seconds. Defaults to now, which sorts the entry as newest. */
  createdAt?: number;
  updatedAt?: number;
  /** Must match an id in `sections` for category filtering to work. */
  sectionId?: number | null;
  tags?: string[];
  /**
   * Etsy shows a public favourite count on each listing. Filling these in by hand is
   * what makes the "Best Sellers" and "Trending" pills meaningful — without them
   * every listing ties at zero and those views fall back to newest-first.
   */
  favorites?: number;
  views?: number;
  image?: CatalogImage | null;
  /** From the CSV export. Not displayed; kept so re-imports can match reliably. */
  sku?: string;
}

export interface CatalogSection {
  id: number;
  title: string;
  /** Recomputed from the listings by sync-catalog; not authoritative when hand-edited. */
  count?: number;
}

export interface CatalogFile {
  shop?: {
    name?: string;
    etsyShopName?: string;
    url?: string;
  };
  /** ISO timestamp of the last sync-catalog run. */
  syncedAt?: string | null;
  sections?: CatalogSection[];
  listings?: CatalogListing[];
}
