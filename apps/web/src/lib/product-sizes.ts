export const PRODUCT_SIZES = [
  "Free Size",
  "S",
  "M",
  "L",
  "XL",
  "2XL",
  "3XL",
  "4XL",
] as const;

export type ProductSize = (typeof PRODUCT_SIZES)[number];

export const KIDS_CLOTHING_SIZES = [
  "0-3M",
  "3-6M",
  "6-12M",
  "12-18M",
  "18-24M",
  "2-3Y",
  "3-4Y",
  "4-5Y",
  "5-6Y",
  "6-7Y",
  "7-8Y",
  "8-9Y",
  "9-10Y",
  "10-11Y",
  "11-12Y",
  "12-13Y",
] as const;

export function productSizesForCategory(categorySlug: string) {
  return categorySlug === "kids" ? KIDS_CLOTHING_SIZES : PRODUCT_SIZES;
}

export function defaultProductSizesForCategory(categorySlug: string) {
  return categorySlug === "kids"
    ? ["2-3Y", "4-5Y", "6-7Y"]
    : ["S", "M", "L"];
}
