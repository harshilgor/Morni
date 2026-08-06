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

export type ColorDraft = {
  key: string;
  id?: string;
  color_name: string;
  color_hex: string;
  sizes: string[];
  stock: string;
  images: ColorDraftImage[];
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
    sizes: partial?.sizes?.length ? [...partial.sizes] : ["S", "M", "L"],
    stock: partial?.stock ?? "10",
    images: partial?.images ? [...partial.images] : [],
  };
}

export function colorDraftFromProduct(product: {
  image_urls?: string[] | null;
  sizes?: string[] | null;
  stock?: number | null;
}): ColorDraft {
  return createColorDraft({
    color_name: "Default",
    color_hex: "#c45b7a",
    sizes: product.sizes?.length ? [...product.sizes] : ["S", "M", "L"],
    stock: String(product.stock ?? 0),
    images: (product.image_urls ?? []).map((url, index) => ({
      id: `existing-${index}-${url}`,
      url,
      existing: true,
    })),
  });
}

export function aggregateFromColorDrafts(drafts: ColorDraft[]) {
  const imageUrls = drafts.flatMap((draft) =>
    draft.images.map((image) => image.url).filter(Boolean),
  );
  const sizes = [
    ...new Set(drafts.flatMap((draft) => draft.sizes).filter(Boolean)),
  ];
  const stock = drafts.reduce((sum, draft) => sum + (Number(draft.stock) || 0), 0);
  return {
    image_urls: imageUrls.slice(0, Math.max(imageUrls.length, 1)),
    sizes: sizes.length ? sizes : ["S", "M", "L"],
    stock,
  };
}

export function validateColorDrafts(drafts: ColorDraft[]) {
  if (drafts.length === 0) return null;
  const names = new Set<string>();
  for (const draft of drafts) {
    const name = draft.color_name.trim();
    if (!name) return "Every color needs a name.";
    const key = name.toLowerCase();
    if (names.has(key)) return `Duplicate color name: ${name}`;
    names.add(key);
    if (draft.sizes.length === 0) {
      return `Add at least one size for ${name}.`;
    }
    const stock = Number(draft.stock);
    if (!Number.isFinite(stock) || stock < 0) {
      return `Enter a valid stock for ${name}.`;
    }
    if (draft.images.length === 0) {
      return `Add at least one image for ${name}.`;
    }
  }
  return null;
}
