import { generateText, Output } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { mergeBrowseCategories, type BrowseCategory } from "@/lib/browse-categories";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const MAX_IMAGES = 3;
const MAX_IMAGE_DATA_LENGTH = 5_500_000;
const MODEL = "google/gemini-3-flash";

const requestSchema = z.object({
  storeId: z.string().uuid(),
  priceAed: z.number().finite().nonnegative(),
  stock: z.number().int().nonnegative(),
  sizes: z.array(z.string().trim().min(1).max(24)).max(20),
  images: z
    .array(z.string())
    .min(1)
    .max(MAX_IMAGES)
    .refine(
      (images) =>
        images.every(
          (image) =>
            /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(image) &&
            image.length <= MAX_IMAGE_DATA_LENGTH,
        ),
      "Images must be compressed JPG, PNG, or WebP data URLs.",
    ),
});

const suggestionSchema = z.object({
  title: z.string().trim().min(3).max(90),
  description: z.string().trim().min(20).max(600),
  categorySlug: z.string().trim().nullable(),
  colorName: z.string().trim().max(40).nullable(),
});

function getCategories(rows: BrowseCategory[]) {
  return mergeBrowseCategories(rows).map(({ name, slug }) => ({ name, slug }));
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = rateLimit(`product-ai:${user.id}:${clientIp(request)}`, 10, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Add valid product photos, price, stock, and sizes." }, { status: 400 });
  }

  const { storeId, priceAed, stock, sizes, images } = parsed.data;
  const [{ data: membership }, { data: profile }] = await Promise.all([
    supabase
      .from("store_members")
      .select("store_id")
      .eq("store_id", storeId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);

  if (!membership && profile?.role !== "admin") {
    return NextResponse.json({ error: "You do not have access to this store." }, { status: 403 });
  }

  const { data: categoryRows, error: categoryError } = await supabase
    .from("browse_categories")
    .select("id, name, slug, image_url, badge, search_terms, sort_order, is_featured")
    .neq("slug", "more")
    .order("sort_order", { ascending: true });

  if (categoryError) {
    return NextResponse.json({ error: "Could not load product categories." }, { status: 500 });
  }

  const categories = getCategories((categoryRows ?? []) as BrowseCategory[]);
  const categorySlugs = new Set(categories.map((category) => category.slug));

  try {
    const imageParts = images.map((image) => {
      const [, mediaType = "image/jpeg", base64 = ""] = image.match(
        /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i,
      ) ?? [];
      return {
        type: "file" as const,
        mediaType,
        data: base64,
      };
    });

    const { output } = await generateText({
      model: MODEL,
      instructions: [
        "You create draft product listings for a UAE fashion marketplace.",
        "Use the product photos as evidence, but never invent a brand, fabric, measurements, care instructions, origin, or designer name.",
        "Keep the title concise and shopper-friendly. Keep the description factual, warm, and under 80 words.",
        "Choose categorySlug only from the supplied category list. Return null when the category is genuinely unclear.",
        "The owner must review every field, so make conservative suggestions rather than confident guesses.",
      ].join(" "),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: JSON.stringify({
                task: "Generate a draft product listing from the photos and seller inputs.",
                priceAed,
                stock,
                sizes,
                categories,
              }),
            },
            ...imageParts,
          ],
        },
      ],
      output: Output.object({
        name: "ProductListingSuggestion",
        description: "A conservative, editable draft listing for a boutique product.",
        schema: suggestionSchema,
      }),
    });

    if (!output) throw new Error("The AI did not return a listing suggestion.");

    return NextResponse.json({
      suggestion: {
        ...output,
        categorySlug:
          output.categorySlug && categorySlugs.has(output.categorySlug)
            ? output.categorySlug
            : null,
      },
    });
  } catch (error) {
    console.error("Product listing generation failed", error);
    return NextResponse.json(
      { error: "AI listing generation is unavailable right now. You can fill in the listing manually." },
      { status: 503 },
    );
  }
}
