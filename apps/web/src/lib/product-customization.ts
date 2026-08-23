export type ProductCustomizationField = {
  id: string;
  label: string;
  unit: string;
  required: boolean;
};

export type ProductCustomizationConfig = {
  enabled: boolean;
  instructions: string;
  fields: ProductCustomizationField[];
};

export type ProductCustomizationValues = Record<string, string>;

export const CUSTOMIZATION_FIELD_OPTIONS: ProductCustomizationField[] = [
  { id: "bust", label: "Bust", unit: "in", required: false },
  { id: "waist", label: "Waist", unit: "in", required: false },
  { id: "hip", label: "Hip", unit: "in", required: false },
  { id: "blouse_length", label: "Blouse length", unit: "in", required: false },
  { id: "shoulder", label: "Shoulder", unit: "in", required: false },
  { id: "sleeve_length", label: "Sleeve length", unit: "in", required: false },
  { id: "petticoat_length", label: "Petticoat length", unit: "in", required: false },
];

export function defaultCustomizationConfig(): ProductCustomizationConfig {
  return {
    enabled: false,
    instructions: "Share your measurements in inches. We will confirm the final fit with you before stitching.",
    fields: [
      { ...CUSTOMIZATION_FIELD_OPTIONS[0] },
      { ...CUSTOMIZATION_FIELD_OPTIONS[1] },
      { ...CUSTOMIZATION_FIELD_OPTIONS[3] },
    ],
  };
}

export function customizationConfigFromProduct(product: {
  customization_enabled?: boolean | null;
  customization_instructions?: string | null;
  customization_fields?: unknown;
}): ProductCustomizationConfig {
  const fallback = defaultCustomizationConfig();
  const fields = Array.isArray(product.customization_fields)
    ? product.customization_fields.filter(isCustomizationField).slice(0, 8)
    : fallback.fields;

  return {
    enabled: Boolean(product.customization_enabled),
    instructions: product.customization_instructions?.trim() || fallback.instructions,
    fields: fields.length ? fields : fallback.fields,
  };
}

export function sanitizeCustomizationValues(value: unknown): ProductCustomizationValues {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => typeof item === "string" && item.trim())
      .slice(0, 20)
      .map(([key, item]) => [key.slice(0, 60), String(item).trim().slice(0, 40)]),
  );
}

export function validateCustomizationValues(
  config: ProductCustomizationConfig,
  values: ProductCustomizationValues,
) {
  if (!config.enabled) return null;
  for (const field of config.fields) {
    if (field.required && !values[field.id]?.trim()) {
      return `Add your ${field.label.toLowerCase()} measurement to continue.`;
    }
  }
  for (const value of Object.values(values)) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || number > 200) {
      return "Enter measurements as numbers between 0 and 200.";
    }
  }
  return null;
}

export function formatCustomizationValues(
  config: ProductCustomizationConfig | null | undefined,
  values: ProductCustomizationValues | null | undefined,
) {
  if (!values) return [];
  const fields = config?.fields ?? [];
  return Object.entries(values)
    .map(([id, value]) => {
      const field = fields.find((candidate) => candidate.id === id) ?? CUSTOMIZATION_FIELD_OPTIONS.find((candidate) => candidate.id === id);
      return { label: field?.label ?? id, value: `${value}${field?.unit ? ` ${field.unit}` : ""}` };
    })
    .filter((item) => item.value.trim());
}

function isCustomizationField(value: unknown): value is ProductCustomizationField {
  if (!value || typeof value !== "object") return false;
  const field = value as Partial<ProductCustomizationField>;
  return Boolean(field.id && field.label && typeof field.unit === "string");
}
