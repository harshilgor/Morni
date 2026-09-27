import { NextResponse } from "next/server";
import { getCachedFeaturedCategories, getCachedHomeCatalog } from "@/lib/catalog";
import { catalogShuffleSeed, merchandiseCatalog } from "@/lib/catalog-random";
import { createPublicClient } from "@/lib/supabase/public";

const BATCH_SIZE = 10;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug") ?? "all";
  const requestedOffset = Number(url.searchParams.get("offset") ?? 0);
  const offset = Number.isSafeInteger(requestedOffset) && requestedOffset >= 0 ? requestedOffset : 0;

  if (slug !== "all") {
    const featured = await getCachedFeaturedCategories();
    if (!featured.some((category) => category.slug === slug)) {
      return NextResponse.json({ error: "Unknown category" }, { status: 400 });
    }

    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("storefront_products")
      .select("id,title,price_aed,compare_at_price_aed,image_urls,category:categories!inner(slug),stores!inner(slug,is_active)")
      .eq("category.slug", slug)
      .eq("is_available", true)
      .eq("stores.is_active", true)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + BATCH_SIZE);

    if (error) {
      console.error("New and popular category query failed", error.message);
      return NextResponse.json({ error: "Unable to load products" }, { status: 500 });
    }

    // PostgREST infers embedded relations as arrays; each product has one store at runtime.
    const rows = (data ?? []) as unknown as Array<{
      id: string;
      title: string;
      price_aed: number;
      compare_at_price_aed: number | null;
      image_urls: string[] | null;
      stores: { slug: string };
    }>;
    const products = rows.slice(0, BATCH_SIZE).map((product) => ({
      id: product.id,
      title: product.title,
      price_aed: Number(product.price_aed),
      compare_at_price_aed: product.compare_at_price_aed,
      image_urls: product.image_urls ?? [],
      href: `/stores/${product.stores.slug}/products/${product.id}`,
    }));
    return NextResponse.json({ products, hasMore: rows.length > BATCH_SIZE });
  }

  const { products } = await getCachedHomeCatalog();
  const ordered = merchandiseCatalog(products, {
    seed: catalogShuffleSeed("home-popular"),
    getCategoryKey: (product) => product.category?.slug ?? "uncategorized",
    getStoreKey: (product) => product.stores?.slug ?? product.stores?.name ?? "",
  });
  const batch = ordered.slice(offset, offset + BATCH_SIZE).map((product) => ({
    id: product.id,
    title: product.title,
    price_aed: Number(product.price_aed),
    compare_at_price_aed: product.compare_at_price_aed,
    image_urls: product.image_urls,
    href: `/stores/${product.stores.slug}/products/${product.id}`,
  }));
  return NextResponse.json({ products: batch, hasMore: offset + batch.length < ordered.length });
}
