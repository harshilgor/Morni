import type { Product } from "@/lib/types";

export type TrendingCandidate = Pick<Product, "id" | "title" | "description" | "price_aed" | "compare_at_price_aed" | "image_urls" | "stock" | "is_available"> & {
  category?: { name?: string | null; slug?: string | null } | null;
  stores?: { slug: string };
};

export type TrendingResult = { categorySlug: string | null; categoryName: string | null; products: TrendingCandidate[] };

function hash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function rankTrendingForYou({ products, preferredCategorySlugs = [], userKey = "guest", date = new Date() }: {
  products: TrendingCandidate[];
  preferredCategorySlugs?: string[];
  userKey?: string;
  date?: Date;
}): TrendingResult {
  const eligible = products.filter((p) => p.is_available && p.stock > 0 && p.image_urls?.length);
  if (!eligible.length) return { categorySlug: null, categoryName: null, products: [] };
  const buckets = new Map<string, TrendingCandidate[]>();
  for (const product of eligible) {
    const slug = product.category?.slug ?? "discover";
    buckets.set(slug, [...(buckets.get(slug) ?? []), product]);
  }
  const preferred = preferredCategorySlugs.find((slug) => buckets.has(slug));
  const categories = [...buckets.keys()].sort((a, b) => {
    const ai = preferredCategorySlugs.indexOf(a), bi = preferredCategorySlugs.indexOf(b);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    return a.localeCompare(b);
  });
  const selected = preferred ?? categories[hash(`${userKey}:${date.toISOString().slice(0, 10)}`) % categories.length];
  const bucket = [...(buckets.get(selected) ?? eligible)].sort((a, b) => a.id.localeCompare(b.id));
  const offset = hash(`${userKey}:${date.toISOString().slice(0, 10)}:${selected}`) % bucket.length;
  return { categorySlug: selected === "discover" ? null : selected, categoryName: bucket[0]?.category?.name ?? null, products: bucket.slice(offset).concat(bucket.slice(0, offset)).slice(0, 10) };
}
