import {
  buildIdAliasMap,
  internalIdsToClientIds,
  reconcileImageIdList,
  type IdAliasMap,
} from "./image-ids";
import { isValidGeneratedTitle, manualProductTitle } from "./title-validation";
import type {
  BulkVisionFailureKind,
  BulkVisionGenerationStatus,
  InternalImageRef,
  RawVisionGroup,
  ValidatedBulkGroup,
} from "./types";

export type NormalizeGroupsInput = {
  refs: InternalImageRef[];
  rawGroups: RawVisionGroup[];
  categorySlugs: Set<string>;
  /** Filenames keyed by internalId — for title rejection only. */
  filenamesByInternalId: Map<string, string>;
};

export type NormalizeGroupsResult = {
  groups: ValidatedBulkGroup[];
  status: BulkVisionGenerationStatus;
  failureKind?: BulkVisionFailureKind;
  missingInternalIds: string[];
  rejectedIds: Array<{ raw: string; reason: string }>;
  duplicateAssignments: string[];
  validationFailures: Array<{ field: string; reason: string; groupIndex: number }>;
};

function emptyColorGroups(imageIds: string[]): ValidatedBulkGroup["colorGroups"] {
  return [
    {
      imageIds,
      colorName: "",
      confidence: 0,
      needsReview: true,
    },
  ];
}

function manualGroup(
  clientImageIds: string[],
  index: number,
  reason: string,
): ValidatedBulkGroup {
  return {
    imageIds: clientImageIds,
    title: "",
    description: "",
    categorySlug: "",
    colorName: "",
    confidence: 0,
    needsReview: true,
    aiGenerated: false,
    generationStatus: "failed",
    failureReason: reason,
    rejectedFields: [{ field: "title", reason }],
    colorGroups: emptyColorGroups(clientImageIds),
  };
}

function mapCategorySlug(
  raw: string | undefined,
  categorySlugs: Set<string>,
): { slug: string; rejected?: string } {
  const value = (raw ?? "").trim();
  if (!value) return { slug: "" };
  if (categorySlugs.has(value)) return { slug: value };
  const lower = value.toLowerCase();
  for (const slug of categorySlugs) {
    if (slug.toLowerCase() === lower) return { slug };
  }
  // Soft match: "Lehenga" → "lehengas"
  const normalized = lower.replace(/[^a-z0-9]+/g, "");
  for (const slug of categorySlugs) {
    const slugNorm = slug.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (
      slugNorm === normalized ||
      slugNorm === `${normalized}s` ||
      `${slugNorm}s` === normalized
    ) {
      return { slug };
    }
  }
  return { slug: "", rejected: "unknown_category" };
}

function validateListingFields(
  group: RawVisionGroup,
  internalIds: string[],
  filenames: string[],
  categorySlugs: Set<string>,
  groupIndex: number,
): {
  title: string;
  description: string;
  categorySlug: string;
  colorName: string;
  aiGenerated: boolean;
  generationStatus: BulkVisionGenerationStatus;
  failureReason?: string;
  rejectedFields: Array<{ field: string; reason: string }>;
  validationFailures: Array<{ field: string; reason: string; groupIndex: number }>;
} {
  const rejectedFields: Array<{ field: string; reason: string }> = [];
  const validationFailures: Array<{ field: string; reason: string; groupIndex: number }> = [];

  const titleCheck = isValidGeneratedTitle(group.title, {
    sourceFilenames: filenames,
    internalIds,
  });
  let title = "";
  let aiGenerated = false;
  if (titleCheck.ok) {
    title = titleCheck.title;
    aiGenerated = true;
  } else {
    rejectedFields.push({ field: "title", reason: titleCheck.reason });
    validationFailures.push({ field: "title", reason: titleCheck.reason, groupIndex });
  }

  const description = (group.description ?? "").trim();
  // Description is optional advice — keep if non-empty and not filename-like
  let safeDescription = description;
  if (description) {
    const descAsTitle = isValidGeneratedTitle(description.slice(0, 120), {
      sourceFilenames: filenames,
      internalIds,
    });
    // Only reject if the whole description is clearly a machine id
    if (
      !descAsTitle.ok &&
      ["uuid_like", "hex_identifier", "matches_filename", "camera_filename"].includes(
        descAsTitle.reason,
      ) &&
      description.length < 80
    ) {
      safeDescription = "";
      rejectedFields.push({ field: "description", reason: descAsTitle.reason });
      validationFailures.push({
        field: "description",
        reason: descAsTitle.reason,
        groupIndex,
      });
    }
  }

  const category = mapCategorySlug(group.categorySlug, categorySlugs);
  if (category.rejected) {
    rejectedFields.push({ field: "categorySlug", reason: category.rejected });
    validationFailures.push({
      field: "categorySlug",
      reason: category.rejected,
      groupIndex,
    });
  }

  const colorName = (group.colorName ?? "").trim().slice(0, 40);
  const generationStatus: BulkVisionGenerationStatus = title
    ? category.slug
      ? "ok"
      : "partial"
    : "failed";

  return {
    title,
    description: safeDescription,
    categorySlug: category.slug,
    colorName,
    aiGenerated,
    generationStatus,
    failureReason: title ? undefined : "invalid_or_missing_title",
    rejectedFields,
    validationFailures,
  };
}

