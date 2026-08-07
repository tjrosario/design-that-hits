// Etsy API v3 Types

export interface EtsyShop {
  shop_id: number;
  shop_name: string;
  title: string;
  listing_active_count: number;
  currency_code: string;
}

export interface EtsyShopSection {
  shop_section_id: number;
  title: string;
  rank: number;
  active_listing_count: number;
}

export interface EtsyMoney {
  amount: number;
  divisor: number;
  currency_code: string;
}

export interface EtsyListingImage {
  listing_image_id: number;
  listing_id: number;
  url_75x75: string;
  url_170x135: string;
  url_570xN: string;
  url_fullxfull: string;
  alt_text: string | null;
}

export interface EtsyListing {
  listing_id: number;
  title: string;
  description: string;
  url: string;
  price: EtsyMoney;
  quantity: number;
  num_favorers: number;
  views: number;
  created_timestamp: number;
  updated_timestamp: number;
  state: string;
  shop_section_id: number | null;
  tags: string[];
  images: EtsyListingImage[];
  // Computed for ranking
  score?: number;
}

export interface EtsyListingsResponse {
  count: number;
  results: EtsyListing[];
}

export interface EtsySectionsResponse {
  count: number;
  results: EtsyShopSection[];
}

// App-level types
export interface ShopSection {
  id: number;
  title: string;
  count: number;
}

export interface Listing {
  id: number;
  title: string;
  description: string;
  url: string;
  price: number;
  currency: string;
  numFavorers: number;
  views: number;
  createdAt: number;
  updatedAt: number;
  sectionId: number | null;
  tags: string[];
  image: {
    url: string;
    altText: string;
  } | null;
  score?: number;
  /** Derived in lib/catalog.ts from lib/facets.ts rules — not stored in catalog.json. */
  productType?: string | null;
  /** Derived, multi-valued. A listing can be both "Cats" and "Gothic & Dark". */
  themes?: string[];
}

/** A selectable option in one of the secondary filter groups. */
export interface FacetOption {
  id: string;
  label: string;
  count: number;
}

/** Everything the filter UI needs to render its secondary groups. */
export interface FacetGroups {
  productTypes: FacetOption[];
  themes: FacetOption[];
  priceBands: FacetOption[];
}

export type SortOption = 'newest' | 'price_asc' | 'price_desc';
export type PillOption = 'new' | 'best' | 'trending' | null;

export interface SearchParams {
  q?: string;
  sections?: string; // comma-separated section IDs
  types?: string;    // comma-separated product-type ids
  themes?: string;   // comma-separated theme ids
  price?: string;    // comma-separated price-band ids
  sort?: SortOption;
  pill?: PillOption;
  page?: string;
}

export interface ParsedQuery {
  q: string;
  sectionIds: number[];
  /** Secondary facets. Empty array means "no constraint", never "match nothing". */
  types: string[];
  themes: string[];
  priceBands: string[];
  sort: SortOption;
  pill: PillOption;
  page: number;
}
