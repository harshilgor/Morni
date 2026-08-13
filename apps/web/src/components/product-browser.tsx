"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProductCard } from "@/components/cards";
import { emirateLabel } from "@/lib/format";
import { profileFromSwipes, type TasteProfile, type TasteSwipe } from "@/lib/for-you";
import { readStoredForYouTaste } from "@/lib/for-you-storage";
import type { ProductRatingSummary } from "@/lib/product-ratings";
import {
  COLOR_FACETS,
  FABRIC_FACETS,
  FIT_FACETS,
  PRICE_BUCKETS,
  deriveColors,
  deriveFabrics,
  deriveFits,
  priceBucketId,
  sortSizes,
} from "@/lib/product-facets";
import type { UaeEmirate } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

export type BrowsableProduct = {
  id: string;
  title: string;
  description: string | null;
  price_aed: number;
  compare_at_price_aed: number | null;
  image_urls: string[] | null;
  sizes: string[] | null;
  stock: number;
  created_at?: string | null;
  category?: { name: string; slug: string } | null;
  stores: {
    slug: string;
    name: string;
    emirate: UaeEmirate;
    area: string;
    delivery_eta_minutes: number;
  };
};

type Annotated = BrowsableProduct & {
  colors: string[];
  fabrics: string[];
  fits: string[];
  priceBucket: string | null;
  rating: number;
  reviews: number;
  onSale: boolean;
  inStock: boolean;
};

type ListDimension =
  | "sizes"
  | "colors"
  | "fabrics"
  | "fits"
  | "emirates"
  | "stores"
  | "category"
  | "price";

type Filters = Record<ListDimension, string[]> & {
  onSale: boolean;
  inStock: boolean;
};

const EMPTY_FILTERS: Filters = {
  sizes: [],
  colors: [],
  fabrics: [],
  fits: [],
  emirates: [],
  stores: [],
  category: [],
  price: [],
  onSale: false,
  inStock: false,
};

const SORTS = [
  { id: "recommended", label: "Recommended", mobileLabel: "Top picks" },
  { id: "new", label: "New in", mobileLabel: "New in" },
  { id: "price-asc", label: "Price: low to high", mobileLabel: "Price: low" },
  { id: "price-desc", label: "Price: high to low", mobileLabel: "Price: high" },
  { id: "rated", label: "Best rated", mobileLabel: "Top rated" },
];

const PAGE_SIZE = 24;

function annotate(
  product: BrowsableProduct,
  ratings: Record<string, ProductRatingSummary>,
): Annotated {
  const text = `${product.title} ${product.description ?? ""}`;
  const ratingSummary = ratings[product.id];
  return {
    ...product,
    colors: deriveColors(text),
    fabrics: deriveFabrics(text),
    fits: deriveFits(text),
    priceBucket: priceBucketId(Number(product.price_aed)),
    rating: ratingSummary?.avgRating ?? 0,
    reviews: ratingSummary?.reviewCount ?? 0,
    onSale:
      product.compare_at_price_aed != null &&
      Number(product.compare_at_price_aed) > Number(product.price_aed),
    inStock: product.stock > 0,
  };
}