/**
 * Parse → reconcile IDs → validate listing fields.
 * Never discards a whole response because one ID is bad.
 * Missing images become explicit manual groups (not filename titles).
 */
export function normalizeVisionGroups(
  input: NormalizeGroupsInput,
): NormalizeGroupsResult {
  const aliasMap = buildIdAliasMap(input.refs);
  const globalSeen = new Set<string>();
  const rejectedIds: Array<{ raw: string; reason: string }> = [];
  const duplicateAssignments: string[] = [];
  const validationFailures: Array<{ field: string; reason: string; groupIndex: number }> =
    [];
  const groups: ValidatedBulkGroup[] = [];

  input.rawGroups.forEach((rawGroup, groupIndex) => {
    const reconciled = reconcileImageIdList(
      rawGroup.imageIds ?? [],
      aliasMap,
      globalSeen,
    );
    rejectedIds.push(...reconciled.rejected);
    duplicateAssignments.push(...reconciled.duplicatesDropped);

    if (!reconciled.resolved.length) return;

    const clientIds = internalIdsToClientIds(reconciled.resolved, aliasMap);
    const filenames = reconciled.resolved
      .map((id) => input.filenamesByInternalId.get(id) ?? "")
      .filter(Boolean);

    const listing = validateListingFields(
      rawGroup,
      reconciled.resolved,
      filenames,
      input.categorySlugs,
      groupIndex,
    );
    validationFailures.push(...listing.validationFailures);

    const colorGroups = normalizeColorGroups(
      rawGroup.colorGroups,
      reconciled.resolved,
      aliasMap,
    );

    groups.push({
      imageIds: clientIds,
      title: listing.title,
      description: listing.description,
      categorySlug: listing.categorySlug,
      colorName: listing.colorName,
      confidence:
        typeof rawGroup.confidence === "number"
          ? Math.min(1, Math.max(0, rawGroup.confidence))
          : listing.aiGenerated
            ? 0.5
            : 0,
      needsReview:
        Boolean(rawGroup.needsReview) ||
        listing.generationStatus !== "ok" ||
        !listing.title,
      aiGenerated: listing.aiGenerated,
      generationStatus: listing.generationStatus,
      failureReason: listing.failureReason,
      rejectedFields: listing.rejectedFields.length
        ? listing.rejectedFields
        : undefined,
      colorGroups: colorGroups.length
        ? colorGroups.map((cg) => ({
            ...cg,
            imageIds: internalIdsToClientIds(cg.imageIds, aliasMap),
          }))
        : emptyColorGroups(clientIds),
    });
  });

  const covered = new Set(
    groups.flatMap((group) =>
      group.imageIds
        .map((clientId) => aliasMap.byClientId.get(clientId)?.internalId)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const missingInternalIds = input.refs
    .filter((ref) => !covered.has(ref.internalId))
    .map((ref) => ref.internalId);

  missingInternalIds.forEach((internalId, index) => {
    const ref = aliasMap.byInternalId.get(internalId);
    if (!ref) return;
    groups.push(
      manualGroup(
        [ref.clientId],
        groups.length + index,
        "image_not_assigned_by_model",
      ),
    );
  });

  // Ensure every group has a displayable index-friendly empty title state
  // (UI shows "Product N" label separately; title field stays empty until valid).
  void manualProductTitle;

  const anyAi = groups.some((group) => group.aiGenerated);
  const anyFailed = groups.some((group) => group.generationStatus === "failed");
  const incomplete = missingInternalIds.length > 0;
  const hadRejects = rejectedIds.length > 0;

  let status: BulkVisionGenerationStatus = "ok";
  let failureKind: BulkVisionFailureKind | undefined;

  if (!anyAi && groups.every((group) => group.generationStatus === "failed")) {
    status = "failed";
    failureKind = incomplete
      ? "incomplete_coverage"
      : hadRejects
        ? "id_reconciliation_failure"
        : "validation_failure";
  } else if (anyFailed || incomplete || validationFailures.length > 0) {
    status = "partial";
    if (incomplete) failureKind = "incomplete_coverage";
    else if (hadRejects && !anyAi) failureKind = "id_reconciliation_failure";
    else if (validationFailures.length) failureKind = "validation_failure";
  }

  return {
    groups,
    status,
    failureKind,
    missingInternalIds,
    rejectedIds,
    duplicateAssignments,
    validationFailures,
  };
}

function normalizeColorGroups(
  colorGroups: RawVisionGroup["colorGroups"],
  allowedInternalIds: string[],
  aliasMap: IdAliasMap,
) {
  if (!colorGroups?.length) return [];
  const allowed = new Set(allowedInternalIds);
  const seen = new Set<string>();
  const result: Array<{
    imageIds: string[];
    colorName: string;
    confidence: number;
    needsReview: boolean;
  }> = [];

  for (const colorGroup of colorGroups) {
    const reconciled = reconcileImageIdList(colorGroup.imageIds ?? [], aliasMap, seen);
    const imageIds = reconciled.resolved.filter((id) => allowed.has(id));
    if (!imageIds.length) continue;
    result.push({
      imageIds,
      colorName: (colorGroup.colorName ?? "").trim().slice(0, 40),
      confidence:
        typeof colorGroup.confidence === "number"
          ? Math.min(1, Math.max(0, colorGroup.confidence))
          : 0,
      needsReview: Boolean(colorGroup.needsReview) || !colorGroup.colorName?.trim(),
    });
  }

  const colourCovered = new Set(result.flatMap((group) => group.imageIds));
  const missing = allowedInternalIds.filter((id) => !colourCovered.has(id));
  if (missing.length) {
    result.push({
      imageIds: missing,
      colorName: "",
      confidence: 0,
      needsReview: true,
    });
  }

  return result;
}

/** Explicit failure groups — one product per image, no filename titles. */
export function explicitFailureGroups(
  refs: InternalImageRef[],
  reason: string,
): ValidatedBulkGroup[] {
  return refs.map((ref, index) =>
    manualGroup([ref.clientId], index, reason),
  );
}

export function statusWarning(
  status: BulkVisionGenerationStatus,
  failureKind?: BulkVisionFailureKind,
): string | undefined {
  if (status === "ok") return undefined;
  if (status === "failed") {
    if (failureKind === "provider_timeout") {
      return "AI analysis timed out. Product rows were created for manual review — titles were not generated from filenames.";
    }
    if (failureKind === "provider_error") {
      return "AI analysis was unavailable. Product rows were created for manual review.";
    }
    if (failureKind === "parser_failure") {
      return "AI returned an unreadable response. Product rows were created for manual review.";
    }
    return "AI details couldn't be generated. Edit each product manually or retry AI.";
  }
  return "AI finished with some gaps. Review empty titles, categories, and flagged products before publishing.";
}
