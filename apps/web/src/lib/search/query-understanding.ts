export type SearchIntent = {
  normalizedQuery: string;
  category: string | null;
  color: string | null;
  fabric: string | null;
  style: string | null;
  occasion: string | null;
  audience: string | null;
  priceIntent: "value" | "luxury" | null;
  confidence: "high" | "medium" | "low";
  tokens: string[];
};

type Facet = Exclude<keyof SearchIntent, "normalizedQuery" | "confidence" | "tokens">;

const ALIASES: Record<Facet, Record<string, string>> = {
  category: {
    "short kurtis": "short-kurtis",
    "short kurti": "short-kurtis",
    "crop tops": "tops",
    "crop top": "tops",
    "cropped tops": "tops",
    "cropped top": "tops",
    "co ords": "sets",
    "co ord": "sets",
    "co-ords": "sets",
    "co-ord": "sets",
    anarkalis: "anarkalis",
    anarkali: "anarkalis",
    lehengas: "lehengas",
    lehenga: "lehengas",
    sarees: "sarees",
    saree: "sarees",
    kurtis: "kurtis",
    kurti: "kurtis",
    tops: "tops",
    top: "tops",
    shararas: "shararas",
    sharara: "shararas",
    hampers: "gifting",
    hamper: "gifting",
    gifts: "gifting",
    gift: "gifting",
    sets: "sets",
    set: "sets",
  },
  color: Object.fromEntries(
    ["black", "white", "red", "blue", "green", "pink", "yellow", "purple", "beige", "gold", "silver", "navy", "maroon", "orange", "brown", "grey", "gray"].map((value) => [value, value === "gray" ? "grey" : value]),
  ),
  fabric: Object.fromEntries(
    ["cotton", "silk", "linen", "crepe", "synthetic", "georgette", "chiffon", "velvet", "rayon"].map((value) => [value, value]),
  ),
  style: {
    cropped: "crop",
    crop: "crop",
    sleeveless: "sleeveless",
    embroidered: "embroidered",
    embroidery: "embroidered",
    casual: "casual",
    elegant: "elegant",
    traditional: "traditional",
  },
  occasion: Object.fromEntries(
    ["party", "wedding", "brunch", "college", "festive", "office"].map((value) => [value, value]),
  ),
  audience: { women: "women", womens: "women", woman: "women", ladies: "women" },
  priceIntent: { cheap: "value", affordable: "value", budget: "value", luxury: "luxury", premium: "luxury" },
};

export function normalizeSearchQuery(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}
function findAlias(query: string, aliases: Record<string, string>) {
  const padded = ` ${query} `;
  return Object.entries(aliases)
    .sort(([a], [b]) => b.length - a.length)
    .find(([alias]) => padded.includes(` ${alias} `))?.[1] ?? null;
}

export function understandSearchQuery(value: string): SearchIntent {
  const normalizedQuery = normalizeSearchQuery(value);
  const category = findAlias(normalizedQuery, ALIASES.category);
  const color = findAlias(normalizedQuery, ALIASES.color);
  const fabric = findAlias(normalizedQuery, ALIASES.fabric);
  const style = findAlias(normalizedQuery, ALIASES.style);
  const occasion = findAlias(normalizedQuery, ALIASES.occasion);
  const audience = findAlias(normalizedQuery, ALIASES.audience);
  const price = findAlias(normalizedQuery, ALIASES.priceIntent);
  const understood = [category, color, fabric, style, occasion, audience, price].filter(Boolean).length;

  return {
    normalizedQuery,
    category,
    color,
    fabric,
    style,
    occasion,
    audience,
    priceIntent: price === "value" || price === "luxury" ? price : null,
    confidence: category ? "high" : understood > 0 ? "medium" : "low",
    tokens: normalizedQuery.split(" ").filter((token) => token.length >= 2),
  };
}

export function productSatisfiesCentralIntent(
  intent: SearchIntent,
  product: { title: string; category?: { slug?: string | null } | null },
) {
  if (!intent.category) return true;
  if (product.category?.slug === intent.category) return true;

  // A seller may have selected a neighboring category incorrectly. Allow an
  // explicit product-type title match, but never a description-only match.
  const title = normalizeSearchQuery(product.title);
  if (intent.category === "tops") return /\b(top|tops)\b/.test(title);
  if (intent.category === "kurtis") return /\b(kurti|kurtis)\b/.test(title);
  if (intent.category === "short-kurtis") return /\bshort kurti(s)?\b/.test(title);
  return title.includes(intent.category.replace(/-/g, " ").replace(/s$/, ""));
}
