import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product-detail";
import { ProductDetailSkeleton } from "@/components/catalog-skeletons";
import { getCachedProductPage } from "@/lib/catalog";

async function ProductPageContent({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; productId: string }>;
  searchParams?: Promise<{ recent?: string }>;
}) {
  const { slug, productId } = await params;
  const recent = (await searchParams)?.recent === "1";
  const data = await getCachedProductPage(slug, productId, recent);
  if (!data) notFound();

  return (
    <ProductDetail
      product={data.product}
      store={data.store}
      variants={data.variants}
      campaign={data.campaign}
      relatedProducts={data.relatedProducts}
      initialReviews={data.reviews}
    />
  );
}

export default function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; productId: string }>;
  searchParams?: Promise<{ recent?: string }>;
}) {
  return (
    <Suspense fallback={<ProductDetailSkeleton />}>
      <ProductPageContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
