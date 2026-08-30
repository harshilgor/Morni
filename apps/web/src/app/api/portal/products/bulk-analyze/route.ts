import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { mergeBrowseCategories, type BrowseCategory } from "@/lib/browse-categories";

const imageSchema = z.object({ id: z.string().max(100), name: z.string().max(200), data: z.string().regex(/^data:image\/(jpeg|png|webp);base64,/i).max(1_800_000) });
const schema = z.object({ storeId: z.string().uuid(), images: z.array(imageSchema).min(1).max(30) });
const suggestionSchema = z.object({ groups: z.array(z.object({ imageIds: z.array(z.string().max(100)).min(1), title: z.string().max(120), description: z.string().max(600), categorySlug: z.string().max(80), colorName: z.string().max(40), confidence: z.number().min(0).max(1), needsReview: z.boolean() })).max(30) });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Upload up to 30 valid images." }, { status: 400 });
  const { storeId, images } = parsed.data;
  const [{ data: member }, { data: profile }, { data: categories }] = await Promise.all([
    supabase.from("store_members").select("store_id").eq("store_id", storeId).eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("browse_categories").select("name,slug").neq("slug", "more").order("sort_order"),
  ]);
  if (!member && profile?.role !== "admin") return NextResponse.json({ error: "You do not have access to this store." }, { status: 403 });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "AI analysis is not configured. You can still review products manually." }, { status: 503 });
  const prompt = `You are the visual identity engine for a fashion marketplace. Group uploaded photos by product identity, not by model, pose, background, or filename. Photos showing the same garment or item from different angles, distances, close-ups, or on different models belong in one group. Do not merge items merely because they are similar in color, category, or style. When uncertain, keep photos in separate groups and set needsReview true. Use the supplied image IDs exactly. Every image ID must appear exactly once across all groups, with no missing or extra IDs. Suggest a conservative title, description, categorySlug from the supplied list, and colorName. Use an empty string for categorySlug or colorName when unclear. Do not invent brand, fabric, measurements, price, stock, or sizes. Categories: ${JSON.stringify(mergeBrowseCategories((categories ?? []) as BrowseCategory[]).map(({ name, slug }) => ({ name, slug })))}. Image IDs and filenames: ${JSON.stringify(images.map(({ id, name }) => ({ id, name })))}.`;
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || "gpt-5.1",
        store: false,
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }, ...images.map((image) => ({ type: "input_image", image_url: image.data, detail: "high" }))] }],
        text: { format: { type: "json_schema", name: "product_photo_groups", strict: true, schema: { type: "object", additionalProperties: false, properties: { groups: { type: "array", minItems: 1, maxItems: 30, items: { type: "object", additionalProperties: false, properties: { imageIds: { type: "array", minItems: 1, items: { type: "string" } }, title: { type: "string" }, description: { type: "string" }, categorySlug: { type: "string" }, colorName: { type: "string" }, confidence: { type: "number", minimum: 0, maximum: 1 }, needsReview: { type: "boolean" } }, required: ["imageIds", "title", "description", "categorySlug", "colorName", "confidence", "needsReview"] } } }, required: ["groups"] } } },
      }),
    });
  } catch {
    return NextResponse.json({ error: "AI analysis timed out or is temporarily unavailable. You can continue manually." }, { status: 503 });
  }
  if (!response.ok) return NextResponse.json({ error: "AI analysis is temporarily unavailable. You can continue manually." }, { status: 503 });
  const payload = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  const outputText = payload.output_text ?? payload.output?.flatMap((item) => item.content ?? []).map((part) => part.text ?? "").join("");
  let parsedOutput: unknown;
  try {
    parsedOutput = JSON.parse(outputText || "{}");
  } catch {
    return NextResponse.json({ error: "AI returned an invalid grouping. Review manually." }, { status: 503 });
  }
  const output = suggestionSchema.safeParse(parsedOutput);
  if (!output.success) return NextResponse.json({ error: "AI returned an invalid grouping. Review manually." }, { status: 503 });
  const expected = new Set(images.map((image) => image.id));
  const seen = new Set<string>();
  const valid = output.data.groups.every((group) => group.imageIds.every((id) => expected.has(id) && !seen.has(id) && seen.add(id)));
  if (!valid || seen.size !== expected.size) return NextResponse.json({ error: "AI grouping failed validation. Review the photos manually." }, { status: 503 });
  return NextResponse.json({ groups: output.data.groups });
}
