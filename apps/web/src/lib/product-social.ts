export function getProductSocialProof(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
  }
  const rating = 4 + hash % 10 / 10;
  const reviews = 18 + (hash % 220);
  const boughtToday = 3 + (hash % 27);
  return {
    rating: Number(rating.toFixed(1)),
    ratingLabel: rating.toFixed(1),
    reviews,
    boughtToday,
  };
}
