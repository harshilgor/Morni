/** Stable daily shuffle: random-looking ordering without changing on every render. */
export function shuffleCatalog<T extends { id: string }>(items: T[], seed: string): T[] {
  const output = [...items];
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  for (let i = output.length - 1; i > 0; i -= 1) {
    state = Math.imul(state ^ (state >>> 13), 2246822519);
    const j = (state >>> 0) % (i + 1);
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
}

export function catalogShuffleSeed(slug: string, date = new Date()) {
  return `${slug}:${date.toISOString().slice(0, 10)}`;
}

export type MerchandisingOptions<T> = {
  /** A stable seed makes the order feel fresh without jumping between renders. */
  seed: string;
  /** The product family to spread through the rail, usually its browse category. */
  getCategoryKey: (item: T) => string;
  /** A secondary guard so neighbouring cards are not from one boutique when avoidable. */
  getStoreKey?: (item: T) => string;
};

/**
 * Produces a deterministic merchandising order that gives every available
 * product family a turn before repeating one. Within that category rotation it
 * prefers a different boutique from the preceding card. This preserves every
 * product exactly once and degrades gracefully when a rail has only one
 * category or one store.
 */
export function merchandiseCatalog<T extends { id: string }>(
  items: T[],
  { seed, getCategoryKey, getStoreKey }: MerchandisingOptions<T>,
): T[] {
  if (items.length < 2) return [...items];

  const buckets = new Map<string, T[]>();
  for (const item of shuffleCatalog(items, seed)) {
    const key = getCategoryKey(item).trim() || "uncategorized";
    const bucket = buckets.get(key) ?? [];
    bucket.push(item);
    buckets.set(key, bucket);
  }

  // Rotate which category starts first each day, while retaining a stable
  // order within that day for caching, links, and a non-jarring storefront.
  const categoryOrder = shuffleCatalog(
    [...buckets.keys()].map((key) => ({ id: key })),
    `${seed}:categories`,
  ).map(({ id }) => id);
  const shownByCategory = new Map(categoryOrder.map((key) => [key, 0]));
  const output: T[] = [];
  let previousCategory: string | null = null;
  let previousStore: string | null = null;

  while (output.length < items.length) {
    const availableCategories = categoryOrder.filter((key) => (buckets.get(key)?.length ?? 0) > 0);
    if (availableCategories.length === 0) break;

    const fewestShown = Math.min(
      ...availableCategories.map((key) => shownByCategory.get(key) ?? 0),
    );
    let categoryCandidates = availableCategories.filter(
      (key) => (shownByCategory.get(key) ?? 0) === fewestShown,
    );

    // Do not repeat a category while an equally represented alternative exists.
    const withoutPreviousCategory = categoryCandidates.filter((key) => key !== previousCategory);
    if (withoutPreviousCategory.length > 0) categoryCandidates = withoutPreviousCategory;

    // Prefer a category that can also avoid repeating the previous store.
    if (getStoreKey && previousStore) {
      const withDifferentStore = categoryCandidates.filter((key) =>
        (buckets.get(key) ?? []).some((item) => (getStoreKey(item).trim() || "__unknown__") !== previousStore),
      );
      if (withDifferentStore.length > 0) categoryCandidates = withDifferentStore;
    }

    const category = categoryCandidates[0];
    const bucket = buckets.get(category) as T[];
    const productIndex: number = getStoreKey && previousStore
      ? bucket.findIndex((item) => (getStoreKey(item).trim() || "__unknown__") !== previousStore)
      : 0;
    const product = bucket.splice(productIndex >= 0 ? productIndex : 0, 1)[0] as T;

    output.push(product);
    previousCategory = category;
    previousStore = getStoreKey ? getStoreKey(product).trim() || "__unknown__" : null;
    shownByCategory.set(category, (shownByCategory.get(category) ?? 0) + 1);
  }

  return output;
}

/**
 * Reorders a list so adjacent items usually come from different groups (for
 * example, different stores). It is deterministic for a given input order,
 * preserves every item exactly once, and falls back gracefully when only one
 * group remains.
 */
export function diversifyByKey<T>(items: T[], getKey: (item: T) => string): T[] {
  const buckets = new Map<string, T[]>();
  items.forEach((item) => {
    const key = getKey(item) || "__unknown__";
    const bucket = buckets.get(key) ?? [];
    bucket.push(item);
    buckets.set(key, bucket);
  });

  const output: T[] = [];
  let previousKey: string | null = null;
  while (output.length < items.length) {
    const candidates = [...buckets.entries()]
      .filter(([, bucket]) => bucket.length > 0)
      .sort((a, b) => b[1].length - a[1].length);
    if (candidates.length === 0) break;
    const [key, bucket] = candidates.find(([candidateKey]) => candidateKey !== previousKey) ?? candidates[0];
    output.push(bucket.shift() as T);
    previousKey = key;
  }
  return output;
}
