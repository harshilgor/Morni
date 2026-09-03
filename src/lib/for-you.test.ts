import { describe, expect, it } from "vitest";
import type { BrowseCategory } from "@/lib/browse-categories";
import {
  applyTasteSwipe,
  emptyTasteProfile,
  isTasteProfile,
  profileFromSwipes,
  recommendForYouProducts,
  scoreProductForTaste,
  type ForYouProduct,
  type TasteSwipe,
} from "@/lib/for-you";

const categories: BrowseCategory[] = [
  {
    id: "cat-lehengas",
    name: "Lehengas",
    slug: "lehengas",
    image_url: "/categories/lehengas.webp",
    badge: null,
    search_terms: ["lehenga", "bridal"],
    sort_order: 1,
    is_featured: true,
  },
  {
    id: "cat-sarees",
    name: "Sarees",
    slug: "sarees",
    image_url: "/categories/sarees.webp",
    badge: null,
    search_terms: ["saree", "sari"],
    sort_order: 2,
    is_featured: true,
  },
  {
    id: "cat-kurta",
    name: "Kurtas",
    slug: "kurtas",
    image_url: "/categories/kurtas.webp",
    badge: null,
    search_terms: ["kurta"],
    sort_order: 3,
    is_featured: true,
  },
];

function product(
  id: string,
  title: string,
  priceAed: number,
  overrides: Partial<ForYouProduct> = {},
): ForYouProduct {
  return {
    id,
    store_id: "store-1",
    category_id: null,
    title,
    description: title,
    price_aed: priceAed,
    compare_at_price_aed: null,
    image_urls: [`https://example.com/${id}.jpg`],
    sizes: ["M"],
    stock: 3,
    is_available: true,
    stores: {
      slug: "demo-store",
      name: "Demo Store",
      is_active: true,
      emirate: "dubai",
    },
    ...overrides,
  };
}

function swipe(
  productId: string,
  categorySlug: string,
  decision: TasteSwipe["decision"],
  tags: string[],
  priceAed = 500,
): TasteSwipe {
  return { productId, categorySlug, decision, tags, priceAed };
}

