import { NextResponse } from "next/server";
import { getCachedHomeCatalog } from "@/lib/catalog";
import { productMatchesBrowseCategory } from "@/lib/product-browse-category";
import { catalogShuffleSeed, diversifyByKey, shuffleCatalog } from "@/lib/catalog-random";

const BATCH_SIZE = 10;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug") ?? "all";
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
  const { products, featured } = await getCachedHomeCatalog();
  const category = featured.find((item) => item.slug === slug);
  const matching = slug === "all" || !category ? products : products.filter((product) => productMatchesBrowseCategory(category, product));
  const ordered = diversifyByKey(
    shuffleCatalog(matching, catalogShuffleSeed(`home-popular:${slug}`)),
    (product) => product.stores?.slug ?? product.stores?.name ?? "",
  );
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
