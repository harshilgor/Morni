import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { mergeBrowseCategories, type BrowseCategory } from "@/lib/browse-categories";

const imageSchema = z.object({ id: z.string().max(100), name: z.string().max(200), data: z.string().regex(/^data:image\/(jpeg|png|webp);base64,/i).max(6_000_000) });
// Store identifiers are validated against the authenticated membership below.
// Do not assume every deployed database uses UUID-formatted identifiers.
const schema = z.object({ storeId: z.string().trim().min(1).max(200), images: z.array(imageSchema).min(1).max(30) });
const suggestionSchema = z.object({ groups: z.array(z.object({ imageIds: z.array(z.string().max(100)).min(1), title: z.string().max(120), description: z.string().max(600), categorySlug: z.string().max(80), colorName: z.string().max(40), confidence: z.number().min(0).max(1), needsReview: z.boolean() })).max(30) });

type Suggestion = z.infer<typeof suggestionSchema>["groups"][number];

function fallbackTitle(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "New product";
}

function fallbackGroups(images: Array<{ label: string; name: string }>): Suggestion[] {
  return images.map((image) => ({
    imageIds: [image.label],
    title: fallbackTitle(image.name),
    description: "",
    categorySlug: "",
    colorName: "",
    confidence: 0,
    needsReview: true,
  }));
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let userId: string;
  try {
    supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.error("Bulk photo grouping auth verification failed", { requestId, message: authError.message });
      return NextResponse.json({ error: "We could not verify your Supabase session. Please sign in again." }, { status: 503 });
    }
    if (!user) return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
    userId = user.id;
  } catch (error) {
    console.error("Bulk photo grouping Supabase client failed", { requestId, name: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "Supabase session verification failed. Please try again." }, { status: 503 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    console.error("Bulk photo grouping payload validation failed", { requestId, issueCount: parsed.error.issues.length, paths: parsed.error.issues.map((issue) => issue.path.join(".")) });
    return NextResponse.json({ error: "The photo request could not be validated. Please try selecting the images again." }, { status: 400 });
  }
  const { storeId, images } = parsed.data;
  const labelledImages = images.map((image, index) => ({
    ...image,
    label: `PHOTO_${index + 1}`,
  }));
  const labelToId = new Map(labelledImages.map((image) => [image.label, image.id]));
  const restoreImageIds = (groups: Suggestion[]) =>
    groups.map((group) => ({
      ...group,
      imageIds: group.imageIds
        .map((label) => labelToId.get(label))
        .filter((id): id is string => Boolean(id)),
    }));
  const totalPayloadBytes = images.reduce((total, image) => total + image.data.length, 0);
  if (totalPayloadBytes > 45_000_000) {
    return NextResponse.json({ error: "The selected photos are too large to analyze together. Please upload fewer photos at a time." }, { status: 413 });
  }
  const [{ data: member, error: memberError }, { data: profile, error: profileError }, { data: categories, error: categoriesError }] = await Promise.all([
    supabase.from("store_members").select("store_id").eq("store_id", storeId).eq("user_id", userId).maybeSingle(),
    supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
    supabase.from("browse_categories").select("name,slug").neq("slug", "more").order("sort_order"),
  ]);
  if (memberError || profileError || categoriesError) {
    console.error("Bulk photo grouping Supabase query failed", {
      requestId,
      member: memberError?.message,
      profile: profileError?.message,
      categories: categoriesError?.message,
    });
    return NextResponse.json({ error: "Supabase could not load the store details. Please try again." }, { status: 503 });
  }
  if (!member && profile?.role !== "admin") return NextResponse.json({ error: "You do not have access to this store." }, { status: 403 });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "AI analysis is not configured. You can still review products manually." }, { status: 503 });
  const model = process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";
  console.info("Bulk photo grouping sending request to OpenAI", { requestId, model, imageCount: images.length });
  const prompt = `You are matching product photos for a fashion marketplace. Compare EVERY uploaded image against every other uploaded image before creating groups. Group by the physical product identity, not by model, pose, background, crop, lighting, filename, or image order. Different views of the same garment or item—including front/back views, close-ups, different poses, and the same item worn by different models—MUST be placed in one group. Only separate photos when they clearly show different physical products. Do not create one-photo groups just because the angle or model changes. Use ONLY the stable photo labels supplied below, such as PHOTO_1. Every label must appear exactly once across all groups, with no missing or extra labels. Suggest a conservative title, description, categorySlug from the supplied list, and colorName. Use an empty string for categorySlug or colorName when unclear. Do not invent brand, fabric, measurements, price, stock, or sizes. Categories: ${JSON.stringify(mergeBrowseCategories((categories ?? []) as BrowseCategory[]).map(({ name, slug }) => ({ name, slug })))}. The photo labels are: ${JSON.stringify(labelledImages.map(({ label, name }) => ({ label, name })))}.`;
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        model,
        store: false,
        input: [{ role: "user", content: [
          { type: "input_text", text: prompt },
          ...labelledImages.flatMap((image) => [
            { type: "input_text", text: `PHOTO LABEL: ${image.label}\nFILENAME: ${image.name}` },
            { type: "input_image", image_url: image.data, detail: "high" },
          ]),
        ] }],
        text: { format: { type: "json_schema", name: "product_photo_groups", strict: true, schema: { type: "object", additionalProperties: false, properties: { groups: { type: "array", minItems: 1, maxItems: 30, items: { type: "object", additionalProperties: false, properties: { imageIds: { type: "array", minItems: 1, items: { type: "string" } }, title: { type: "string" }, description: { type: "string" }, categorySlug: { type: "string" }, colorName: { type: "string" }, confidence: { type: "number", minimum: 0, maximum: 1 }, needsReview: { type: "boolean" } }, required: ["imageIds", "title", "description", "categorySlug", "colorName", "confidence", "needsReview"] } } }, required: ["groups"] } } },
      }),
    });
  } catch (error) {
    console.error("Bulk photo grouping OpenAI request failed", { requestId, name: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({
      groups: restoreImageIds(fallbackGroups(labelledImages)),
      warning: "AI analysis was temporarily unavailable. The photos were kept separate for manual review.",
    });
  }
  if (!response.ok) {
    let providerError: unknown;
    try { providerError = await response.clone().json(); } catch { providerError = undefined; }
    const providerType = typeof providerError === "object" && providerError !== null && "error" in providerError && typeof providerError.error === "object" && providerError.error !== null && "type" in providerError.error ? providerError.error.type : undefined;
    console.error("Bulk photo grouping provider rejected request", {
      requestId,
      status: response.status,
      statusText: response.statusText,
      type: providerType,
      model,
    });
    return NextResponse.json({
      groups: restoreImageIds(fallbackGroups(labelledImages)),
      warning: response.status === 401 || response.status === 403
        ? "OpenAI rejected the configured API key. The photos were kept separate for manual review."
        : response.status === 404
          ? `OpenAI model "${model}" is not available. The photos were kept separate for manual review.`
          : "OpenAI could not analyze these photos. The photos were kept separate for manual review.",
    });
  }
  const payload = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  const outputText = payload.output_text ?? payload.output?.flatMap((item) => item.content ?? []).map((part) => part.text ?? "").join("");
  let parsedOutput: unknown;
  try {
    parsedOutput = JSON.parse(outputText || "{}");
  } catch {
    console.warn("Bulk photo grouping returned non-JSON output", { requestId, imageCount: images.length });
    return NextResponse.json({
      groups: restoreImageIds(fallbackGroups(labelledImages)),
      warning: "AI returned an incomplete grouping. The photos were kept separate for manual review.",
    });
  }
  const output = suggestionSchema.safeParse(parsedOutput);
  if (!output.success) {
    console.error("Bulk photo grouping returned an invalid schema", {
      requestId,
      imageCount: images.length,
    });
    return NextResponse.json({
      groups: restoreImageIds(fallbackGroups(labelledImages)),
      warning: "AI returned an incomplete grouping. The photos were kept separate for manual review.",
    });
  }
  const expected = new Set(labelledImages.map((image) => image.label));
  const seen = new Set<string>();
  const validGroups = output.data.groups
    .map((group) => ({
      ...group,
      imageIds: group.imageIds.filter((id) => expected.has(id) && !seen.has(id) && Boolean(seen.add(id))),
    }))
    .filter((group) => group.imageIds.length > 0);
  const missing = labelledImages.filter((image) => !seen.has(image.label));
  if (missing.length > 0 || seen.size !== expected.size) {
    console.warn("Bulk photo grouping recovered incomplete image coverage", {
      requestId,
      expected: expected.size,
      returned: seen.size,
      missing: missing.map((image) => image.label),
    });
  }
  const groups = [...validGroups, ...fallbackGroups(missing)].map((group) => ({
    ...group,
    imageIds: group.imageIds.map((label) => labelToId.get(label)).filter((id): id is string => Boolean(id)),
  }));
  return NextResponse.json({
    groups,
    warning: missing.length > 0 ? "Some photos needed manual review and were kept separate." : undefined,
  });
}
