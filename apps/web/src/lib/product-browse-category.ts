import type { BrowseCategory } from "@/lib/browse-categories";

type CategoryMatchProduct = {
  title: string;
  description?: string | null;
  category?: { slug: string } | null;
};

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
  "casual-wear",
  "office-wear",
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
      return product.category?.slug === "jewelry" || product.category?.slug === "accessories";

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

    case "casual-wear":
      return matchesSearchTerms && !text.includes("chikankari");

    case "office-wear":
      return (
        title !== "midnight sequin gown" &&
        includesAny(text, ["office", "workwear", "work wear"])
      );

    case "tops":
      return false;

    default:
      return matchesSearchTerms;
  }
}
