import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import {
  ProductBrowser,
  type BrowsableProduct,
} from "@/components/product-browser";
import {
  StoreProfileHeader,
  type StorePromo,
} from "@/components/store-profile-header";
import { ProductGridSkeleton } from "@/components/catalog-skeletons";
import { getCachedStoreBySlug, getCachedStoreCatalog } from "@/lib/catalog";
import { productMatchesBrowseCategory } from "@/lib/product-browse-category";
import { emirateLabel } from "@/lib/format";
import type { Product, Store } from "@/lib/types";

type StoreProduct = Product & {
  created_at?: string | null;
  categories: { name: string; slug: string } | null;
};

function toMinutes(value: string | null) {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function isStoreOpenNow(opensAt: string | null, closesAt: string | null) {
  const open = toMinutes(opensAt);
  const close = toMinutes(closesAt);
  if (open == null || close == null) return null;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= open && nowMinutes <= close;
}

function formatHours(opensAt: string | null, closesAt: string | null) {
  if (!opensAt || !closesAt) return "Hours not set";
  return `${opensAt.slice(0, 5)} – ${closesAt.slice(0, 5)}`;
}

async function LiveStoreHeader({
  store,
  hours,
  rating,
  reviewCount,
  promos,
}: {
  store: Store;
  hours: string;
  rating: number | null;
  reviewCount: number;
  promos: StorePromo[];
}) {
  await connection();
  const openNow = isStoreOpenNow(store.opens_at, store.closes_at);
  return (
    <StoreProfileHeader
      store={store}
      openNow={openNow}
      hours={hours}
      rating={rating}
      reviewCount={reviewCount}
      promos={promos}
    />
  );
}

async function StorePageContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await getCachedStoreBySlug(slug);
  if (!store) notFound();

  const { products, browseCategories, campaign, ratings } =
    await getCachedStoreCatalog(store.id, slug);
  const list = products as StoreProduct[];
  const catalog = browseCategories;
  const activeCampaign = campaign;
  const s = store;

  function categoryFor(product: StoreProduct) {
    if (product.categories) return product.categories;
    const hit = catalog.find((category) =>
      productMatchesBrowseCategory(category, product),
    );
    return hit ? { name: hit.name, slug: hit.slug } : null;
  }

  const hours = formatHours(s.opens_at, s.closes_at);

  const browsable: BrowsableProduct[] = list.map((product) => ({
    id: product.id,
    store_id: product.store_id,
    title: product.title,
    description: product.description,
    price_aed: Number(product.price_aed),
    compare_at_price_aed: product.compare_at_price_aed,
    image_urls: product.image_urls,
    sizes: product.sizes,
    stock: product.stock,
    created_at: product.created_at ?? null,
    category: categoryFor(product),
    stores: {
      slug: s.slug,
      name: s.name,
      emirate: s.emirate,
      area: s.area,
      delivery_eta_minutes: s.delivery_eta_minutes,
    },
  }));

  const ratingMap = new Map(Object.entries(ratings));
  let ratingSum = 0;
  let reviewCount = 0;
  for (const summary of ratingMap.values()) {
    ratingSum += summary.avgRating * summary.reviewCount;
    reviewCount += summary.reviewCount;
  }
  const storeRating =
    reviewCount > 0 ? Number((ratingSum / reviewCount).toFixed(1)) : null;

  const onSaleCount = browsable.filter(
    (product) =>
      product.compare_at_price_aed != null &&
      Number(product.compare_at_price_aed) > Number(product.price_aed),
  ).length;

  const promos: StorePromo[] = [];
  if (activeCampaign) {
    promos.push({
      id: activeCampaign.id,
      title: activeCampaign.title,
      description: activeCampaign.description,
      tone: "rose",
      cta: "View offer",
      href: "#shop",
    });
  }
  if (onSaleCount > 0) {
    promos.push({
      id: "on-sale",
      title: "Sale pieces",
      description: `${onSaleCount} item${onSaleCount === 1 ? "" : "s"} currently marked down`,
      tone: "mint",
      cta: "Shop sale",
      href: "#shop",
    });
  }

  return (
    <div className="min-h-screen bg-[#f8f7f4] pb-12">
      <div className="mx-auto hidden max-w-7xl px-4 pt-4 sm:px-6 lg:block">
        <nav className="flex items-center gap-1.5 text-xs text-muted">
          <Link href="/" className="hover:text-ink">
            Home
          </Link>
          <span aria-hidden>/</span>
          <Link href={`/?emirate=${s.emirate}`} className="hover:text-ink">
            {emirateLabel(s.emirate)} stores
          </Link>
          <span aria-hidden>/</span>
          <span className="text-ink">{s.name}</span>
        </nav>
      </div>

      <div className="lg:mt-3">
        <Suspense
          fallback={
            <StoreProfileHeader
              store={s}
              openNow={null}
              hours={hours}
              rating={storeRating}
              reviewCount={reviewCount}
              promos={promos}
            />
          }
        >
          <LiveStoreHeader
            store={s}
            hours={hours}
            rating={storeRating}
            reviewCount={reviewCount}
            promos={promos}
          />
        </Suspense>
      </div>

      <div id="shop" className="mx-auto mt-8 max-w-7xl scroll-mt-28 px-4 sm:px-6">
        {browsable.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
            <p className="text-muted">
              {s.name} has no products listed right now. Check back soon.
            </p>
            <Link
              href="/"
              className="mt-4 inline-block text-sm text-accent-deep underline"
            >
              Browse other stores
            </Link>
          </div>
        ) : (
          <ProductBrowser
            products={browsable}
            ratings={ratings}
            variant="store"
          />
        )}
      </div>
    </div>
  );
}

export default function StorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <ProductGridSkeleton />
        </div>
      }
    >
      <StorePageContent params={params} />
    </Suspense>
  );
}
