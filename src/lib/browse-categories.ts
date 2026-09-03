export type BrowseCategory = {
  id: string;
  name: string;
  slug: string;
  image_url: string;
  badge: string | null;
  search_terms: string[];
  sort_order: number;
  is_featured: boolean;
};

export const RETIRED_BROWSE_CATEGORY_SLUGS = new Set(["elegant-fashion"]);

const featuredCategory = (
  name: string,
  slug: string,
  image_url: string,
  search_terms: string[],
  sort_order: number,
  badge: string | null = null,
): BrowseCategory => ({
  id: `featured-${slug}`,
  name,
  slug,
  image_url,
  badge,
  search_terms,
  sort_order,
  is_featured: true,
});

export const FEATURED_CATEGORY_CATALOG: BrowseCategory[] = [
  featuredCategory(
    "Lehengas",
    "lehengas",
    "/categories/lehengas.webp",
    ["lehenga", "lengha", "bridal", "ghagra"],
    1,
  ),
  featuredCategory(
    "Sarees",
    "sarees",
    "/categories/sarees.png",
    ["saree", "sari", "drape", "silk saree"],
    2,
  ),
  featuredCategory(
    "Sharara & Gharara Sets",
    "shararas",
    "/categories/shararas.jpg",
    ["sharara", "gharara", "palazzo", "sharara set"],
    3,
  ),
  featuredCategory(
    "Salwar Kameez / Suit Sets",
    "salwar-kameez",
    "/categories/salwar-kameez.webp",
    ["salwar", "kameez", "suit", "shalwar", "suit set"],
    4,
  ),
  featuredCategory(
    "Kurtis",
    "kurtis",
    "/categories/kurtis-featured.png",
    ["kurti", "kurta", "tunic"],
    5,
  ),
  featuredCategory(
    "Short Kurtis",
    "short-kurtis",
    "/categories/short-kurtis-featured.png",
    ["short kurti", "short kurta", "tunic top"],
    6,
  ),
  featuredCategory(
    "Chikankari",
    "chikankari",
    "/categories/chikankari.jpg",
    ["chikankari", "lucknowi", "embroidered kurti"],
    7,
  ),
  featuredCategory(
    "Pakistani Suits",
    "pakistani-suits",
    "/categories/pakistani-suits.png",
    ["pakistani suit", "pakistani", "lawn suit", "three piece suit"],
    8,
  ),
  featuredCategory(
    "Indo-Western",
    "indo-western",
    "/categories/indo-western.jpeg",
    ["indo western", "fusion", "cape", "fusion set"],
    9,
  ),
  featuredCategory(
    "Co-ord Sets",
    "sets",
    "/categories/co-ord-sets.png",
    ["co-ord", "coord", "matching set", "two piece set"],
    10,
  ),
  featuredCategory(
    "Party Wear",
    "party-wear",
    "/categories/party-wear.png",
    ["party", "evening", "sequin", "cocktail", "occasion"],
    11,
  ),
  featuredCategory(
    "Anarkalis",
    "anarkalis",
    "/categories/anarkalis.jpg",
    ["anarkali", "anarkali suit", "flared kurta"],
    12,
  ),
  featuredCategory(
    "Ethnic Tops / Crop Tops",
    "tops",
    "/categories/ethnic-tops-crop-tops.jpg",
    ["ethnic top", "crop top", "blouse", "top"],
    13,
  ),
  featuredCategory(
    "Kaftan",
    "kaftan",
    "/categories/kaftan.jpg",
    ["kaftan", "kaftans", "abaya", "modest dress", "flowy dress"],
    14,
  ),
  featuredCategory(
    "Gifting",
    "gifting",
    "/categories/gifting-cover.png",
    ["gift", "gifting", "present", "celebration", "occasion"],
    15,
  ),
  featuredCategory(
    "Jewelry / Accessories",
    "jewelry-accessories",
    "/categories/jewelry-accessories.png",
    [
      "jewelry",
      "jewellery",
      "accessory",
      "accessories",
      "necklace",
      "earring",
      "ring",
      "bracelet",
      "clutch",
      "scarf",
    ],
    16,
  ),
];

export function mergeFeaturedCategories(
  categories: BrowseCategory[],
): BrowseCategory[] {
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));

  return FEATURED_CATEGORY_CATALOG.map((category) => {
    const existing = categoryBySlug.get(category.slug);
    return existing ? { ...existing, ...category, id: existing.id } : category;
  });
}

export function mergeBrowseCategories(categories: BrowseCategory[]): BrowseCategory[] {
  const featured = mergeFeaturedCategories(categories);
  const featuredSlugs = new Set(featured.map((category) => category.slug));
  const additional = categories
    .filter((category) => category.slug !== "more" && !featuredSlugs.has(category.slug) && !RETIRED_BROWSE_CATEGORY_SLUGS.has(category.slug))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  return [...featured, ...additional];
}

export function getBrowseCategory(
  slug: string,
  categories: BrowseCategory[],
): BrowseCategory | null {
  if (RETIRED_BROWSE_CATEGORY_SLUGS.has(slug)) return null;
  const existing = categories.find((category) => category.slug === slug);
  const catalogCategory = FEATURED_CATEGORY_CATALOG.find(
    (category) => category.slug === slug,
  );

  if (catalogCategory) {
    return existing
      ? { ...existing, ...catalogCategory, id: existing.id }
      : catalogCategory;
  }

  return existing ?? null;
}
