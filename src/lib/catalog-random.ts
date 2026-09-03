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
