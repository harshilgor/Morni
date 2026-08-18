import type { BrowseCategory } from "@/lib/browse-categories";
import type { Product } from "@/lib/types";

export type ForYouProduct = Product & {
  stores: {
    slug: string;
    name: string;
    is_active: boolean;
    emirate: string;
  };
};

export type ForYouCard = {
  id: string;
  productId: string;
  categorySlug: string;
  categoryName: string;
  title: string;
  imageUrl: string;
  priceAed: number;
  storeName: string;
  storeSlug: string;
  tags: string[];
};

export type TasteProfile = {
  categoryScores: Record<string, number>;
  tagScores: Record<string, number>;
  likedProductIds: string[];
  passedProductIds: string[];
  likedPriceSum: number;
  likedPriceCount: number;
  likes: number;
  passes: number;
};

export type TasteSwipe = Pick<ForYouCard, "productId" | "categorySlug" | "tags" | "priceAed"> & {
  decision: "liked" | "passed";
};

export const MIN_SWIPES_FOR_RESULTS = 10;
export const MAX_TASTE_DECK_SIZE = 15;

export function emptyTasteProfile(): TasteProfile {
  return {
    categoryScores: {},
    tagScores: {},
    likedProductIds: [],
    passedProductIds: [],
    likedPriceSum: 0,
    likedPriceCount: 0,
    likes: 0,
    passes: 0,
  };
}

function textForProduct(product: Product) {
  return `${product.title} ${product.description ?? ""}`.toLowerCase();
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function categoryForProduct(
  product: Product,
  categories: BrowseCategory[],
): BrowseCategory | null {
  const text = textForProduct(product);
  let winner: BrowseCategory | null = null;
  let score = 0;

  for (const category of categories) {
    const nextScore = (category.search_terms ?? []).reduce(
      (count, term) => count + (text.includes(term.toLowerCase()) ? 1 : 0),
      0,
    );
    if (nextScore > score) {
      winner = category;
      score = nextScore;
    }
  }

  return winner;
}

export function tagsForProduct(product: Product, category: BrowseCategory | null) {
  const words = textForProduct(product)
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word.length >= 3)
    .slice(0, 16);

  return unique([category?.slug ?? "", ...(category?.search_terms ?? []), ...words]).slice(0, 14);
}

function cardForProduct(product: ForYouProduct, category: BrowseCategory | null): ForYouCard | null {
  const imageUrl = product.image_urls[0];
  if (!imageUrl) return null;

  return {
    id: product.id,
    productId: product.id,
    categorySlug: category?.slug ?? "discover",
    categoryName: category?.name ?? "Discover",
    title: product.title,
    imageUrl,
    priceAed: product.price_aed,
    storeName: product.stores.name,
    storeSlug: product.stores.slug,
    tags: tagsForProduct(product, category),
  };
}

export function buildUniversalTasteDeck(
  products: ForYouProduct[],
  categories: BrowseCategory[],
  limit = MAX_TASTE_DECK_SIZE,
) {
  const buckets = new Map<string, ForYouCard[]>();
  const fallback: ForYouCard[] = [];

  for (const product of products) {
    const category = categoryForProduct(product, categories);
    const card = cardForProduct(product, category);
    if (!card) continue;
    fallback.push(card);
    if (category) {
      const cards = buckets.get(category.slug) ?? [];
      cards.push(card);
      buckets.set(category.slug, cards);
    }
  }

  const deck: ForYouCard[] = [];
  const used = new Set<string>();
  const add = (card: ForYouCard | undefined) => {
    if (!card || used.has(card.productId) || deck.length >= limit) return;
    used.add(card.productId);
    deck.push(card);
  };

  // One real listing per category gives every category a fair first impression.
  for (const category of categories) add(buckets.get(category.slug)?.[0]);

  let round = 1;
  while (deck.length < limit) {
    let added = false;
    for (const category of categories) {
      const before = deck.length;
      add(buckets.get(category.slug)?.[round]);
      added ||= deck.length > before;
    }
    if (!added) break;
    round += 1;
  }

  for (const card of fallback) add(card);
  return deck;
}

