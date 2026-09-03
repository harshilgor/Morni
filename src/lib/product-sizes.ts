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
