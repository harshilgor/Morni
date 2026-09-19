import type { BulkVisionImageInput, InternalImageRef } from "./types";

/** Assign stable internal IDs independent of filenames. */
export function assignInternalImageIds(
  images: BulkVisionImageInput[],
): InternalImageRef[] {
  return images.map((image, index) => ({
    internalId: `img_${String(index + 1).padStart(3, "0")}`,
    clientId: image.id,
    originalFilename: image.name,
    index,
  }));
}

export type IdAliasMap = {
  refs: InternalImageRef[];
  byInternalId: Map<string, InternalImageRef>;
  byClientId: Map<string, InternalImageRef>;
  /** Lowercased aliases → internalId. Only unambiguous aliases are included. */
  aliases: Map<string, string>;
};

function addAlias(map: Map<string, string>, alias: string, internalId: string) {
  const key = alias.trim().toLowerCase();
  if (!key) return;
  const existing = map.get(key);
  if (existing && existing !== internalId) {
    map.delete(key);
    return;
  }
  map.set(key, internalId);
}

/** Build deterministic alias table for recovering non-canonical model IDs. */
export function buildIdAliasMap(refs: InternalImageRef[]): IdAliasMap {
  const aliases = new Map<string, string>();
  const byInternalId = new Map<string, InternalImageRef>();
  const byClientId = new Map<string, InternalImageRef>();

  for (const ref of refs) {
    byInternalId.set(ref.internalId, ref);
    byClientId.set(ref.clientId, ref);

    addAlias(aliases, ref.internalId, ref.internalId);
    addAlias(aliases, `img_${ref.index + 1}`, ref.internalId);
    addAlias(aliases, `img${ref.index + 1}`, ref.internalId);
    addAlias(aliases, `photo_${ref.index + 1}`, ref.internalId);
    addAlias(aliases, `photo${ref.index + 1}`, ref.internalId);
    addAlias(aliases, `image_${ref.index + 1}`, ref.internalId);
    addAlias(aliases, `image${ref.index + 1}`, ref.internalId);
    addAlias(aliases, String(ref.index + 1), ref.internalId);
    addAlias(aliases, ref.clientId, ref.internalId);
  }

  return { refs, byInternalId, byClientId, aliases };
}

export type ReconcileIdResult =
  | { ok: true; internalId: string; matchedVia: string }
  | { ok: false; raw: string; reason: string };

/**
 * Reconcile a model-returned image identifier to an internal ID.
 * Never silently maps ambiguous values.
 */
export function reconcileImageId(
  raw: string,
  aliasMap: IdAliasMap,
): ReconcileIdResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, raw, reason: "empty_id" };
  }

  const direct = aliasMap.aliases.get(trimmed.toLowerCase());
  if (direct) {
    return { ok: true, internalId: direct, matchedVia: "alias" };
  }

  // PHOTO_1 / IMG_001 / Image 2 with separators
  const labeled = trimmed.match(
    /^(?:photo|image|img)[\s_\-#.:]*0*(\d+)$/i,
  );
  if (labeled) {
    const index = Number(labeled[1]);
    const viaLabel = aliasMap.aliases.get(String(index));
    if (viaLabel) {
      return { ok: true, internalId: viaLabel, matchedVia: "labeled_index" };
    }
  }

  return { ok: false, raw, reason: "unknown_id" };
}

export type ReconcileIdListResult = {
  resolved: string[];
  rejected: Array<{ raw: string; reason: string }>;
  duplicatesDropped: string[];
};

/** Reconcile a list of IDs, dropping unknowns/duplicates without discarding the whole group. */
export function reconcileImageIdList(
  rawIds: string[],
  aliasMap: IdAliasMap,
  alreadySeen?: Set<string>,
): ReconcileIdListResult {
  const seen = alreadySeen ?? new Set<string>();
  const resolved: string[] = [];
  const rejected: Array<{ raw: string; reason: string }> = [];
  const duplicatesDropped: string[] = [];

  for (const raw of rawIds) {
    const result = reconcileImageId(raw, aliasMap);
    if (!result.ok) {
      rejected.push({ raw: result.raw, reason: result.reason });
      continue;
    }
    if (seen.has(result.internalId)) {
      duplicatesDropped.push(result.internalId);
      continue;
    }
    seen.add(result.internalId);
    resolved.push(result.internalId);
  }

  return { resolved, rejected, duplicatesDropped };
}

export function internalIdsToClientIds(
  internalIds: string[],
  aliasMap: IdAliasMap,
): string[] {
  return internalIds
    .map((id) => aliasMap.byInternalId.get(id)?.clientId)
    .filter((id): id is string => Boolean(id));
}
