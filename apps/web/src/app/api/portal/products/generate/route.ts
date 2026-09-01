import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { mergeBrowseCategories, type BrowseCategory } from "@/lib/browse-categories";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const MAX_IMAGES = 3;
const MAX_IMAGE_DATA_LENGTH = 5_500_000;

const requestSchema = z.object({
  storeId: z.string().trim().min(1).max(200),
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

type OpenAIResponse = { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };

async function generateWithOpenAI(options: {
  priceAed: number;
  stock: number;
  sizes: string[];
  categories: Array<{ name: string; slug: string }>;
  images: string[];
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const prompt = [
    "You create draft product listings for a UAE fashion marketplace.",
    "Use the product photos as evidence, but never invent a brand, fabric, measurements, care instructions, origin, or designer name.",
    "Write a natural, human-sounding description of 2 to 3 complete sentences and roughly 45 to 90 words. Mention the visible fabric or material and describe the look, feel, silhouette, finish, colour/pattern, styling and likely occasion when the photos support it. Use specific, varied language and avoid generic AI phrases such as 'elevate your wardrobe', 'timeless elegance', or 'perfect for any occasion'.",
    "Never claim a fabric, texture, construction detail, fit, care instruction, origin, or occasion that cannot be reasonably supported by the photos or seller inputs. If fabric is not visually clear, describe the drape or finish cautiously without naming a material.",
    "Choose categorySlug only from the supplied category list. Return null when the category is genuinely unclear.",
    "The owner must review every field, so make conservative suggestions rather than confident guesses.",
    "Return only valid JSON with exactly these keys: title, description, categorySlug, colorName.",
    JSON.stringify({
      task: "Generate a draft product listing from the photos and seller inputs.",
      priceAed: options.priceAed,
      stock: options.stock,
      sizes: options.sizes,
      categories: options.categories,
    }),
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(45_000),
        body: JSON.stringify({
          model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
          input: [{ role: "user", content: [{ type: "input_text", text: prompt }, ...options.images.map((image) => ({ type: "input_image", image_url: image, detail: "high" }))] }],
          temperature: 0.2,
          text: { format: { type: "json_schema", name: "product_listing", strict: true, schema: { type: "object", additionalProperties: false, properties: { title: { type: "string" }, description: { type: "string" }, categorySlug: { type: ["string", "null"] }, colorName: { type: ["string", "null"] } }, required: ["title", "description", "categorySlug", "colorName"] } } },
        }),
      });
  if (!response.ok) throw new Error(`OpenAI request failed with status ${response.status}.`);
  const payload = (await response.json()) as OpenAIResponse;
  const text = payload.output_text ?? payload.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("");
  if (!text) throw new Error("OpenAI returned an empty listing.");
  const parsed = suggestionSchema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error("OpenAI returned an invalid listing format.");
  return parsed.data;
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
    const output = await generateWithOpenAI({
      priceAed,
      stock,
      sizes,
      categories,
      images,
    });

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
      { error: "Could not generate a listing draft right now." },
      { status: 503 },
    );
  }
}
