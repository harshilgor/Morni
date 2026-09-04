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
