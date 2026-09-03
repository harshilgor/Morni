import { NextRequest, NextResponse } from "next/server";
import { getBrowseCategory, type BrowseCategory } from "@/lib/browse-categories";
import {
  CATEGORY_PRODUCT_BATCH_SIZE,
  getCategoryProductPage,
} from "@/lib/category-product-page";
import { createClient } from "@/lib/supabase/server";

const MAX_OFFSET = 480;

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/categories/[slug]/products">,
) {
  const { slug } = await context.params;
  const rawOffset = Number(request.nextUrl.searchParams.get("offset") ?? "0");
  const offset = Number.isInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

  if (offset > MAX_OFFSET) {
    return NextResponse.json({ error: "Invalid product offset." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("browse_categories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  const category = getBrowseCategory(
    slug,
    data ? [data as BrowseCategory] : [],
  );

  if (!category || category.slug === "more") {
    return NextResponse.json({ error: "Category not found." }, { status: 404 });
  }

  try {
    const page = await getCategoryProductPage(
      supabase,
      category,
      offset,
      CATEGORY_PRODUCT_BATCH_SIZE,
    );
    return NextResponse.json(page, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    console.error("Unable to load category products", error);
    return NextResponse.json(
      { error: "Unable to load this category." },
      { status: 500 },
    );
  }
}
