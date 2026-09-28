export const PRODUCT_OCCASION_VALUES = ["diwali", "karwa-chauth", "navratri"] as const;

export type ProductOccasion = (typeof PRODUCT_OCCASION_VALUES)[number];

export const PRODUCT_OCCASIONS = [
  { value: PRODUCT_OCCASION_VALUES[0], label: "Diwali" },
  { value: PRODUCT_OCCASION_VALUES[1], label: "Karwa Chauth" },
  { value: PRODUCT_OCCASION_VALUES[2], label: "Navratri" },
] as const;

export function isProductOccasion(value: string): value is ProductOccasion {
  return PRODUCT_OCCASIONS.some((occasion) => occasion.value === value);
}

export function productOccasionLabel(value: string | null | undefined) {
  return PRODUCT_OCCASIONS.find((occasion) => occasion.value === value)?.label ?? null;
}