function personalScore(product: Annotated, profile: TasteProfile, activeSlug?: string) {
  const text = `${product.title} ${product.description ?? ""}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ");
  let score = activeSlug ? (profile.categoryScores[activeSlug] ?? 0) * 4 : 0;
  for (const word of text) score += profile.tagScores[word] ?? 0;
  for (const color of product.colors) score += profile.tagScores[color] ?? 0;
  for (const fabric of product.fabrics) score += profile.tagScores[fabric] ?? 0;

  if (profile.likedPriceCount > 0) {
    const average = profile.likedPriceSum / profile.likedPriceCount;
    const difference = Math.abs(Number(product.price_aed) - average) / Math.max(average, 1);
    score += Math.max(0, 2 - difference * 2);
  }
  return score;
}

function matchesDimension(
  product: Annotated,
  dimension: ListDimension,
  selected: string[] | undefined,
) {
  if (!selected || selected.length === 0) return true;
  switch (dimension) {
    case "sizes":
      return (product.sizes ?? []).some((s) => selected.includes(s));
    case "colors":
      return product.colors.some((c) => selected.includes(c));
    case "fabrics":
      return product.fabrics.some((f) => selected.includes(f));
    case "fits":
      return product.fits.some((f) => selected.includes(f));
    case "emirates":
      return selected.includes(product.stores.emirate);
    case "stores":
      return selected.includes(product.stores.slug);
    case "category":
      return product.category != null && selected.includes(product.category.slug);
    case "price":
      return product.priceBucket != null && selected.includes(product.priceBucket);
  }
}

function matches(product: Annotated, filters: Filters, except?: ListDimension) {
  const dimensions: ListDimension[] = [
    "sizes",
    "colors",
    "fabrics",
    "fits",
    "emirates",
    "stores",
    "category",
    "price",
  ];
  for (const dimension of dimensions) {
    if (dimension === except) continue;
    if (!matchesDimension(product, dimension, filters[dimension])) return false;
  }
  if (filters.onSale && !product.onSale) return false;
  if (filters.inStock && !product.inStock) return false;
  return true;
}

function countFor(
  products: Annotated[],
  filters: Filters,
  dimension: ListDimension,
  value: string,
) {
  return products.filter(
    (p) =>
      matches(p, filters, dimension) && matchesDimension(p, dimension, [value]),
  ).length;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-3 w-3">
      <path
        d="m3.5 8.5 3 3 6-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FilterSection({
  title,
  children,
  defaultOpen = false,
  activeCount = 0,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  activeCount?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line/70 py-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={open}
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink">
          {title}
          {activeCount > 0 ? (
            <span className="ml-2 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent-deep">
              {activeCount}
            </span>
          ) : null}
        </span>
        <span className="text-lg leading-none text-muted">{open ? "−" : "+"}</span>
      </button>
      {open ? (
        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">{children}</div>
      ) : null}
    </div>
  );
}

function OptionRow({
  label,
  count,
  checked,
  onToggle,
  swatch,
}: {
  label: string;
  count: number;
  checked: boolean;
  onToggle: () => void;
  swatch?: string;
}) {
  const disabled = count === 0 && !checked;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`flex w-full items-center gap-2.5 text-left text-sm transition ${
        disabled ? "cursor-not-allowed opacity-40" : "hover:text-accent-deep"
      }`}
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-white transition ${
          checked ? "border-ink bg-ink" : "border-line bg-white"
        }`}
      >
        {checked ? <CheckIcon /> : null}
      </span>
      {swatch ? (
        <span
          className="h-3.5 w-3.5 shrink-0 rounded-full border border-line"
          style={{ background: swatch }}
        />
      ) : null}
      <span className="flex-1 truncate text-ink/90">{label}</span>
      <span className="shrink-0 text-xs text-muted">{count}</span>
    </button>
  );
}

