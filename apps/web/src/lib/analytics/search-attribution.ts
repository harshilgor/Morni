const STORAGE_KEY = "morni-search-attribution-v1";
const ATTRIBUTION_WINDOW_MS = 30 * 60 * 1000;

type SearchAttributionState = {
  searchSessionId: string;
  query: string;
  startedAt: number;
  clickedProductIds: string[];
};

function newSearchSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `search_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
  }
  return `search_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function readState(): SearchAttributionState | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "null") as Partial<SearchAttributionState> | null;
    if (!parsed?.searchSessionId || !parsed.query || !parsed.startedAt) return null;
    if (Date.now() - parsed.startedAt > ATTRIBUTION_WINDOW_MS) return null;
    return {
      searchSessionId: parsed.searchSessionId,
      query: parsed.query,
      startedAt: parsed.startedAt,
      clickedProductIds: Array.isArray(parsed.clickedProductIds) ? parsed.clickedProductIds : [],
    };
  } catch {
    return null;
  }
}

function writeState(state: SearchAttributionState) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Analytics must never block shopping when storage is unavailable.
  }
}

export function beginSearchAttribution(query: string) {
  if (typeof window === "undefined") return null;
  const normalized = query.trim().slice(0, 120);
  if (!normalized) return null;
  const state: SearchAttributionState = {
    searchSessionId: newSearchSessionId(),
    query: normalized,
    startedAt: Date.now(),
    clickedProductIds: [],
  };
  writeState(state);
  return state;
}

export function markSearchProductClick(productId: string) {
  const state = readState();
  if (!state || !productId) return;
  if (!state.clickedProductIds.includes(productId)) state.clickedProductIds.push(productId);
  writeState(state);
}

export function getSearchAttribution(productId?: string | null) {
  const state = readState();
  if (!state) return null;
  // A product action is attributable only after this exact product was clicked
  // from the search results. Checkout-level events may omit productId and use
  // the clicked-product context carried by the cart.
  if (productId && !state.clickedProductIds.includes(productId)) return null;
  return {
    search_session_id: state.searchSessionId,
    search_query: state.query,
    search_product_ids: state.clickedProductIds.join(",").slice(0, 500) || null,
  };
}
