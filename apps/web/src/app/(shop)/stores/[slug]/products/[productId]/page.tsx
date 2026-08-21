import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product-detail";
import { ProductDetailSkeleton } from "@/components/catalog-skeletons";
import { getCachedProductPage } from "@/lib/catalog";

async function ProductPageContent({
  params,
}: {
  params: Promise<{ slug: string; productId: string }>;
}) {
  const { slug, productId } = await params;
  const data = await getCachedProductPage(slug, productId);
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
}: {
  params: Promise<{ slug: string; productId: string }>;
}) {
  return (
    <Suspense fallback={<ProductDetailSkeleton />}>
      <ProductPageContent params={params} />
    </Suspense>
  );
}
