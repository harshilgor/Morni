import type { BrowseCategory } from "@/lib/browse-categories";

type CategoryMatchProduct = {
  title: string;
  description?: string | null;
  category?: { slug?: string | null } | null;
};

const CLOTHING_TERMS = [
  "abaya", "anarkali", "blazer", "coord", "co ord", "dress", "gown",
  "jacket", "kaftan", "kurta", "kurti", "lehenga", "pant", "saree",
  "sari", "salwar", "set", "sharara", "shirt", "skirt", "top", "trouser",
];

type CategoryMatchInput = Pick<BrowseCategory, "slug"> & {
  search_terms?: string[] | null;
};

const CUSTOM_CATEGORY_SLUGS = new Set([
  "sarees",
  "kurtis",
  "shararas",
  "salwar-kameez",
  "sets",
  "party-wear",
  "tops",
]);

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(normalize(term)));
}

export function isJewelryOrAccessoryProduct(product: CategoryMatchProduct) {
  const categorySlug = normalize(product.category?.slug ?? "");
  if (categorySlug !== "jewelry" && categorySlug !== "accessories") return false;
  const text = normalize(`${product.title} ${product.description ?? ""}`);
  return !includesAny(text, CLOTHING_TERMS);
}

export function hasCustomBrowseCategoryRules(slug: string) {
  return CUSTOM_CATEGORY_SLUGS.has(slug);
}

export function productMatchesBrowseCategory(
  category: CategoryMatchInput,
  product: CategoryMatchProduct,
) {
  const title = normalize(product.title);
  const text = normalize(`${product.title} ${product.description ?? ""}`);
  const matchesSearchTerms = includesAny(text, category.search_terms ?? []);

  switch (category.slug) {
    case "jewelry-accessories":
      return isJewelryOrAccessoryProduct(product);

    case "sarees":
      return (
        matchesSearchTerms &&
        title !== "noir one shoulder co ord" &&
        !title.includes("loom buti")
      );

    case "kurtis":
      if (title === "ladies long kurta set") return true;
      if (title === "rayon short kurti") return false;
      return title.includes("kurti") && !(title.includes("chikankari") && title.includes("set"));

    case "shararas":
      return matchesSearchTerms && title !== "ladies long kurta set";

    case "salwar-kameez":
      return matchesSearchTerms && title !== "anarkali suit";

    case "sets":
      return title === "noir one shoulder co ord";

    case "party-wear":
      return matchesSearchTerms && title !== "crimson pearl chikankari set";

    case "tops":
      return false;

    default:
      return matchesSearchTerms;
  }
}
