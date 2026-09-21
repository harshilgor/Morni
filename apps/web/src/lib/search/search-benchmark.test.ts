import { describe, expect, it } from "vitest";
import { productSatisfiesCentralIntent, understandSearchQuery } from "./query-understanding";

const benchmark = [
  ["tops", { category: "tops" }],
  ["black top", { category: "tops", color: "black" }],
  ["black crop top", { category: "tops", color: "black", style: "crop" }],
  ["cropped", { style: "crop" }],
  ["cotton kurti", { category: "kurtis", fabric: "cotton" }],
  ["women party lehenga", { category: "lehengas", audience: "women", occasion: "party" }],
  ["something elegant for a wedding", { style: "elegant", occasion: "wedding" }],
] as const;

describe("search relevance benchmark", () => {
  it.each(benchmark)("interprets %s", (query, expected) => {
    expect(understandSearchQuery(query)).toMatchObject(expected);
  });

  it("keeps central product-type contradictions out of normal results", () => {
    const intent = understandSearchQuery("black crop tops");
    const candidates = [
      { title: "Black Cropped Cotton Top", category: { slug: "tops" } },
      { title: "Black Embroidered Saree with Blouse", category: { slug: "sarees" } },
      { title: "The Blush Top", category: { slug: "short-kurtis" } },
    ];
    expect(candidates.filter((candidate) => productSatisfiesCentralIntent(intent, candidate)).map((candidate) => candidate.title))
      .toEqual(["Black Cropped Cotton Top", "The Blush Top"]);
  });
});
