import type { BrowseCategory } from "@/lib/browse-categories";
import type { Product } from "@/lib/types";

export type StyleCard = {
  id: string;
  categorySlug: string;
  title: string;
  subtitle: string;
  image: string;
  tags: string[];
  priceHintAed?: number;
  productId?: string;
  storeSlug?: string;
  storeName?: string;
  priceAed?: number;
};

const STYLE_DECK: StyleCard[] = [
  {
    id: "kurti-1",
    categorySlug: "kurtis",
    title: "Embroidered cotton kurti",
    subtitle: "Soft daywear with floral threadwork",
    image: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=900&q=80",
    tags: ["cotton", "floral", "casual", "embroidered", "soft", "day"],
    priceHintAed: 120,
  },
  {
    id: "kurti-2",
    categorySlug: "kurtis",
    title: "Straight linen kurti",
    subtitle: "Clean lines in earth tones",
    image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=900&q=80",
    tags: ["linen", "minimal", "earth", "straight", "work", "neutral"],
    priceHintAed: 145,
  },
  {
    id: "kurti-3",
    categorySlug: "kurtis",
    title: "Printed A-line kurti",
    subtitle: "Bold print, easy silhouette",
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&q=80",
    tags: ["print", "bold", "a-line", "colorful", "fun", "casual"],
    priceHintAed: 99,
  },
  {
    id: "kurti-4",
    categorySlug: "kurtis",
    title: "Anarkali-inspired tunic",
    subtitle: "Flowy festive vibes",
    image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=900&q=80",
    tags: ["anarkali", "festive", "flowy", "occasion", "rich", "traditional"],
    priceHintAed: 220,
  },
  {
    id: "kurti-5",
    categorySlug: "kurtis",
    title: "Monochrome long kurti",
    subtitle: "Sleek black for evenings out",
    image: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=900&q=80",
    tags: ["black", "sleek", "evening", "long", "modern", "minimal"],
    priceHintAed: 180,
  },
  {
    id: "kurti-6",
    categorySlug: "kurtis",
    title: "Pastel short kurti",
    subtitle: "Light and breezy for summer",
    image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=900&q=80",
    tags: ["pastel", "short", "summer", "light", "cute", "casual"],
    priceHintAed: 89,
  },
  {
    id: "lehenga-1",
    categorySlug: "lehengas",
    title: "Bridal blush lehenga",
    subtitle: "Heavy embroidery for weddings",
    image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=900&q=80",
    tags: ["bridal", "blush", "heavy", "embroidery", "wedding", "luxurious"],
    priceHintAed: 1800,
  },
  {
    id: "lehenga-2",
    categorySlug: "lehengas",
    title: "Pastel reception lehenga",
    subtitle: "Soft tones, lighter work",
    image: "https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=900&q=80",
    tags: ["pastel", "reception", "light", "soft", "elegant", "occasion"],
    priceHintAed: 980,
  },
  {
    id: "lehenga-3",
    categorySlug: "lehengas",
    title: "Modern crop lehenga",
    subtitle: "Indo-western party energy",
    image: "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=900&q=80",
    tags: ["modern", "crop", "party", "indo-western", "bold", "fun"],
    priceHintAed: 720,
  },
  {
    id: "lehenga-4",
    categorySlug: "lehengas",
    title: "Classic red lehenga",
    subtitle: "Traditional festive statement",
    image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=900&q=80",
    tags: ["red", "classic", "festive", "traditional", "statement", "rich"],
    priceHintAed: 1250,
  },
  {
    id: "party-1",
    categorySlug: "party-wear",
    title: "Sequin cocktail dress",
    subtitle: "Night-out sparkle",
    image: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=900&q=80",
    tags: ["sequin", "cocktail", "sparkle", "night", "bold", "party"],
    priceHintAed: 410,
  },
  {
    id: "party-2",
    categorySlug: "party-wear",
    title: "Satin slip dress",
    subtitle: "Minimal glam for dinners",
    image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=900&q=80",
    tags: ["satin", "slip", "minimal", "glam", "dinner", "soft"],
    priceHintAed: 320,
  },
  {
    id: "party-3",
    categorySlug: "party-wear",
    title: "Structured blazer dress",
    subtitle: "Sharp and modern",
    image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=900&q=80",
    tags: ["structured", "blazer", "modern", "sharp", "city", "power"],
    priceHintAed: 380,
  },
  {
    id: "party-4",
    categorySlug: "party-wear",
    title: "Flowy chiffon evening",
    subtitle: "Romantic movement",
    image: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=900&q=80",
    tags: ["chiffon", "flowy", "romantic", "evening", "soft", "elegant"],
    priceHintAed: 450,
  },
  {
    id: "indo-1",
    categorySlug: "indo-western",
    title: "Cape coord set",
    subtitle: "Fusion layers done right",
    image: "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=900&q=80",
    tags: ["cape", "coord", "fusion", "modern", "layered", "statement"],
    priceHintAed: 390,
  },
  {
    id: "indo-2",
    categorySlug: "indo-western",
    title: "Palazzo jumpsuit",
    subtitle: "Easy chic silhouette",
    image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&q=80",
    tags: ["jumpsuit", "palazzo", "easy", "chic", "casual", "modern"],
    priceHintAed: 260,
  },
  {
    id: "indo-3",
    categorySlug: "indo-western",
    title: "Embellished jacket dress",
    subtitle: "Party fusion favorite",
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&q=80",
    tags: ["embellished", "jacket", "party", "fusion", "bold", "festive"],
    priceHintAed: 520,
  },
  {
    id: "sharara-1",
    categorySlug: "shararas",
    title: "Flared festive sharara",
    subtitle: "Volume with soft pastels",
    image: "https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=900&q=80",
    tags: ["flared", "festive", "pastel", "volume", "occasion", "soft"],
    priceHintAed: 640,
  },
  {
    id: "sharara-2",
    categorySlug: "shararas",
    title: "Gharara with heavy border",
    subtitle: "Statement wedding guest look",
    image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=900&q=80",
    tags: ["gharara", "heavy", "wedding", "guest", "rich", "traditional"],
    priceHintAed: 890,
  },
  {
    id: "sharara-3",
    categorySlug: "shararas",
    title: "Light daytime sharara",
    subtitle: "Breezy for brunches",
    image: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=900&q=80",
    tags: ["light", "daytime", "breezy", "brunch", "casual", "soft"],
    priceHintAed: 310,
  },
  {
    id: "suit-1",
    categorySlug: "salwar-kameez",
    title: "Classic salwar suit",
    subtitle: "Everyday polished ethnic",
    image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=900&q=80",
    tags: ["classic", "suit", "everyday", "polished", "ethnic", "neutral"],
    priceHintAed: 280,
  },
  {
    id: "suit-2",
    categorySlug: "salwar-kameez",
    title: "Punjabi phulkari suit",
    subtitle: "Colorful traditional craft",
    image: "https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=900&q=80",
    tags: ["phulkari", "colorful", "traditional", "craft", "festive", "bold"],
    priceHintAed: 420,
  },
  {
    id: "suit-3",
    categorySlug: "salwar-kameez",
    title: "Minimal cream suit",
    subtitle: "Soft and understated",
    image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=900&q=80",
    tags: ["minimal", "cream", "soft", "understated", "elegant", "light"],
    priceHintAed: 250,
  },
];

