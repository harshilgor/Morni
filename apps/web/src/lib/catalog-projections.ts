/**
 * Shared PostgREST projections for public catalogue surfaces.
 * Keep these explicit: adding a large product column should not silently bloat
 * every card, rail, search result, and RSC payload.
 */
export const PRODUCT_CARD_CATALOG_SELECT =
  "id, store_id, category_id, title, description, fabric, price_aed, compare_at_price_aed, image_urls, stock, is_available, created_at, category:categories(name, slug), stores!inner(slug, name, is_active)" as const;

// ProductBrowser derives facets from description, fabric, and sizes, so those
// fields are intentionally retained here even though a simple card omits them.
export const BROWSABLE_PRODUCT_CATALOG_SELECT =
  "id, store_id, category_id, title, description, fabric, price_aed, compare_at_price_aed, image_urls, sizes, stock, is_available, created_at, category:categories(name, slug), stores!inner(id, slug, name, is_active, emirate, area, delivery_eta_minutes)" as const;

export const STORE_BROWSER_PRODUCT_SELECT =
  "id, store_id, category_id, title, description, fabric, price_aed, compare_at_price_aed, image_urls, sizes, stock, is_available, created_at, categories(name, slug), stores!inner(is_active)" as const;
