import { describe, expect, it } from "vitest";
import {
  assignInternalImageIds,
  buildIdAliasMap,
  reconcileImageId,
  reconcileImageIdList,
} from "@/lib/bulk-vision/image-ids";

describe("bulk vision image IDs", () => {
  const images = [
    { id: "client-a", name: "e2f7a6ae-64b0-4bdd-a627-7c092b40e0bt.jpg", data: "data:image/jpeg;base64,aa" },
    { id: "client-b", name: "IMG_1234.jpg", data: "data:image/jpeg;base64,bb" },
    { id: "client-c", name: "front.jpg", data: "data:image/jpeg;base64,cc" },
  ];

  it("assigns stable internal IDs independent of filenames", () => {
    const refs = assignInternalImageIds(images);
    expect(refs.map((ref) => ref.internalId)).toEqual([
      "img_001",
      "img_002",
      "img_003",
    ]);
    expect(refs[0]?.clientId).toBe("client-a");
    expect(refs[0]?.originalFilename).toContain("e2f7a6ae");
  });

  it("reconciles correct internal IDs, PHOTO_N, and numeric IDs", () => {
    const aliasMap = buildIdAliasMap(assignInternalImageIds(images));
    expect(reconcileImageId("img_001", aliasMap)).toMatchObject({
      ok: true,
      internalId: "img_001",
    });
    expect(reconcileImageId("PHOTO_2", aliasMap)).toMatchObject({
      ok: true,
      internalId: "img_002",
    });
    expect(reconcileImageId("3", aliasMap)).toMatchObject({
      ok: true,
      internalId: "img_003",
    });
    expect(reconcileImageId("client-b", aliasMap)).toMatchObject({
      ok: true,
      internalId: "img_002",
    });
  });

  it("rejects unknown IDs without guessing", () => {
    const aliasMap = buildIdAliasMap(assignInternalImageIds(images));
    expect(reconcileImageId("img_999", aliasMap).ok).toBe(false);
    expect(reconcileImageId("mystery", aliasMap).ok).toBe(false);
    expect(reconcileImageId("", aliasMap).ok).toBe(false);
  });

  it("keeps valid IDs when a list is partially bad or duplicated", () => {
    const aliasMap = buildIdAliasMap(assignInternalImageIds(images));
    const result = reconcileImageIdList(
      ["img_001", "PHOTO_2", "unknown", "img_001", "9"],
      aliasMap,
    );
    expect(result.resolved).toEqual(["img_001", "img_002"]);
    expect(result.rejected.some((item) => item.raw === "unknown")).toBe(true);
    expect(result.duplicatesDropped).toContain("img_001");
  });
});
