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

export type TasteEvidence = {
  likes: number;
  passes: number;
};

export type LikedSignal = {
  productId: string;
  categorySlug: string;
  tags: string[];
  priceAed: number;
};

export type TasteProfile = {
  categories: Record<string, TasteEvidence>;
  tags: Record<string, TasteEvidence>;
  likedProductIds: string[];
  passedProductIds: string[];
  likedSignals: LikedSignal[];
  likedPriceSum: number;
  likedPriceCount: number;
  likes: number;
  passes: number;
};

export type TasteSwipe = Pick<ForYouCard, "productId" | "categorySlug" | "tags" | "priceAed"> & {
  decision: "liked" | "passed";
};

/** Minimal product shape accepted by the shared scorer (For You + browse). */
export type ScoreableProduct = {
  id: string;
  title: string;
  description?: string | null;
  price_aed: number;
  image_urls?: string[] | null;
  stock?: number;
};

export const MIN_SWIPES_FOR_RESULTS = 10;
export const MAX_TASTE_DECK_SIZE = 15;

const AFFINITY_ALPHA = 1;
const CONFIDENCE_K = 3;
const PROFILE_CONFIDENCE_K = 8;
const POSITIVE_AFFINITY_WEIGHT = 1.5;
const NEGATIVE_AFFINITY_WEIGHT = 0.6;
const W_CATEGORY = 4;
const W_TAG = 2.5;
const W_PRICE = 2;
const W_SIMILARITY = 6;
const W_PRIOR = 0.35;
const SCORE_FLOOR = 0.2;

export function emptyTasteEvidence(): TasteEvidence {
  return { likes: 0, passes: 0 };
}

export function emptyTasteProfile(): TasteProfile {
  return {
    categories: {},
    tags: {},
    likedProductIds: [],
    passedProductIds: [],
    likedSignals: [],
    likedPriceSum: 0,
    likedPriceCount: 0,
    likes: 0,
    passes: 0,
  };
}

/** True when a stored blob matches the evidence-based TasteProfile shape. */
export function isTasteProfile(value: unknown): value is TasteProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Partial<TasteProfile>;
  return (
    typeof profile.categories === "object" &&
    profile.categories !== null &&
    typeof profile.tags === "object" &&
    profile.tags !== null &&
    Array.isArray(profile.likedProductIds) &&
    Array.isArray(profile.passedProductIds) &&
    Array.isArray(profile.likedSignals) &&
    typeof profile.likedPriceSum === "number" &&
    typeof profile.likedPriceCount === "number" &&
    typeof profile.likes === "number" &&
    typeof profile.passes === "number"
  );
}

