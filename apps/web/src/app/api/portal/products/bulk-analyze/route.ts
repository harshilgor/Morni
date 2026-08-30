import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { mergeBrowseCategories, type BrowseCategory } from "@/lib/browse-categories";

const imageSchema = z.object({ id: z.string().max(100), name: z.string().max(200), data: z.string().regex(/^data:image\/(jpeg|png|webp);base64,/i).max(1_800_000) });
const schema = z.object({ storeId: z.string().uuid(), images: z.array(imageSchema).min(1).max(30) });
const suggestionSchema = z.object({ groups: z.array(z.object({ imageIds: z.array(z.string().max(100)).min(1), title: z.string().max(120), description: z.string().max(600), categorySlug: z.string().nullable(), colorName: z.string().max(40).nullable(), confidence: z.number().min(0).max(1).optional() })).max(30) });

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
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "AI analysis is not configured. You can still review products manually." }, { status: 503 });
  const parts = images.map((image) => { const [, mediaType, data] = image.data.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i) ?? []; return { inline_data: { mime_type: mediaType, data } }; });
  const prompt = `You are assisting a marketplace seller. Group photos that clearly belong to the same product; never merge uncertain products. Suggest conservative title, description, categorySlug from this list, and colorName. Return only JSON matching {groups:[{imageIds,title,description,categorySlug,colorName}]}. Every image id must appear exactly once. Do not invent brand, fabric, measurements, price, stock, or sizes. Categories: ${JSON.stringify(mergeBrowseCategories((categories ?? []) as BrowseCategory[]).map(({ name, slug }) => ({ name, slug })))}. Image ids: ${JSON.stringify(images.map(({ id, name }) => ({ id, name })))}.`;
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }, ...parts] }], generationConfig: { temperature: 0.1, responseMimeType: "application/json" } }) });
  if (!response.ok) return NextResponse.json({ error: "AI analysis is temporarily unavailable." }, { status: 503 });
  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const output = suggestionSchema.safeParse(JSON.parse(payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}"));
  if (!output.success) return NextResponse.json({ error: "AI returned an invalid grouping. Review manually." }, { status: 503 });
  return NextResponse.json({ groups: output.data.groups });
}