export function applyTasteSwipe(profile: TasteProfile, swipe: TasteSwipe): TasteProfile {
  const delta = swipe.decision === "liked" ? 1 : -1;
  const categoryScores = { ...profile.categoryScores };
  const tagScores = { ...profile.tagScores };
  categoryScores[swipe.categorySlug] = (categoryScores[swipe.categorySlug] ?? 0) + delta;
  for (const tag of swipe.tags) tagScores[tag] = (tagScores[tag] ?? 0) + delta;

  const likedProductIds = swipe.decision === "liked"
    ? unique([...profile.likedProductIds, swipe.productId])
    : profile.likedProductIds.filter((id) => id !== swipe.productId);
  const passedProductIds = swipe.decision === "passed"
    ? unique([...profile.passedProductIds, swipe.productId])
    : profile.passedProductIds.filter((id) => id !== swipe.productId);

  return {
    categoryScores,
    tagScores,
    likedProductIds,
    passedProductIds,
    likedPriceSum: profile.likedPriceSum + (swipe.decision === "liked" ? swipe.priceAed : 0),
    likedPriceCount: profile.likedPriceCount + (swipe.decision === "liked" ? 1 : 0),
    likes: profile.likes + (swipe.decision === "liked" ? 1 : 0),
    passes: profile.passes + (swipe.decision === "passed" ? 1 : 0),
  };
}

export function profileFromSwipes(swipes: TasteSwipe[]) {
  return swipes.reduce(applyTasteSwipe, emptyTasteProfile());
}

/** 65–95% match badge for swipe cards; stable per category when taste is still empty. */
export function vibeScoreForCard(profile: TasteProfile, categorySlug: string) {
  const interactions = profile.likes + profile.passes;
  if (interactions === 0) {
    let hash = 0;
    for (const char of categorySlug) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return 68 + (hash % 22);
  }
  const score = Math.max(0, profile.categoryScores[categorySlug] ?? 0);
  const maxScore = Math.max(1, ...Object.values(profile.categoryScores).map((v) => Math.max(0, v)));
  return Math.round(65 + (score / maxScore) * 30);
}

export function topCategories(profile: TasteProfile, categories: BrowseCategory[], limit = 3) {
  return [...categories]
    .sort((a, b) => (profile.categoryScores[b.slug] ?? 0) - (profile.categoryScores[a.slug] ?? 0))
    .filter((category) => (profile.categoryScores[category.slug] ?? 0) > 0)
    .slice(0, limit);
}

export function topTags(profile: TasteProfile, limit = 4) {
  return Object.entries(profile.tagScores)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}

export function recommendForYouProducts(
  products: ForYouProduct[],
  categories: BrowseCategory[],
  profile: TasteProfile,
  dismissedProductIds: string[],
  limit = 12,
) {
  const dismissed = new Set([...dismissedProductIds, ...profile.passedProductIds]);
  const averagePrice = profile.likedPriceCount
    ? profile.likedPriceSum / profile.likedPriceCount
    : null;

  const ranked = products
    .filter((product) => product.image_urls[0] && !dismissed.has(product.id))
    .map((product) => {
      const category = categoryForProduct(product, categories);
      const tags = tagsForProduct(product, category);
      let score = category ? (profile.categoryScores[category.slug] ?? 0) * 4 : 0;
      for (const tag of tags) score += profile.tagScores[tag] ?? 0;
      if (averagePrice) {
        const difference = Math.abs(product.price_aed - averagePrice) / Math.max(averagePrice, 1);
        score += Math.max(0, 2 - difference * 2);
      }
      return { product, categorySlug: category?.slug ?? "discover", score };
    })
    .sort((a, b) => b.score - a.score);

  const categoryCount = new Map<string, number>();
  const recommendationIds = new Set<string>();
  const result: ForYouProduct[] = [];
  for (const item of ranked) {
    const count = categoryCount.get(item.categorySlug) ?? 0;
    if (count >= 3 && result.length < Math.min(6, limit)) continue;
    categoryCount.set(item.categorySlug, count + 1);
    recommendationIds.add(item.product.id);
    result.push(item.product);
    if (result.length === limit) break;
  }

  if (result.length < limit) {
    for (const item of ranked) {
      if (recommendationIds.has(item.product.id)) continue;
      result.push(item.product);
      if (result.length === limit) break;
    }
  }

  return result;
}