export function getStyleDeckForCategory(slug: string): StyleCard[] {
  const exact = STYLE_DECK.filter((card) => card.categorySlug === slug);
  if (exact.length > 0) return exact;

  // Fallback inspiration so every browse category is still swipeable
  return [
    {
      id: `${slug}-fallback-1`,
      categorySlug: slug,
      title: "Soft everyday look",
      subtitle: "Easy pieces for daily wear",
      image:
        "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=900&q=80",
      tags: ["soft", "everyday", "casual", "light", "easy"],
      priceHintAed: 150,
    },
    {
      id: `${slug}-fallback-2`,
      categorySlug: slug,
      title: "Bold statement look",
      subtitle: "For when you want to stand out",
      image:
        "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=900&q=80",
      tags: ["bold", "statement", "colorful", "party", "fun"],
      priceHintAed: 320,
    },
    {
      id: `${slug}-fallback-3`,
      categorySlug: slug,
      title: "Minimal clean look",
      subtitle: "Quiet luxury vibes",
      image:
        "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=900&q=80",
      tags: ["minimal", "clean", "neutral", "modern", "sleek"],
      priceHintAed: 280,
    },
    {
      id: `${slug}-fallback-4`,
      categorySlug: slug,
      title: "Festive elevated look",
      subtitle: "Occasion-ready polish",
      image:
        "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=900&q=80",
      tags: ["festive", "elevated", "rich", "occasion", "traditional"],
      priceHintAed: 650,
    },
    {
      id: `${slug}-fallback-5`,
      categorySlug: slug,
      title: "Romantic soft look",
      subtitle: "Flow and movement",
      image:
        "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=900&q=80",
      tags: ["romantic", "soft", "flowy", "elegant", "evening"],
      priceHintAed: 390,
    },
    {
      id: `${slug}-fallback-6`,
      categorySlug: slug,
      title: "City chic look",
      subtitle: "Polished for going out",
      image:
        "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900&q=80",
      tags: ["city", "chic", "polished", "modern", "night"],
      priceHintAed: 340,
    },
  ];
}

