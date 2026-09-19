const PLACEHOLDER_TITLES = new Set([
  "new product",
  "new products",
  "product",
  "products",
  "untitled",
  "untitled product",
  "image",
  "images",
  "photo",
  "photos",
  "item",
  "listing",
  "ai details couldn't be generated",
]);

const CAMERA_PREFIX =
  /^(?:img|dsc|dcim|pict|photo|image|screenshot|whatsapp(?:\s+image)?|screen\s*shot)[\s_\-]*/i;

const UUID_LIKE =
  /^[0-9a-f]{8}(?:[-\s_]?[0-9a-f]{4}){3}[-\s_]?[0-9a-f]{8,12}[0-9a-z]?$/i;

const HEX_BLOB = /^[0-9a-f]{16,}$/i;

const INTERNAL_ID = /^(?:img|photo|image)[_\-\s]?\d+$/i;

const TIMESTAMPISH =
  /^(?:screenshot|whatsapp(?:\s+image)?|img|dsc)?[\s_\-]*\d{4}[-_\s.]?\d{2}[-_\s.]?\d{2}/i;

function normalizeComparable(value: string) {
  return value
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function filenameStem(filename: string) {
  return filename.replace(/\.[^.]+$/, "").trim();
}

export type TitleValidationResult =
  | { ok: true; title: string }
  | { ok: false; reason: string };

/**
 * Validate that a model-generated title is safe to show as a product name.
 * Filenames and machine IDs must never pass.
 */
export function isValidGeneratedTitle(
  title: string | null | undefined,
  options?: {
    sourceFilenames?: string[];
    internalIds?: string[];
  },
): TitleValidationResult {
  const raw = (title ?? "").trim();
  if (!raw) return { ok: false, reason: "empty" };
  if (raw.length < 3) return { ok: false, reason: "too_short" };
  if (raw.length > 120) return { ok: false, reason: "too_long" };

  const lower = raw.toLowerCase();
  if (PLACEHOLDER_TITLES.has(lower)) return { ok: false, reason: "placeholder" };
  if (/^product\s+\d+$/i.test(raw)) return { ok: false, reason: "placeholder_product_n" };

  const compact = raw.replace(/\s+/g, " ").trim();
  if (UUID_LIKE.test(compact)) return { ok: false, reason: "uuid_like" };
  if (HEX_BLOB.test(compact.replace(/[\s\-_]/g, ""))) return { ok: false, reason: "hex_identifier" };
  if (INTERNAL_ID.test(compact)) return { ok: false, reason: "internal_id" };
  if (CAMERA_PREFIX.test(compact) && /\d{3,}/.test(compact)) {
    return { ok: false, reason: "camera_filename" };
  }
  if (TIMESTAMPISH.test(compact)) return { ok: false, reason: "timestamp_filename" };
  if (/^[0-9a-f]{8}(?:[\s\-][0-9a-f]{4}){2,}/i.test(compact)) {
    return { ok: false, reason: "uuid_like" };
  }

  // Mostly digits / hex tokens → machine id
  const tokens = compact.split(/[\s\-_]+/).filter(Boolean);
  if (
    tokens.length >= 3 &&
    tokens.every((token) => /^[0-9a-f]+$/i.test(token) && token.length >= 3)
  ) {
    return { ok: false, reason: "hex_token_sequence" };
  }

  const titleComparable = normalizeComparable(raw);
  for (const filename of options?.sourceFilenames ?? []) {
    const stem = filenameStem(filename);
    if (!stem) continue;
    const stemComparable = normalizeComparable(stem);
    if (!stemComparable || stemComparable !== titleComparable) continue;
    // Only reject filename clones when the filename itself is machine-like.
    // Descriptive filenames like "black-embroidered-anarkali.jpg" may legitimately
    // match a good vision title and must not force a false failure.
    const stemAsTitle = isValidGeneratedTitle(stem.replace(/[-_]+/g, " "));
    if (!stemAsTitle.ok) {
      return { ok: false, reason: "matches_filename" };
    }
  }

  for (const id of options?.internalIds ?? []) {
    if (normalizeComparable(id) === titleComparable) {
      return { ok: false, reason: "matches_internal_id" };
    }
  }

  // Reject if title has no letters (pure symbols/digits)
  if (!/[a-z]/i.test(raw)) return { ok: false, reason: "no_letters" };

  return { ok: true, title: compact };
}

/** Neutral seller-facing placeholder — never derived from a filename. */
export function manualProductTitle(index: number) {
  return `Product ${index + 1}`;
}