describe("for-you taste math", () => {
  it("rebuilds the same profile from sequential swipes", () => {
    const swipes = [
      swipe("a", "lehengas", "liked", ["lehengas", "bridal", "lehenga"], 900),
      swipe("b", "sarees", "passed", ["sarees", "saree"], 400),
      swipe("c", "lehengas", "passed", ["lehengas", "lehenga"], 1200),
    ];

    const sequential = swipes.reduce(applyTasteSwipe, emptyTasteProfile());
    const rebuilt = profileFromSwipes(swipes);

    expect(rebuilt).toEqual(sequential);
    expect(rebuilt.likes).toBe(1);
    expect(rebuilt.passes).toBe(2);
    expect(rebuilt.categories.lehengas).toEqual({ likes: 1, passes: 1 });
    expect(rebuilt.likedSignals).toHaveLength(1);
  });

  it("returns no recommendations for a cold or all-pass profile", () => {
    const catalog = [
      product("p1", "Silk bridal lehenga", 1000),
      product("p2", "Cotton saree", 300),
    ];

    expect(recommendForYouProducts(catalog, categories, emptyTasteProfile(), [])).toEqual([]);

    const allPass = profileFromSwipes([
      swipe("a", "lehengas", "passed", ["lehengas", "lehenga"]),
      swipe("b", "sarees", "passed", ["sarees", "saree"]),
      swipe("c", "kurtas", "passed", ["kurtas", "kurta"]),
    ]);

    expect(recommendForYouProducts(catalog, categories, allPass, [])).toEqual([]);
  });

  it("keeps recommendations near the single like when most swipes are passes", () => {
    const liked = product("liked", "Silk bridal lehenga red", 950);
    const sibling = product("sib", "Bridal lehenga embroidered", 980);
    const otherLehenga = product("other-lehenga", "Party lehenga pastel", 700);
    const saree = product("saree", "Banarasi silk saree", 600);
    const kurta = product("kurta", "Cotton kurta set", 250);

    const profile = profileFromSwipes([
      swipe("liked", "lehengas", "liked", ["lehengas", "bridal", "lehenga", "silk", "red"], 950),
      swipe("pass-1", "sarees", "passed", ["sarees", "saree", "silk"], 600),
      swipe("pass-2", "sarees", "passed", ["sarees", "saree"], 450),
      swipe("pass-3", "kurtas", "passed", ["kurtas", "kurta", "cotton"], 250),
      swipe("pass-4", "kurtas", "passed", ["kurtas", "kurta"], 280),
      swipe("pass-5", "lehengas", "passed", ["lehengas", "lehenga", "pastel"], 700),
      swipe("pass-6", "sarees", "passed", ["sarees", "saree"], 500),
      swipe("pass-7", "kurtas", "passed", ["kurtas", "kurta"], 300),
      swipe("pass-8", "sarees", "passed", ["sarees", "saree"], 350),
      swipe("pass-9", "kurtas", "passed", ["kurtas", "kurta"], 220),
    ]);

    const recs = recommendForYouProducts(
      [liked, sibling, otherLehenga, saree, kurta],
      categories,
      profile,
      [],
    );

    expect(recs.map((item) => item.id)).not.toContain("liked");
    expect(recs.map((item) => item.id)).not.toContain("pass-1");
    expect(recs[0]?.id).toBe("sib");

    const siblingScore = scoreProductForTaste(sibling, categories, profile);
    const sareeScore = scoreProductForTaste(saree, categories, profile);
    const kurtaScore = scoreProductForTaste(kurta, categories, profile);
    expect(siblingScore).toBeGreaterThan(sareeScore);
    expect(siblingScore).toBeGreaterThan(kurtaScore);
  });

  it("ranks same-category siblings above unrelated categories after mixed votes", () => {
    const liked = product("liked", "Bridal lehenga heavy work", 1100);
    const sibling = product("sib", "Wedding lehenga bridal silk", 1050);
    const saree = product("saree", "Everyday cotton saree", 280);

    const profile = profileFromSwipes([
      swipe("liked", "lehengas", "liked", ["lehengas", "bridal", "lehenga", "wedding"], 1100),
      swipe("pass-same", "lehengas", "passed", ["lehengas", "lehenga", "party"], 500),
      swipe("pass-saree", "sarees", "passed", ["sarees", "saree", "cotton"], 280),
    ]);

    const recs = recommendForYouProducts([liked, sibling, saree], categories, profile, []);
    expect(recs.map((item) => item.id)[0]).toBe("sib");
    expect(scoreProductForTaste(sibling, categories, profile)).toBeGreaterThan(
      scoreProductForTaste(saree, categories, profile),
    );
  });

  it("excludes liked, passed, and dismissed products from recommendations", () => {
    const liked = product("liked", "Bridal lehenga", 900);
    const passed = product("passed", "Silk saree", 400);
    const dismissed = product("dismissed", "Another bridal lehenga", 920);
    const open = product("open", "Bridal lehenga embroidered", 880);

    const profile = profileFromSwipes([
      swipe("liked", "lehengas", "liked", ["lehengas", "bridal", "lehenga"], 900),
      swipe("passed", "sarees", "passed", ["sarees", "saree"], 400),
    ]);

    const recs = recommendForYouProducts(
      [liked, passed, dismissed, open],
      categories,
      profile,
      ["dismissed"],
    );

    const ids = recs.map((item) => item.id);
    expect(ids).toEqual(["open"]);
  });

  it("applies price proximity only after at least one like", () => {
    const cheap = product("cheap", "Bridal lehenga light", 200);
    const close = product("close", "Bridal lehenga classic", 500);
    const profileNoLike = emptyTasteProfile();
    expect(scoreProductForTaste(cheap, categories, profileNoLike)).toBe(
      scoreProductForTaste(close, categories, profileNoLike),
    );

    const profile = profileFromSwipes([
      swipe("liked", "lehengas", "liked", ["lehengas", "bridal", "lehenga"], 500),
    ]);
    expect(scoreProductForTaste(close, categories, profile)).toBeGreaterThan(
      scoreProductForTaste(cheap, categories, profile),
    );
  });

  it("rejects legacy stored profile shapes", () => {
    expect(
      isTasteProfile({
        categoryScores: { lehengas: 1 },
        tagScores: { lehenga: 1 },
        likedProductIds: [],
        passedProductIds: [],
        likedPriceSum: 0,
        likedPriceCount: 0,
        likes: 0,
        passes: 0,
      }),
    ).toBe(false);
    expect(isTasteProfile(emptyTasteProfile())).toBe(true);
  });
});
