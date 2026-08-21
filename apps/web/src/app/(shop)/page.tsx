import { Suspense } from "react";
import { HeroCarousel } from "@/components/hero-carousel";
import { HomeCatalog } from "@/components/home-catalog";
import { CatalogSectionSkeleton } from "@/components/catalog-skeletons";
import type { UaeEmirate } from "@/lib/types";

async function HomeCatalogFromParams({
  searchParams,
}: {
  searchParams: Promise<{ emirate?: string }>;
}) {
  const { emirate } = await searchParams;
  return <HomeCatalog initialEmirate={emirate as UaeEmirate | undefined} />;
}

export default function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ emirate?: string }>;
}) {
  return (
    <div>
      <HeroCarousel />
      <Suspense fallback={<CatalogSectionSkeleton />}>
        <HomeCatalogFromParams searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
