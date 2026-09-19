import { createClient } from "@/lib/supabase/client";
import {
  mergeBrowseCategories,
  RETIRED_BROWSE_CATEGORY_SLUGS,
  type BrowseCategory,
} from "@/lib/browse-categories";
import { slugify } from "@/lib/format";

export async function ensureStoreCategory(options: {
  storeId: string;
  categorySlug: string;
  categoryName?: string;
}) {
  const supabase = createClient();
  const slug = slugify(options.categorySlug) || "general";
  if (RETIRED_BROWSE_CATEGORY_SLUGS.has(slug)) {
    throw new Error("This category is no longer available.");
  }
  const name =
    options.categoryName?.trim() ||
    slug
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .eq("store_id", options.storeId)
    .eq("slug", slug)
    .maybeSingle();

  if (existing?.id) return existing.id as string;

  const { data: created, error } = await supabase
    .from("categories")
    .insert({
      store_id: options.storeId,
      name,
      slug,
      sort_order: 0,
    })
    .select("id")
    .single();

  if (error || !created) {
    throw new Error(error?.message ?? "Could not create category.");
  }

  return created.id as string;
}

export async function loadBrowseCategoryOptions() {
  const supabase = createClient();
  const { data } = await supabase
    .from("browse_categories")
    .select("*")
    .neq("slug", "more")
    .order("sort_order", { ascending: true });

  return mergeBrowseCategories((data ?? []) as BrowseCategory[]).map(
    ({ name, slug }) => ({ name, slug }),
  );
}
