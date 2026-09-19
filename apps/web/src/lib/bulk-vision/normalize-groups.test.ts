import { describe, expect, it } from "vitest";
import { assignInternalImageIds } from "@/lib/bulk-vision/image-ids";
import {
  explicitFailureGroups,
  normalizeVisionGroups,
} from "@/lib/bulk-vision/normalize-groups";

const images = [
  { id: "c1", name: "e2f7a6ae-64b0-4bdd-a627-7c092b40e0bt.jpg", data: "x" },
  { id: "c2", name: "IMG_1234.jpg", data: "x" },
  { id: "c3", name: "front-view.jpg", data: "x" },
  { id: "c4", name: "side-view.jpg", data: "x" },
];

function setup() {
  const refs = assignInternalImageIds(images);
  const filenamesByInternalId = new Map(
    refs.map((ref) => [ref.internalId, ref.originalFilename]),
  );
  const categorySlugs = new Set(["lehengas", "sarees", "anarkalis", "kurtis"]);
  return { refs, filenamesByInternalId, categorySlugs };
}

describe("normalizeVisionGroups", () => {
  it("accepts a valid multi-view grouping with real titles", () => {
    const ctx = setup();
    const result = normalizeVisionGroups({
      ...ctx,
      rawGroups: [
        {
          imageIds: ["img_001", "img_002"],
          title: "Embroidered Pink Sharara Set",
          description: "A festive pink sharara set with visible embroidery across the bodice and flared pants.",
          categorySlug: "kurtis",
          confidence: 0.9,
          needsReview: false,
          colorGroups: [],
        },
        {
          imageIds: ["img_003", "img_004"],
          title: "Black Embroidered Anarkali",
          description: "A black anarkali with embroidered panels and a flowing silhouette.",
          categorySlug: "anarkalis",
          confidence: 0.85,
          needsReview: false,
          colorGroups: [],
        },
      ],
    });
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0]?.title).toBe("Embroidered Pink Sharara Set");
    expect(result.groups[0]?.imageIds).toEqual(["c1", "c2"]);
    expect(result.groups[0]?.aiGenerated).toBe(true);
    expect(result.groups[0]?.categorySlug).toBe("kurtis");
    expect(result.groups[1]?.categorySlug).toBe("anarkalis");
    expect(result.missingInternalIds).toEqual([]);
    expect(result.status).toBe("ok");
  });

  it("reconciles PHOTO_N / numeric IDs and does not discard the whole response", () => {
    const ctx = setup();
    const result = normalizeVisionGroups({
      ...ctx,
      rawGroups: [
        {
          imageIds: ["PHOTO_1", "2"],
          title: "Floral Georgette Saree",
          description: "A light georgette saree with a floral print visible across the drape.",
          categorySlug: "sarees",
          confidence: 0.8,
          needsReview: false,
        },
        {
          imageIds: ["unknown-id", "img_003"],
          title: "Mirror Work Navratri Lehenga Set",
          description: "A festive lehenga with mirror work on the blouse and skirt.",
          categorySlug: "lehengas",
          confidence: 0.7,
          needsReview: false,
        },
      ],
    });
    expect(result.groups.some((group) => group.imageIds.includes("c1"))).toBe(true);
    expect(result.groups.some((group) => group.imageIds.includes("c3"))).toBe(true);
    expect(result.rejectedIds.some((item) => item.raw === "unknown-id")).toBe(true);
    // img_004 missing → manual failure group, not filename title
    const missing = result.groups.find((group) => group.imageIds.includes("c4"));
    expect(missing?.title).toBe("");
    expect(missing?.aiGenerated).toBe(false);
    expect(missing?.generationStatus).toBe("failed");
    expect(missing?.failureReason).toBe("image_not_assigned_by_model");
  });

  it("rejects filename/UUID titles and leaves title empty", () => {
    const ctx = setup();
    const result = normalizeVisionGroups({
      ...ctx,
      rawGroups: [
        {
          imageIds: ["img_001"],
          title: "E2f7a6ae 64b0 4bdd A627 7c092b40e0bt",
          description: "",
          categorySlug: "kurtis",
          confidence: 0.5,
          needsReview: true,
        },
      ],
    });
    const group = result.groups.find((item) => item.imageIds.includes("c1"));
    expect(group?.title).toBe("");
    expect(group?.aiGenerated).toBe(false);
    expect(group?.generationStatus).toBe("failed");
    expect(group?.rejectedFields?.some((field) => field.field === "title")).toBe(true);
  });

  it("never uses filenames as titles on total model failure", () => {
    const ctx = setup();
    const groups = explicitFailureGroups(ctx.refs, "provider_timeout");
    expect(groups).toHaveLength(4);
    for (const group of groups) {
      expect(group.title).toBe("");
      expect(group.aiGenerated).toBe(false);
      expect(group.generationStatus).toBe("failed");
      expect(group.failureReason).toBe("provider_timeout");
    }
    expect(groups.map((group) => group.imageIds[0])).toEqual([
      "c1",
      "c2",
      "c3",
      "c4",
    ]);
  });

  it("detects duplicate image assignment across groups", () => {
    const ctx = setup();
    const result = normalizeVisionGroups({
      ...ctx,
      rawGroups: [
        {
          imageIds: ["img_001", "img_002"],
          title: "Floral Georgette Saree",
          description: "A light floral saree with soft drape visible in the photos.",
          categorySlug: "sarees",
        },
        {
          imageIds: ["img_002", "img_003"],
          title: "Black Embroidered Anarkali",
          description: "A black anarkali with embroidery along the neckline.",
          categorySlug: "anarkalis",
        },
      ],
    });
    expect(result.duplicateAssignments).toContain("img_002");
    // img_002 kept in first group only
    expect(
      result.groups.filter((group) => group.imageIds.includes("c2")),
    ).toHaveLength(1);
  });

  it("handles one-image-one-product and empty model coverage", () => {
    const ctx = setup();
    const empty = normalizeVisionGroups({
      ...ctx,
      rawGroups: [],
    });
    expect(empty.status).toBe("failed");
    expect(empty.groups).toHaveLength(4);
    expect(empty.groups.every((group) => group.title === "")).toBe(true);

    const singles = normalizeVisionGroups({
      ...ctx,
      rawGroups: ctx.refs.map((ref) => ({
        imageIds: [ref.internalId],
        title: "Embroidered Pink Sharara Set",
        description: "A pink sharara set with embroidery visible on the top and pants.",
        categorySlug: "kurtis",
      })),
    });
    expect(singles.groups).toHaveLength(4);
    expect(singles.missingInternalIds).toEqual([]);
  });
});