export function productToStyleCard(
  product: Product & { stores: { slug: string; name: string } },
  categorySlug: string,
  searchTerms: string[],
): StyleCard {
  const haystack = `${product.title} ${product.description ?? ""}`.toLowerCase();
  const matched = searchTerms.filter((t) => haystack.includes(t.toLowerCase()));
  const words = haystack
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3)
    .slice(0, 8);

  return {
    id: `product-${product.id}`,
    categorySlug,
    title: product.title,
    subtitle: product.description ?? product.stores.name,
    image:
      product.image_urls?.[0] ??
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=900&q=80",
    tags: Array.from(new Set([...matched, ...words])).slice(0, 10),
    priceHintAed: product.price_aed,
    productId: product.id,
    storeSlug: product.stores.slug,
    storeName: product.stores.name,
    priceAed: product.price_aed,
  };
}

export function buildSwipeDeck(
  category: BrowseCategory,
  products: (Product & { stores: { slug: string; name: string } })[],
): StyleCard[] {
  const terms = category.search_terms ?? [];
  const matchedProducts = products.filter((product) => {
    if (terms.length === 0) return true;
    const haystack = `${product.title} ${product.description ?? ""}`.toLowerCase();
    return terms.some((term) => haystack.includes(term.toLowerCase()));
  });

  const productCards = matchedProducts.map((p) =>
    productToStyleCard(p, category.slug, terms),
  );
  const inspiration = getStyleDeckForCategory(category.slug);

  // Prefer real products first, then fill with inspiration so the deck is swipeable
  const seen = new Set<string>();
  const deck: StyleCard[] = [];
  for (const card of [...productCards, ...inspiration]) {
    const key = card.image + card.title;
    if (seen.has(key)) continue;
    seen.add(key);
    deck.push(card);
  }
  return deck.slice(0, 12);
}

export type TasteVote = {
  cardId: string;
  liked: boolean;
  tags: string[];
  priceHintAed?: number;
};

export type TasteProfile = {
  likedTags: Record<string, number>;
  dislikedTags: Record<string, number>;
  likedPriceSum: number;
  likedPriceCount: number;
  likeCount: number;
  passCount: number;
};

export function emptyTaste(): TasteProfile {
  return {
    likedTags: {},
    dislikedTags: {},
    likedPriceSum: 0,
    likedPriceCount: 0,
    likeCount: 0,
    passCount: 0,
  };
}

export function applyVote(profile: TasteProfile, vote: TasteVote): TasteProfile {
  const next: TasteProfile = {
    likedTags: { ...profile.likedTags },
    dislikedTags: { ...profile.dislikedTags },
    likedPriceSum: profile.likedPriceSum,
    likedPriceCount: profile.likedPriceCount,
    likeCount: profile.likeCount,
    passCount: profile.passCount,
  };

  const bucket = vote.liked ? next.likedTags : next.dislikedTags;
  for (const tag of vote.tags) {
    bucket[tag] = (bucket[tag] ?? 0) + 1;
  }

  if (vote.liked) {
    next.likeCount += 1;
    if (typeof vote.priceHintAed === "number") {
      next.likedPriceSum += vote.priceHintAed;
      next.likedPriceCount += 1;
    }
  } else {
    next.passCount += 1;
  }

  return next;
}

export function scoreCard(card: StyleCard, profile: TasteProfile): number {
  let score = 0;
  for (const tag of card.tags) {
    score += (profile.likedTags[tag] ?? 0) * 3;
    score -= (profile.dislikedTags[tag] ?? 0) * 2;
  }
  if (profile.likedPriceCount > 0 && typeof card.priceHintAed === "number") {
    const avg = profile.likedPriceSum / profile.likedPriceCount;
    const delta = Math.abs(card.priceHintAed - avg) / Math.max(avg, 1);
    score += Math.max(0, 2 - delta * 2);
  }
  if (card.productId) score += 1.5;
  return score;
}

export function topTasteTags(profile: TasteProfile, limit = 4): string[] {
  return Object.entries(profile.likedTags)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}

export function recommendProducts(
  products: (Product & { stores: { slug: string; name: string } })[],
  category: BrowseCategory,
  profile: TasteProfile,
  limit = 8,
) {
  const terms = category.search_terms ?? [];
  const cards = products
    .filter((product) => {
      if (terms.length === 0) return true;
      const haystack = `${product.title} ${product.description ?? ""}`.toLowerCase();
      return terms.some((term) => haystack.includes(term.toLowerCase()));
    })
    .map((p) => productToStyleCard(p, category.slug, terms));

  // If category has few products, score all products as a fallback pool
  const pool =
    cards.length >= 3
      ? cards
      : products.map((p) => productToStyleCard(p, category.slug, terms));

  return [...pool]
    .map((card) => ({ card, score: scoreCard(card, profile) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.card);
}
