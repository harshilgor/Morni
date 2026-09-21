import { NextRequest, NextResponse } from "next/server";
import { searchCatalog, searchStores } from "@/lib/search/catalog-search";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ intent: null, suggestions: [] });

  const [catalog, stores] = await Promise.all([
    searchCatalog(query, { limit: 6, semantic: false }),
    searchStores(query, 3),
  ]);
  const suggestions = [
    ...(catalog.intent.category
      ? [{ type: "query", id: `category-${catalog.intent.category}`, label: catalog.intent.category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), meta: "Category", href: `/search?q=${encodeURIComponent(query)}` }]
      : []),
    ...stores.map((store) => ({ type: "store", id: store.id, label: store.name, meta: store.area, href: `/stores/${store.slug}` })),
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
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" } },
  );
}
