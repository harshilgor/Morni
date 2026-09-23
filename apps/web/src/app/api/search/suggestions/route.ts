import { NextRequest, NextResponse } from "next/server";
import { searchCatalog } from "@/lib/search/catalog-search";
import { normalizeSearchQuery } from "@/lib/search/query-understanding";

const PUBLIC_SUGGESTION_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
  "CDN-Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
  "Vercel-CDN-Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
};

export async function GET(request: NextRequest) {
  const query = normalizeSearchQuery(request.nextUrl.searchParams.get("q") ?? "");
  if (query.length < 2) return NextResponse.json({ intent: null, suggestions: [] }, { headers: PUBLIC_SUGGESTION_CACHE_HEADERS });

  const catalog = await searchCatalog(query, { limit: 6, semantic: false });
  const suggestions = [
    ...(catalog.intent.category
      ? [{ type: "query", id: `category-${catalog.intent.category}`, label: catalog.intent.category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), meta: "Category", href: `/search?q=${encodeURIComponent(query)}` }]
      : []),
    ...catalog.products.map((product) => ({
      type: "product",
      id: product.id,
      label: product.title,
      meta: `${product.stores.name} · AED ${Number(product.price_aed).toLocaleString("en-AE")}`,
      href: `/stores/${product.stores.slug}/products/${product.id}`,
    })),
  ];

  return NextResponse.json(
    { intent: catalog.intent, suggestions },
    { headers: PUBLIC_SUGGESTION_CACHE_HEADERS },
  );
}