function textForProduct(product: Pick<ScoreableProduct, "title" | "description">) {
  return `${product.title} ${product.description ?? ""}`.toLowerCase();
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function bumpEvidence(
  map: Record<string, TasteEvidence>,
  key: string,
  decision: TasteSwipe["decision"],
) {
  if (!key) return;
  const current = map[key] ?? emptyTasteEvidence();
  map[key] =
    decision === "liked"
      ? { likes: current.likes + 1, passes: current.passes }
      : { likes: current.likes, passes: current.passes + 1 };
}

export function categoryForProduct(
  product: Pick<ScoreableProduct, "title" | "description">,
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

export function tagsForProduct(
  product: Pick<ScoreableProduct, "title" | "description">,
  category: BrowseCategory | null,
  extraTags: string[] = [],
) {
  const words = textForProduct(product)
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word.length >= 3)
    .slice(0, 16);

  return unique([
    category?.slug ?? "",
    ...(category?.search_terms ?? []),
    ...words,
    ...extraTags,
  ]).slice(0, 14);
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
  const categories = { ...profile.categories };
  const tags = { ...profile.tags };
  bumpEvidence(categories, swipe.categorySlug, swipe.decision);
  for (const tag of swipe.tags) bumpEvidence(tags, tag, swipe.decision);

  const likedProductIds =
    swipe.decision === "liked"
      ? unique([...profile.likedProductIds, swipe.productId])
      : profile.likedProductIds.filter((id) => id !== swipe.productId);
  const passedProductIds =
    swipe.decision === "passed"
      ? unique([...profile.passedProductIds, swipe.productId])
      : profile.passedProductIds.filter((id) => id !== swipe.productId);

  let likedSignals = profile.likedSignals.filter((signal) => signal.productId !== swipe.productId);
  let likedPriceSum = profile.likedSignals
    .filter((signal) => signal.productId !== swipe.productId)
    .reduce((sum, signal) => sum + signal.priceAed, 0);
  let likedPriceCount = likedSignals.length;

  if (swipe.decision === "liked") {
    likedSignals = [
      ...likedSignals,
      {
        productId: swipe.productId,
        categorySlug: swipe.categorySlug,
        tags: swipe.tags,
        priceAed: swipe.priceAed,
      },
    ];
    likedPriceSum += swipe.priceAed;
    likedPriceCount += 1;
  }

  const likes = likedProductIds.length;
  const passes = passedProductIds.length;

  return {
    categories,
    tags,
    likedProductIds,
    passedProductIds,
    likedSignals,
    likedPriceSum,
    likedPriceCount,
    likes,
    passes,
  };
}

export function profileFromSwipes(swipes: TasteSwipe[]) {
  return swipes.reduce(applyTasteSwipe, emptyTasteProfile());
}

/** Laplace-smoothed affinity in [-1, 1]. */
export function signedAffinity(evidence: TasteEvidence | undefined) {
  const likes = evidence?.likes ?? 0;
  const passes = evidence?.passes ?? 0;
  const rate = (likes + AFFINITY_ALPHA) / (likes + passes + 2 * AFFINITY_ALPHA);
  return 2 * rate - 1;
}

export function evidenceConfidence(evidence: TasteEvidence | undefined) {
  const likes = evidence?.likes ?? 0;
  const passes = evidence?.passes ?? 0;
  return 1 - Math.exp(-(likes + passes) / CONFIDENCE_K);
}

function asymmetricAffinity(evidence: TasteEvidence | undefined) {
  const signed = signedAffinity(evidence);
  const weight = signed >= 0 ? POSITIVE_AFFINITY_WEIGHT : NEGATIVE_AFFINITY_WEIGHT;
  return signed * weight * evidenceConfidence(evidence);
}

export function profileConfidence(profile: TasteProfile) {
  return 1 - Math.exp(-(profile.likes + profile.passes) / PROFILE_CONFIDENCE_K);
}

function jaccard(a: string[], b: string[]) {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let intersection = 0;
  for (const item of a) if (setB.has(item)) intersection += 1;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

export function similarityToLiked(tags: string[], categorySlug: string | null, profile: TasteProfile) {
  if (profile.likedSignals.length === 0) return 0;

  let best = 0;
  for (const signal of profile.likedSignals) {
    const tagScore = jaccard(tags, signal.tags);
    const categoryBonus =
      categorySlug && signal.categorySlug && categorySlug === signal.categorySlug ? 0.35 : 0;
    best = Math.max(best, Math.min(1, tagScore + categoryBonus));
  }
  return best;
}

function priceProximity(priceAed: number, profile: TasteProfile) {
  if (profile.likedPriceCount <= 0) return 0;
  const average = profile.likedPriceSum / profile.likedPriceCount;
  const difference = Math.abs(priceAed - average) / Math.max(average, 1);
  return Math.max(0, 1 - difference);
}

function mildPrior(product: ScoreableProduct) {
  let prior = 0;
  if (product.image_urls?.[0]) prior += 0.4;
  if ((product.stock ?? 1) > 0) prior += 0.3;
  const price = Number(product.price_aed);
  if (price > 0 && price < 2500) prior += 0.3;
  return prior;
}

export function scoreProductForTaste(
  product: ScoreableProduct,
  categories: BrowseCategory[],
  profile: TasteProfile,
  options?: {
    categorySlug?: string | null;
    extraTags?: string[];
  },
) {
  const inferred = categoryForProduct(product, categories);
  const hinted = options?.categorySlug
    ? categories.find((entry) => entry.slug === options.categorySlug) ?? null
    : null;
  const category = inferred ?? hinted;
  const categorySlug = category?.slug ?? options?.categorySlug ?? null;
  const tags = tagsForProduct(product, category, options?.extraTags ?? []);

  const categoryTerm = categorySlug
    ? asymmetricAffinity(profile.categories[categorySlug]) * W_CATEGORY
    : 0;

  const evidencedTags = tags.filter((tag) => profile.tags[tag]);
  const tagTerm =
    evidencedTags.length === 0
      ? 0
      : (evidencedTags.reduce((sum, tag) => sum + asymmetricAffinity(profile.tags[tag]), 0) /
          evidencedTags.length) *
        W_TAG;

  const priceTerm = priceProximity(Number(product.price_aed), profile) * W_PRICE;
  const similarityTerm = similarityToLiked(tags, categorySlug, profile) * W_SIMILARITY;
  const confidence = profileConfidence(profile);
  const priorTerm = (1 - confidence) * mildPrior(product) * W_PRIOR;

  return categoryTerm + tagTerm + priceTerm + similarityTerm + priorTerm;
}

export function topCategories(profile: TasteProfile, categories: BrowseCategory[], limit = 3) {
  return [...categories]
    .map((category) => ({
      category,
      score: asymmetricAffinity(profile.categories[category.slug]),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.category);
}

export function topTags(profile: TasteProfile, limit = 4) {
  return Object.entries(profile.tags)
    .map(([tag, evidence]) => ({ tag, score: asymmetricAffinity(evidence) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.tag);
}

function diversifyRecommendations(
  ranked: Array<{ product: ForYouProduct; categorySlug: string; score: number }>,
  limit: number,
) {
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

export function recommendForYouProducts(
  products: ForYouProduct[],
  categories: BrowseCategory[],
  profile: TasteProfile,
  dismissedProductIds: string[],
  limit = 12,
) {
  if (profile.likes === 0) return [];

  const excluded = new Set([
    ...dismissedProductIds,
    ...profile.passedProductIds,
    ...profile.likedProductIds,
  ]);

  const ranked = products
    .filter((product) => product.image_urls[0] && !excluded.has(product.id))
    .map((product) => {
      const category = categoryForProduct(product, categories);
      const score = scoreProductForTaste(product, categories, profile);
      return { product, categorySlug: category?.slug ?? "discover", score };
    })
    .sort((a, b) => b.score - a.score);

  const aboveFloor = ranked.filter((item) => item.score >= SCORE_FLOOR);
  const pool = aboveFloor.length > 0 ? aboveFloor : ranked.slice(0, Math.min(limit, ranked.length));

  return diversifyRecommendations(pool, limit);
}
