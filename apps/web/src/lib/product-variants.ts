export const COLOR_SWATCHES = [
  { label: "Black", hex: "#1c1418" },
  { label: "White", hex: "#ffffff" },
  { label: "Ivory", hex: "#f4ead9" },
  { label: "Beige", hex: "#e3d3bd" },
  { label: "Brown", hex: "#7a5230" },
  { label: "Red", hex: "#c0392b" },
  { label: "Maroon", hex: "#7b2733" },
  { label: "Pink", hex: "#e58fa8" },
  { label: "Peach", hex: "#f6c7a8" },
  { label: "Orange", hex: "#e07a2f" },
  { label: "Yellow", hex: "#e8c33c" },
  { label: "Gold", hex: "#c8a24a" },
  { label: "Green", hex: "#3f7d55" },
  { label: "Olive", hex: "#6b7a3a" },
  { label: "Teal", hex: "#2f6f66" },
  { label: "Blue", hex: "#33578f" },
  { label: "Navy", hex: "#23335c" },
  { label: "Purple", hex: "#6b4a8f" },
  { label: "Lavender", hex: "#b9a6d6" },
  { label: "Grey", hex: "#8c8c8c" },
  { label: "Silver", hex: "#c0c4c8" },
] as const;

export type ColorDraftImage = {
  id: string;
  url: string;
  file?: File;
  existing?: boolean;
};

export type ColorDraftVideo = {
  id: string;
  url: string;
  file?: File;
  existing?: boolean;
};

export type ColorDraft = {
  key: string;
  id?: string;
  color_name: string;
  color_hex: string;
  sizes: string[];
  stock: string;
  size_stock: Record<string, number>;
  inventory_mode: "exact" | "legacy";
  images: ColorDraftImage[];
  videos: ColorDraftVideo[];
};

export function createColorDraft(
  partial?: Partial<ColorDraft> & { images?: ColorDraftImage[] },
): ColorDraft {
  return {
    key:
      partial?.key ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `color-${Date.now()}-${Math.random().toString(36).slice(2)}`),
    id: partial?.id,
    color_name: partial?.color_name ?? "",
    color_hex: partial?.color_hex ?? "#c45b7a",
    sizes: partial?.sizes?.length ? [...partial.sizes] : [],
    stock: partial?.stock ?? "10",
    size_stock: partial?.size_stock ?? Object.fromEntries((partial?.sizes ?? []).map((size) => [size, 0])),
    inventory_mode: partial?.inventory_mode ?? "exact",
    images: partial?.images ? [...partial.images] : [],
    videos: partial?.videos ? [...partial.videos] : [],
  };
}

export function colorDraftFromProduct(product: {
  image_urls?: string[] | null;
  sizes?: string[] | null;
  stock?: number | null;
  size_stock?: Record<string, number> | null;
}): ColorDraft {
  return createColorDraft({
    color_name: "Default",
    color_hex: "#c45b7a",
    sizes: product.sizes?.length ? [...product.sizes] : ["S", "M", "L"],
    stock: String(product.stock ?? 0),
    size_stock: product.size_stock ?? {},
    inventory_mode: product.size_stock && Object.keys(product.size_stock).length ? "exact" : "legacy",
    images: (product.image_urls ?? []).map((url, index) => ({
      id: `existing-${index}-${url}`,
      url,
      existing: true,
    })),
  });
}

export function colorDraftFromVariant(variant: {
  id: string;
  color_name: string;
  color_hex?: string | null;
  image_urls?: string[] | null;
  video_urls?: string[] | null;
  sizes?: string[] | null;
  size_stock?: Record<string, number> | null;
  stock?: number | null;
}): ColorDraft {
  const sizes = variant.sizes?.length ? [...variant.sizes] : [];
  return createColorDraft({
    id: variant.id,
    color_name: variant.color_name,
    color_hex: variant.color_hex ?? "#c45b7a",
    sizes,
    stock: String(variant.stock ?? 0),
    size_stock: variant.size_stock ?? {},
    inventory_mode: variant.size_stock && Object.keys(variant.size_stock).length ? "exact" : "legacy",
    images: (variant.image_urls ?? []).map((url, index) => ({ id: `existing-image-${variant.id}-${index}`, url, existing: true })),
    videos: (variant.video_urls ?? []).map((url, index) => ({ id: `existing-video-${variant.id}-${index}`, url, existing: true })),
  });
}

export function aggregateFromColorDrafts(drafts: ColorDraft[], includeSizes = true) {
  const imageUrls = drafts.flatMap((draft) =>
    draft.images.map((image) => image.url).filter(Boolean),
  );
  const sizes = [
    ...new Set(drafts.flatMap((draft) => draft.sizes).filter(Boolean)),
  ];
  const stock = drafts.reduce((sum, draft) => {
    if (includeSizes && draft.sizes.length > 0 && draft.inventory_mode === "exact") {
      return sum + draft.sizes.reduce((sizeSum, size) => sizeSum + Math.max(0, Number(draft.size_stock[size] ?? 0)), 0);
    }
    return sum + (Number(draft.stock) || 0);
  }, 0);
  const size_stock = drafts.reduce<Record<string, number>>((result, draft) => {
    if (!includeSizes || draft.inventory_mode !== "exact") return result;
    for (const size of draft.sizes) result[size] = (result[size] ?? 0) + Math.max(0, Number(draft.size_stock[size] ?? 0));
    return result;
  }, {});
  return {
    image_urls: imageUrls.slice(0, Math.max(imageUrls.length, 1)),
    sizes: includeSizes ? (sizes.length ? sizes : ["S", "M", "L"]) : [],
    stock,
    size_stock,
  };
}

export function quantityForVariantSize(
  variant: Pick<ProductVariantLike, "size_stock" | "stock">,
  size: string,
) {
  if (variant.size_stock && Object.keys(variant.size_stock).length > 0) {
    return Math.max(0, Number(variant.size_stock[size] ?? 0));
  }
  return null;
}

type ProductVariantLike = {
  size_stock?: Record<string, number> | null;
  stock: number;
};

export function validateColorDrafts(
  drafts: ColorDraft[],
  options: { requireSizes?: boolean } = {},
) {
  const requireSizes = options.requireSizes ?? true;
  if (drafts.length === 0) return null;
  const names = new Set<string>();
  for (const draft of drafts) {
    const name = draft.color_name.trim();
    if (!name) return "Every color needs a name.";
    const key = name.toLowerCase();
    if (names.has(key)) return `Duplicate color name: ${name}`;
    names.add(key);
    if (requireSizes && draft.sizes.length === 0) {
      return `Add at least one size for ${name}.`;
    }
    const stock = Number(draft.stock);
    if (!Number.isFinite(stock) || stock < 0) return `Enter a valid stock for ${name}.`;
    for (const size of draft.sizes) {
      const quantity = Number(draft.size_stock[size] ?? 0);
      if (!Number.isInteger(quantity) || quantity < 0) return `Enter a whole-number quantity for ${name} · ${size}.`;
    }
    if (draft.images.length === 0) {
      return `Add at least one image for ${name}.`;
    }
  }
  return null;
}
