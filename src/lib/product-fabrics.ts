export const PRODUCT_FABRICS = [
  "Cotton", "Chiffon", "Georgette", "Organza", "Silk", "Mul Cotton",
  "Satin", "Denim", "Jute", "Lawn", "Printed Lawn", "Embroidered Lawn",
  "Jacquard", "Banarasi", "Sequins", "Crepe", "Mul Chanderi", "Crepe Silk",
  "Muslin", "Chinon", "Linen Cotton", "German Rayon", "Kota Doriya", "Synthetic",
] as const;

export type ProductFabric = (typeof PRODUCT_FABRICS)[number];

export function isProductFabric(value: unknown): value is ProductFabric {
  return typeof value === "string" && (PRODUCT_FABRICS as readonly string[]).includes(value);
}
