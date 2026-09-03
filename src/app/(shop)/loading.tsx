import { CatalogSectionSkeleton } from "@/components/catalog-skeletons";

export default function ShopLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 h-8 w-48 animate-pulse rounded bg-line/70" />
      <CatalogSectionSkeleton />
    </div>
  );
}
