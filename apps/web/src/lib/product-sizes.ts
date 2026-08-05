export const PRODUCT_SIZES = [
  "XXS",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "3XL",
  "Free Size",
] as const;

export type ProductSize = (typeof PRODUCT_SIZES)[number];

