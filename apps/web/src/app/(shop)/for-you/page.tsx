import { ForYouExperience } from "@/components/for-you-experience";
import { createClient } from "@/lib/supabase/server";
import type { BrowseCategory } from "@/lib/browse-categories";
import type { Product } from "@/lib/types";

export const metadata = {
  title: "For you · Morni",
  description: "Swipe looks you love and get outfit recommendations matched to your taste.",
};

export default async function ForYouPage() {
  const supabase = await createClient();

  const [{ data: categories }, { data: products }] = await Promise.all([
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

  const list = ((categories ?? []) as BrowseCategory[]).filter(
    (c) => c.slug !== "more",
  );
  const productList = (products ?? []) as (Product & {
    stores: { slug: string; name: string; is_active: boolean; emirate: string };
  })[];

  return (
    <div>
      <ForYouExperience categories={list} products={productList} />
    </div>
  );
}
