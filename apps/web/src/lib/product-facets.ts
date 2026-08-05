export type ColorFacet = {
  id: string;
  label: string;
  swatch: string;
  terms: string[];
};

export const COLOR_FACETS: ColorFacet[] = [
  { id: "black", label: "Black", swatch: "#1c1418", terms: ["black", "jet"] },
  {
    id: "white",
    label: "White",
    swatch: "#ffffff",
    terms: ["white", "off-white", "off white"],
  },
  {
    id: "ivory",
    label: "Ivory / Cream",
    swatch: "#f4ead9",
    terms: ["ivory", "cream", "champagne"],
  },
  { id: "beige", label: "Beige", swatch: "#e3d3bd", terms: ["beige", "nude", "sand"] },
  { id: "brown", label: "Brown", swatch: "#7a5230", terms: ["brown", "coffee", "tan"] },
  { id: "red", label: "Red", swatch: "#c0392b", terms: ["red", "scarlet", "crimson"] },
  {
    id: "maroon",
    label: "Maroon",
    swatch: "#7b2733",
    terms: ["maroon", "wine", "burgundy", "rust"],
  },
  { id: "pink", label: "Pink", swatch: "#e58fa8", terms: ["pink", "blush", "rose"] },
  { id: "peach", label: "Peach", swatch: "#f6c7a8", terms: ["peach", "coral"] },
  { id: "orange", label: "Orange", swatch: "#e07a2f", terms: ["orange"] },
  {
    id: "yellow",
    label: "Yellow",
    swatch: "#e8c33c",
    terms: ["yellow", "mustard", "lemon"],
  },
  { id: "gold", label: "Gold", swatch: "#c8a24a", terms: ["gold", "golden"] },
  {
    id: "green",
    label: "Green",
    swatch: "#3f7d55",
    terms: ["green", "emerald", "mint"],
  },
  { id: "olive", label: "Olive", swatch: "#6b7a3a", terms: ["olive", "sage"] },
  { id: "teal", label: "Teal", swatch: "#2f6f66", terms: ["teal", "turquoise"] },
  { id: "blue", label: "Blue", swatch: "#33578f", terms: ["blue", "denim", "sky"] },
  { id: "navy", label: "Navy", swatch: "#23335c", terms: ["navy", "indigo"] },
  {
    id: "purple",
    label: "Purple",
    swatch: "#6b4a8f",
    terms: ["purple", "violet", "plum"],
  },
  { id: "lavender", label: "Lavender", swatch: "#b9a6d6", terms: ["lavender", "lilac"] },
  {
    id: "grey",
    label: "Grey",
    swatch: "#8c8c8c",
    terms: ["grey", "gray", "charcoal"],
  },
  { id: "silver", label: "Silver", swatch: "#c0c4c8", terms: ["silver"] },
  {
    id: "multi",
    label: "Multicolour",
    swatch: "linear-gradient(135deg,#e58fa8,#e8c33c,#3f7d55)",
    terms: ["multicolour", "multicolor", "multi-colour", "printed multi"],
  },
];

export const FABRIC_FACETS: { id: string; label: string; terms: string[] }[] = [
  { id: "cotton", label: "Cotton", terms: ["cotton"] },
  { id: "silk", label: "Silk", terms: ["silk"] },
  { id: "georgette", label: "Georgette", terms: ["georgette"] },
  { id: "chiffon", label: "Chiffon", terms: ["chiffon"] },
  { id: "linen", label: "Linen", terms: ["linen"] },
  { id: "satin", label: "Satin", terms: ["satin"] },
  { id: "velvet", label: "Velvet", terms: ["velvet"] },
  { id: "organza", label: "Organza", terms: ["organza"] },
  { id: "rayon", label: "Rayon", terms: ["rayon", "viscose"] },
  { id: "crepe", label: "Crepe", terms: ["crepe"] },
  { id: "net", label: "Net", terms: [" net", "net "] },
  { id: "lace", label: "Lace", terms: ["lace"] },
  { id: "brocade", label: "Brocade", terms: ["brocade", "jacquard"] },
  { id: "denim", label: "Denim", terms: ["denim"] },
  { id: "knit", label: "Knit", terms: ["knit", "jersey"] },
];

export const FIT_FACETS: { id: string; label: string; terms: string[] }[] = [
  { id: "slim", label: "Slim fit", terms: ["slim"] },
  { id: "regular", label: "Regular fit", terms: ["regular fit", "regular-fit"] },
  { id: "relaxed", label: "Relaxed", terms: ["relaxed", "oversized", "loose"] },
  { id: "straight", label: "Straight", terms: ["straight"] },
  { id: "flared", label: "Flared", terms: ["flared", "flare", "fit & flare"] },
  { id: "a-line", label: "A-line", terms: ["a-line", "a line"] },
  { id: "bodycon", label: "Bodycon", terms: ["bodycon", "fitted"] },
  { id: "anarkali", label: "Anarkali", terms: ["anarkali"] },
  { id: "wide-leg", label: "Wide leg", terms: ["wide leg", "wide-leg", "palazzo"] },
];

export const PRICE_BUCKETS: {
  id: string;
  label: string;
  min: number;
  max: number | null;
}[] = [
  { id: "under-99", label: "Under AED 99", min: 0, max: 99 },
  { id: "99-199", label: "AED 99 – 199", min: 99, max: 199 },
  { id: "200-399", label: "AED 200 – 399", min: 200, max: 399 },
  { id: "400-799", label: "AED 400 – 799", min: 400, max: 799 },
  { id: "800-plus", label: "AED 800 & above", min: 800, max: null },
];

export const DELIVERY_BUCKETS: {
  id: string;
  label: string;
  max: number | null;
}[] = [
  { id: "under-60", label: "Within 1 hour", max: 60 },
  { id: "60-120", label: "1 – 2 hours", max: 120 },
  { id: "120-plus", label: "2 hours or more", max: null },
];

const SIZE_ORDER = [
  "xxs",
  "xs",
  "s",
  "m",
  "l",
  "xl",
  "xxl",
  "xxxl",
  "free size",
  "one size",
];

export function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    const aNumeric = !Number.isNaN(na);
    const bNumeric = !Number.isNaN(nb);
    if (aNumeric && bNumeric) return na - nb;
    if (aNumeric) return 1;
    if (bNumeric) return -1;
    const ia = SIZE_ORDER.indexOf(a.toLowerCase());
    const ib = SIZE_ORDER.indexOf(b.toLowerCase());
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

function matchTerms(haystack: string, terms: string[]) {
  return terms.some((term) => haystack.includes(term));
}

export function deriveColors(text: string): string[] {
  const haystack = ` ${text.toLowerCase()} `;
  return COLOR_FACETS.filter((c) => matchTerms(haystack, c.terms)).map((c) => c.id);
}

export function deriveFabrics(text: string): string[] {
  const haystack = ` ${text.toLowerCase()} `;
  return FABRIC_FACETS.filter((f) => matchTerms(haystack, f.terms)).map((f) => f.id);
}

export function deriveFits(text: string): string[] {
  const haystack = ` ${text.toLowerCase()} `;
  return FIT_FACETS.filter((f) => matchTerms(haystack, f.terms)).map((f) => f.id);
}

export function priceBucketId(price: number): string | null {
  const bucket = PRICE_BUCKETS.find(
    (b) => price >= b.min && (b.max == null || price <= b.max),
  );
  return bucket?.id ?? null;
}

export function deliveryBucketId(etaMinutes: number): string {
  if (etaMinutes <= 60) return "under-60";
  if (etaMinutes <= 120) return "60-120";
  return "120-plus";
}