export function ProductBrowser({
  products,
  categories,
  activeSlug,
  ratings = {},
}: {
  products: BrowsableProduct[];
  categories?: { name: string; slug: string }[];
  activeSlug?: string;
  ratings?: Record<string, ProductRatingSummary>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState("recommended");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tasteProfile, setTasteProfile] = useState<TasteProfile | null>(null);
  const [dismissedProductIds, setDismissedProductIds] = useState<string[]>([]);
  const [forYouActive, setForYouActive] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadTaste() {
      const stored = readStoredForYouTaste();
      const { data: auth } = await supabase.auth.getUser();
      if (!mounted) return;

      if (!auth.user) {
        setTasteProfile(stored.profile);
        setDismissedProductIds(stored.dismissedProductIds);
        return;
      }

      const [{ data: swipes }, { data: feedback }] = await Promise.all([
        supabase
          .from("taste_swipes")
          .select("product_id, category_slug, decision, tags, price_aed")
          .eq("shopper_id", auth.user.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("product_feedback")
          .select("product_id")
          .eq("shopper_id", auth.user.id)
          .eq("feedback_type", "not_interested"),
      ]);
      if (!mounted) return;

      const remoteSwipes: TasteSwipe[] = (swipes ?? []).map((swipe) => ({
        productId: swipe.product_id,
        categorySlug: swipe.category_slug,
        decision: swipe.decision as TasteSwipe["decision"],
        tags: swipe.tags ?? [],
        priceAed: Number(swipe.price_aed ?? 0),
      }));
      setTasteProfile(remoteSwipes.length ? profileFromSwipes(remoteSwipes) : stored.profile);
      setDismissedProductIds([
        ...new Set([...(feedback ?? []).map((item) => item.product_id), ...stored.dismissedProductIds]),
      ]);
    }

    void loadTaste();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  const annotated = useMemo(
    () => products.map((product) => annotate(product, ratings)),
    [products, ratings],
  );

  const sizeOptions = useMemo(
    () =>
      sortSizes([
        ...new Set(annotated.flatMap((p) => p.sizes ?? []).filter(Boolean)),
      ]),
    [annotated],
  );
  const colorOptions = useMemo(() => {
    const present = new Set(annotated.flatMap((p) => p.colors));
    return COLOR_FACETS.filter((c) => present.has(c.id));
  }, [annotated]);
  const fabricOptions = useMemo(() => {
    const present = new Set(annotated.flatMap((p) => p.fabrics));
    return FABRIC_FACETS.filter((f) => present.has(f.id));
  }, [annotated]);
  const fitOptions = useMemo(() => {
    const present = new Set(annotated.flatMap((p) => p.fits));
    return FIT_FACETS.filter((f) => present.has(f.id));
  }, [annotated]);
  const emirateOptions = useMemo(
    () => [...new Set(annotated.map((p) => p.stores.emirate))],
    [annotated],
  );
  const storeOptions = useMemo(() => {
    const map = new Map<string, string>();
    annotated.forEach((p) => map.set(p.stores.slug, p.stores.name));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [annotated]);
  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    annotated.forEach((p) => {
      if (p.category) map.set(p.category.slug, p.category.name);
    });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [annotated]);
  const priceOptions = useMemo(() => {
    const present = new Set(
      annotated.map((p) => p.priceBucket).filter(Boolean) as string[],
    );
    return PRICE_BUCKETS.filter((b) => present.has(b.id));
  }, [annotated]);

  const filtered = useMemo(
    () =>
      annotated.filter(
        (product) =>
          matches(product, filters) &&
          (!forYouActive || !dismissedProductIds.includes(product.id)),
      ),
    [annotated, dismissedProductIds, filters, forYouActive],
  );

  const sorted = useMemo(() => {
    const list = [...filtered];
    if (forYouActive && tasteProfile) {
      return list.sort(
        (a, b) => personalScore(b, tasteProfile, activeSlug) - personalScore(a, tasteProfile, activeSlug),
      );
    }
    switch (sort) {
      case "price-asc":
        return list.sort((a, b) => Number(a.price_aed) - Number(b.price_aed));
      case "price-desc":
        return list.sort((a, b) => Number(b.price_aed) - Number(a.price_aed));
      case "rated":
        return list.sort(
          (a, b) => b.rating - a.rating || b.reviews - a.reviews,
        );
      case "new":
        return list.sort(
          (a, b) =>
            new Date(b.created_at ?? 0).getTime() -
            new Date(a.created_at ?? 0).getTime(),
        );
      default:
        return list;
    }
  }, [activeSlug, filtered, forYouActive, sort, tasteProfile]);

  const categoryIsPreferred = Boolean(
    activeSlug && tasteProfile && (tasteProfile.categoryScores[activeSlug] ?? 0) > 0,
  );
  const currentSort = SORTS.find((option) => option.id === sort) ?? SORTS[0];
  const activeCount =
    (Object.keys(EMPTY_FILTERS) as (keyof Filters)[]).reduce((sum, key) => {
      const value = filters[key];
      if (Array.isArray(value)) return sum + value.length;
      return sum + (value ? 1 : 0);
    }, 0);

  function toggle(dimension: ListDimension, value: string) {
    setVisible(PAGE_SIZE);
    setFilters((prev) => {
      const current = prev[dimension];
      return {
        ...prev,
        [dimension]: current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value],
      };
    });
  }

  function toggleFlag(key: "onSale" | "inStock") {
    setVisible(PAGE_SIZE);
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function clearAll() {
    setVisible(PAGE_SIZE);
    setFilters(EMPTY_FILTERS);
  }

  function toggleForYou() {
    setForYouActive((active) => !active);
    setVisible(PAGE_SIZE);
  }

  const activePills: { label: string; onRemove: () => void }[] = [
    ...filters.price.map((id) => ({
      label: PRICE_BUCKETS.find((b) => b.id === id)?.label ?? id,
      onRemove: () => toggle("price", id),
    })),
    ...filters.sizes.map((id) => ({
      label: `Size ${id}`,
      onRemove: () => toggle("sizes", id),
    })),
    ...filters.colors.map((id) => ({
      label: COLOR_FACETS.find((c) => c.id === id)?.label ?? id,
      onRemove: () => toggle("colors", id),
    })),
    ...filters.fabrics.map((id) => ({
      label: FABRIC_FACETS.find((f) => f.id === id)?.label ?? id,
      onRemove: () => toggle("fabrics", id),
    })),
    ...filters.fits.map((id) => ({
      label: FIT_FACETS.find((f) => f.id === id)?.label ?? id,
      onRemove: () => toggle("fits", id),
    })),
    ...filters.emirates.map((id) => ({
      label: emirateLabel(id as UaeEmirate),
      onRemove: () => toggle("emirates", id),
    })),
    ...filters.stores.map((id) => ({
      label: storeOptions.find(([slug]) => slug === id)?.[1] ?? id,
      onRemove: () => toggle("stores", id),
    })),
    ...filters.category.map((id) => ({
      label: categoryOptions.find(([slug]) => slug === id)?.[1] ?? id,
      onRemove: () => toggle("category", id),
    })),
    ...(filters.onSale
      ? [{ label: "On sale", onRemove: () => toggleFlag("onSale") }]
      : []),
    ...(filters.inStock
      ? [{ label: "In stock", onRemove: () => toggleFlag("inStock") }]
      : []),
  ];

  const panel = (
    <div>
      {categoryIsPreferred ? (
        <div className="border-b border-line/70 pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-deep">
            Your taste
          </p>
          <p className="mt-1 text-sm text-muted">
            {forYouActive
              ? "Showing the pieces that best match your choices."
              : "See this category in the order that suits you."}
          </p>
          <button
            type="button"
            onClick={toggleForYou}
            className={`mt-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              forYouActive
                ? "bg-ink text-white hover:bg-accent-deep"
                : "border border-line bg-surface text-ink hover:border-ink/40"
            }`}
            aria-pressed={forYouActive}
          >
            {forYouActive ? "Showing for you" : "For you"}
          </button>
        </div>
      ) : null}

      {categoryOptions.length > 1 ? (
        <FilterSection
          title="Category"
          defaultOpen
          activeCount={filters.category.length}
        >
          {categoryOptions.map(([slug, name]) => (
            <OptionRow
              key={slug}
              label={name}
              count={countFor(annotated, filters, "category", slug)}
              checked={filters.category.includes(slug)}
              onToggle={() => toggle("category", slug)}
            />
          ))}
        </FilterSection>
      ) : null}

      {sizeOptions.length > 0 ? (
        <FilterSection title="Size" defaultOpen activeCount={filters.sizes.length}>
          <div className="flex flex-wrap gap-2">
            {sizeOptions.map((size) => {
              const count = countFor(annotated, filters, "sizes", size);
              const checked = filters.sizes.includes(size);
              const disabled = count === 0 && !checked;
              return (
                <button
                  key={size}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggle("sizes", size)}
                  className={`min-w-[46px] rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                    checked
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-white text-ink hover:border-ink/40"
                  } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </FilterSection>
      ) : null}

      {colorOptions.length > 0 ? (
        <FilterSection title="Colour" activeCount={filters.colors.length}>
          {colorOptions.map((color) => (
            <OptionRow
              key={color.id}
              label={color.label}
              swatch={color.swatch}
              count={countFor(annotated, filters, "colors", color.id)}
              checked={filters.colors.includes(color.id)}
              onToggle={() => toggle("colors", color.id)}
            />
          ))}
        </FilterSection>
      ) : null}

      {priceOptions.length > 1 ? (
        <FilterSection title="Price" activeCount={filters.price.length}>
          {priceOptions.map((bucket) => (
            <OptionRow
              key={bucket.id}
              label={bucket.label}
              count={countFor(annotated, filters, "price", bucket.id)}
              checked={filters.price.includes(bucket.id)}
              onToggle={() => toggle("price", bucket.id)}
            />
          ))}
        </FilterSection>
      ) : null}

      {fitOptions.length > 0 ? (
        <FilterSection title="Fit & style" activeCount={filters.fits.length}>
          {fitOptions.map((fit) => (
            <OptionRow
              key={fit.id}
              label={fit.label}
              count={countFor(annotated, filters, "fits", fit.id)}
              checked={filters.fits.includes(fit.id)}
              onToggle={() => toggle("fits", fit.id)}
            />
          ))}
        </FilterSection>
      ) : null}

      {fabricOptions.length > 0 ? (
        <FilterSection title="Fabric" activeCount={filters.fabrics.length}>
          {fabricOptions.map((fabric) => (
            <OptionRow
              key={fabric.id}
              label={fabric.label}
              count={countFor(annotated, filters, "fabrics", fabric.id)}
              checked={filters.fabrics.includes(fabric.id)}
              onToggle={() => toggle("fabrics", fabric.id)}
            />
          ))}
        </FilterSection>
      ) : null}

      {emirateOptions.length > 1 ? (
        <FilterSection title="Emirate" activeCount={filters.emirates.length}>
          {emirateOptions.map((value) => (
            <OptionRow
              key={value}
              label={emirateLabel(value)}
              count={countFor(annotated, filters, "emirates", value)}
              checked={filters.emirates.includes(value)}
              onToggle={() => toggle("emirates", value)}
            />
          ))}
        </FilterSection>
      ) : null}

      {storeOptions.length > 1 ? (
        <FilterSection title="Store" activeCount={filters.stores.length}>
          {storeOptions.map(([slug, name]) => (
            <OptionRow
              key={slug}
              label={name}
              count={countFor(annotated, filters, "stores", slug)}
              checked={filters.stores.includes(slug)}
              onToggle={() => toggle("stores", slug)}
            />
          ))}
        </FilterSection>
      ) : null}

      <div className="space-y-2 py-4">
        <OptionRow
          label="On sale"
          count={
            annotated.filter((p) => matches(p, { ...filters, onSale: false }) && p.onSale)
              .length
          }
          checked={filters.onSale}
          onToggle={() => toggleFlag("onSale")}
        />
        <OptionRow
          label="In stock"
          count={
            annotated.filter(
              (p) => matches(p, { ...filters, inStock: false }) && p.inStock,
            ).length
          }
          checked={filters.inStock}
          onToggle={() => toggleFlag("inStock")}
        />
      </div>
    </div>
  );

  return (
    <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-10">
      <aside className="hidden lg:block">
        <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-deep">
              Filters
            </p>
            {activeCount > 0 ? (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-muted underline hover:text-ink"
              >
                Clear all
              </button>
            ) : null}
          </div>

          <div className="mt-3">{panel}</div>

          {categories && categories.length > 0 ? (
            <div className="border-t border-line/70 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink">
                Categories
              </p>
              <div className="mt-2 space-y-1.5">
                {categories.map((category) => (
                  <Link
                    key={category.slug}
                    href={`/categories/${category.slug}`}
                    className={`block text-sm transition ${
                      category.slug === activeSlug
                        ? "font-semibold text-accent-deep"
                        : "text-ink/80 hover:text-accent-deep"
                    }`}
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </aside>

      <div>
        <div className="sticky top-[7.35rem] z-20 -mx-4 border-y border-line/80 bg-background/95 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0">
          <div
            className={`grid gap-2 lg:flex lg:flex-wrap lg:items-center lg:justify-between lg:gap-3 ${
              categoryIsPreferred
                ? "grid-cols-[repeat(3,minmax(0,1fr))]"
                : "grid-cols-[repeat(2,minmax(0,1fr))]"
            }`}
          >
            {categoryIsPreferred ? (
              <button
                type="button"
                onClick={toggleForYou}
                aria-pressed={forYouActive}
                className={`flex h-11 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition lg:hidden ${
                  forYouActive
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-surface text-ink hover:border-ink/40"
                }`}
              >
                <span aria-hidden="true">&#10084;&#65039;</span>
                For you
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-ink transition hover:border-ink/40 lg:hidden"
            >
              <span aria-hidden="true">&#9881;</span>
              Filters{activeCount > 0 ? ` (${activeCount})` : ""}
            </button>
            <label className="relative flex h-11 min-w-0 items-center gap-1.5 overflow-hidden rounded-lg border border-line bg-surface px-3 text-xs text-ink lg:justify-center lg:overflow-visible lg:rounded-full lg:px-3 lg:py-1.5">
              <span className="hidden shrink-0 text-muted lg:inline">Sort</span>
              <span className="min-w-0 flex-1 truncate font-semibold lg:hidden">
                {currentSort.mobileLabel}
              </span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 lg:static lg:h-auto lg:w-auto lg:flex-1 lg:cursor-default lg:opacity-100"
                aria-label="Sort products"
              >
                {SORTS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span aria-hidden="true" className="shrink-0 text-muted lg:hidden">&#8964;</span>
            </label>
            <p className={`${categoryIsPreferred ? "col-span-3" : "col-span-2"} text-sm text-muted lg:col-auto`}>
              {forYouActive ? "Picked for you - " : ""}
              {sorted.length} {sorted.length === 1 ? "piece" : "pieces"}
            </p>
          </div>
        </div>

        {forYouActive ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-accent/20 bg-accent/10 px-3.5 py-3 text-sm text-ink lg:hidden">
            <p><span aria-hidden="true">&#10024;</span> Ordered around your taste.</p>
            <button type="button" onClick={toggleForYou} className="shrink-0 text-xs font-semibold text-accent-deep underline underline-offset-2">
              All pieces
            </button>
          </div>
        ) : null}

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={clearAll}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
              activeCount === 0
                ? "border-ink bg-ink text-white"
                : "border-line bg-white text-ink hover:border-ink/40"
            }`}
          >
            All
          </button>
          {[
            {
              label: "On sale",
              active: filters.onSale,
              onClick: () => toggleFlag("onSale"),
            },
            {
              label: "Under AED 199",
              active: filters.price.includes("99-199"),
              onClick: () => toggle("price", "99-199"),
            },
            {
              label: "In stock",
              active: filters.inStock,
              onClick: () => toggleFlag("inStock"),
            },
          ].map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={chip.onClick}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                chip.active
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-white text-ink hover:border-ink/40"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {activePills.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {activePills.map((pill) => (
              <button
                key={pill.label}
                type="button"
                onClick={pill.onRemove}
                className="inline-flex items-center gap-1.5 rounded-full bg-accent/12 px-3 py-1.5 text-xs text-accent-deep transition hover:bg-accent/20"
              >
                {pill.label}
                <span aria-hidden>&#215;</span>
              </button>
            ))}
          </div>
        ) : null}

        {sorted.length === 0 ? (
          <div className="mt-8 rounded-lg border border-dashed border-line bg-surface/70 p-8 text-center sm:p-10">
            <p className="font-display text-2xl text-ink">Nothing quite matches</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              Try clearing a filter to see the rest of the collection.
            </p>
            <button
              type="button"
              onClick={clearAll}
              className="mt-4 text-sm text-accent-deep underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
              {sorted.slice(0, visible).map((product) => (
                <ProductCard
                  key={product.id}
                  product={{
                    id: product.id,
                    title: product.title,
                    price_aed: Number(product.price_aed),
                    compare_at_price_aed: product.compare_at_price_aed,
                    image_urls: product.image_urls ?? [],
                  }}
                  rating={ratings[product.id] ?? null}
                  href={`/stores/${product.stores.slug}/products/${product.id}`}
                />
              ))}
            </div>
            {visible < sorted.length ? (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisible((v) => v + PAGE_SIZE)}
                  className="rounded-full border border-ink px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-ink transition hover:bg-ink hover:text-white"
                >
                  Load more
                </button>
              </div>
            ) : null}
            {sorted.length > 0 && sorted.length <= 4 && categories && categories.length > 0 ? (
              <div className="mt-10 border-t border-line pt-7">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-deep">
                  Keep exploring
                </p>
                <h2 className="mt-1 font-display text-2xl text-ink">More local finds</h2>
                <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {categories.filter((category) => category.slug !== activeSlug).slice(0, 8).map((category) => (
                    <Link
                      key={category.slug}
                      href={`/categories/${category.slug}`}
                      className="shrink-0 rounded-full border border-line bg-surface px-3.5 py-2 text-xs font-medium text-ink transition hover:border-ink/40"
                    >
                      {category.name}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-ink/45 backdrop-blur-[1px]"
          />
          <div role="dialog" aria-modal="true" aria-label="Filters" className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-2xl border-t border-line bg-background shadow-[0_-20px_60px_-25px_rgba(28,20,24,0.45)]">
            <div className="flex justify-center pt-2.5" aria-hidden="true">
              <span className="h-1 w-10 rounded-full bg-line" />
            </div>
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <div>
                <p className="font-display text-2xl text-ink">Filters</p>
                <p className="mt-0.5 text-xs text-muted">Refine the pieces you see.</p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-xl leading-none text-muted transition hover:bg-surface"
                aria-label="Close"
              >
                <span aria-hidden>&#215;</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5">{panel}</div>
            <div className="flex gap-3 border-t border-line bg-surface px-5 py-4">
              <button
                type="button"
                onClick={clearAll}
                className="min-h-12 flex-1 rounded-lg border border-line px-3 text-xs font-semibold uppercase tracking-[0.12em] text-ink transition hover:border-ink/40"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="min-h-12 flex-[1.4] rounded-lg bg-ink px-3 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-accent-deep"
              >
                Show {sorted.length} {sorted.length === 1 ? "piece" : "pieces"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
