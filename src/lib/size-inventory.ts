export type SizeStock = Record<string, number>;

export function totalSizeStock(sizeStock: SizeStock) {
  return Object.values(sizeStock).reduce((total, quantity) => total + Math.max(0, Number(quantity) || 0), 0);
}

export function normalizeSizeStock(sizes: string[], sizeStock: SizeStock = {}) {
  return Object.fromEntries(
    sizes.map((size) => [size.trim(), Math.max(0, Number(sizeStock[size]) || 0)]).filter(([size]) => Boolean(size)),
  ) as SizeStock;
}
