import { ForYouExperience } from "@/components/for-you-experience";
import { createClient } from "@/lib/supabase/server";
import type { BrowseCategory } from "@/lib/browse-categories";
import {
  emptyTasteProfile,
  profileFromSwipes,
  type ForYouProduct,
  type TasteProfile,
  type TasteSwipe,
} from "@/lib/for-you";

export const metadata = {
  title: "For you · Morni",
  description: "Swipe looks you love and get outfit recommendations matched to your taste.",
};

type ShopperTaste = {
  profile: TasteProfile;
  dismissedProductIds: string[];
};

async function loadShopperTaste(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shopperId: string,
): Promise<ShopperTaste> {
  const [{ data: swipes }, { data: feedback }] = await Promise.all([
    supabase
      .from("taste_swipes")
      .select("product_id, category_slug, decision, tags, price_aed")
      .eq("shopper_id", shopperId)
      .order("created_at", { ascending: true }),
    supabase
      .from("product_feedback")
      .select("product_id")
      .eq("shopper_id", shopperId)
      .eq("feedback_type", "not_interested"),
  ]);

  const savedSwipes: TasteSwipe[] = (swipes ?? []).map((swipe) => ({
    productId: swipe.product_id,
    categorySlug: swipe.category_slug,
    decision: swipe.decision as TasteSwipe["decision"],
    tags: swipe.tags ?? [],
    priceAed: Number(swipe.price_aed ?? 0),
  }));

  return {
    profile: savedSwipes.length ? profileFromSwipes(savedSwipes) : emptyTasteProfile(),
    dismissedProductIds: [...new Set((feedback ?? []).map((item) => item.product_id))],
  };
}

async function loadSignedInTaste(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      userId: null as string | null,
      taste: {
        profile: emptyTasteProfile(),
        dismissedProductIds: [] as string[],
      },
    };
  }
  return {
    userId: user.id,
    taste: await loadShopperTaste(supabase, user.id),
  };
}

export default async function ForYouPage() {
  const supabase = await createClient();

  // Catalog + signed-in taste load together so the client never waits on a second round-trip.
  const [signedIn, { data: categories }, { data: products }] = await Promise.all([
    loadSignedInTaste(supabase),
    supabase
      .from("browse_categories")
      .select("*")
      .eq("is_featured", true)
      .neq("slug", "more")
      .order("sort_order"),
    supabase
      .from("storefront_products")
      .select("*, stores!inner(slug, name, is_active, emirate)")
      .eq("is_available", true)
      .eq("stores.is_active", true)
      .order("created_at", { ascending: false })
      .limit(80),
  ]);

  const list = ((categories ?? []) as BrowseCategory[]).filter((c) => c.slug !== "more");
  const productList = (products ?? []) as ForYouProduct[];

  return (
    <div>
      <ForYouExperience
        categories={list}
        products={productList}
        initialProfile={signedIn.taste.profile}
        initialDismissedProductIds={signedIn.taste.dismissedProductIds}
        initialShopperId={signedIn.userId}
        hasServerTaste={Boolean(signedIn.userId)}
      />
    </div>
  );
}
