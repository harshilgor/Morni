import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { mergeBrowseCategories, type BrowseCategory } from "@/lib/browse-categories";
import {
  assignInternalImageIds,
  buildVisionPrompt,
  callVisionProvider,
  explicitFailureGroups,
  normalizeVisionGroups,
  statusWarning,
  type RawVisionGroup,
} from "@/lib/bulk-vision";

const imageSchema = z.object({
  id: z.string().max(100),
  name: z.string().max(200),
  data: z.string().regex(/^data:image\/(jpeg|png|webp);base64,/i).max(6_000_000),
});
const MAX_ANALYSIS_IMAGES = 30;
const schema = z.object({
  storeId: z.string().trim().min(1).max(200),
  images: z.array(imageSchema).min(1).max(MAX_ANALYSIS_IMAGES),
});

const rawGroupSchema = z
  .object({
    imageIds: z.array(z.string().max(100)).min(1),
    title: z.string().max(120).optional().default(""),
    description: z.string().max(600).optional().default(""),
    categorySlug: z.string().max(80).optional().default(""),
    colorName: z.string().max(40).optional().default(""),
    confidence: z.number().min(0).max(1).optional().default(0),
    needsReview: z.boolean().optional().default(true),
    colorGroups: z
      .array(
        z.object({
          imageIds: z.array(z.string().max(100)).min(1),
          colorName: z.string().max(40).optional().default(""),
          confidence: z.number().min(0).max(1).optional().default(0),
          needsReview: z.boolean().optional().default(true),
        }),
      )
      .max(20)
      .optional()
      .default([]),
  })
  .passthrough();

const suggestionSchema = z.object({
  groups: z.array(rawGroupSchema).max(30),
});

function logBulkVision(
  level: "info" | "warn" | "error",
  event: string,
  payload: Record<string, unknown>,
) {
  const line = { event, ...payload };
  if (level === "error") console.error("BulkVision", line);
  else if (level === "warn") console.warn("BulkVision", line);
  else console.info("BulkVision", line);
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let userId: string;
  try {
    supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) {
      logBulkVision("error", "auth_verification_failed", {
        requestId,
        message: authError.message,
      });
      return NextResponse.json(
        { error: "We could not verify your Supabase session. Please sign in again." },
        { status: 503 },
      );
    }
    if (!user) {
      return NextResponse.json(
        { error: "Your session has expired. Please sign in again." },
        { status: 401 },
      );
    }
    userId = user.id;
  } catch (error) {
    logBulkVision("error", "supabase_client_failed", {
      requestId,
      name: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { error: "Supabase session verification failed. Please try again." },
      { status: 503 },
    );
  }

  const requestBody = await request.json().catch(() => null);
  const parsed = schema.safeParse(requestBody);
  if (!parsed.success) {
    const imageCount =
      typeof requestBody === "object" &&
      requestBody !== null &&
      "images" in requestBody &&
      Array.isArray(requestBody.images)
        ? requestBody.images.length
        : 0;
    if (imageCount > MAX_ANALYSIS_IMAGES) {
      return NextResponse.json(
        {
          error: `AI can analyze up to ${MAX_ANALYSIS_IMAGES} photos at a time. Your product drafts remain safe; split the AI analysis into smaller batches, then publish all products together.`,
        },
        { status: 413 },
      );
    }
    logBulkVision("error", "payload_validation_failed", {
      requestId,
      issueCount: parsed.error.issues.length,
      paths: parsed.error.issues.map((issue) => issue.path.join(".")),
    });
    return NextResponse.json(
      { error: "The photo request could not be validated. Please try selecting the images again." },
      { status: 400 },
    );
  }

  const { storeId, images } = parsed.data;
  const refs = assignInternalImageIds(images);
  const filenamesByInternalId = new Map(
    refs.map((ref) => [ref.internalId, ref.originalFilename]),
  );

  const totalPayloadBytes = images.reduce(
    (total, image) => total + image.data.length,
    0,
  );
  const configuredGeminiKey = process.env.GEMINI_API_KEY?.trim();
  const geminiKey =
    configuredGeminiKey && !/^\[[^\]]+\]$/.test(configuredGeminiKey)
      ? configuredGeminiKey
      : undefined;
  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  const payloadLimit = geminiKey ? 18_000_000 : 45_000_000;
  if (totalPayloadBytes > payloadLimit) {
    return NextResponse.json(
      {
        error:
          "The selected photos are too large to analyze together. Please upload fewer photos at a time.",
      },
      { status: 413 },
    );
  }

  const [
    { data: member, error: memberError },
    { data: profile, error: profileError },
    { data: categories, error: categoriesError },
  ] = await Promise.all([
    supabase
      .from("store_members")
      .select("store_id")
      .eq("store_id", storeId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
    supabase
      .from("browse_categories")
      .select("name,slug")
      .neq("slug", "more")
      .order("sort_order"),
  ]);

  if (memberError || profileError || categoriesError) {
    logBulkVision("error", "supabase_query_failed", {
      requestId,
      member: memberError?.message,
      profile: profileError?.message,
      categories: categoriesError?.message,
    });
    return NextResponse.json(
      { error: "Supabase could not load the store details. Please try again." },
      { status: 503 },
    );
  }
  if (!member && profile?.role !== "admin") {
    return NextResponse.json(
      { error: "You do not have access to this store." },
      { status: 403 },
    );
  }
  if (!openAiKey && !geminiKey) {
    return NextResponse.json(
      {
        error:
          "AI analysis is not configured. You can still review products manually.",
      },
      { status: 503 },
    );
  }

  const provider = geminiKey ? ("Gemini" as const) : ("OpenAI" as const);
  const apiKey = (geminiKey ?? openAiKey)!;
  const model = geminiKey
    ? process.env.GEMINI_VISION_MODEL || "gemini-3.5-flash"
    : process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";
  const categoryList = mergeBrowseCategories(
    (categories ?? []) as BrowseCategory[],
  ).map(({ name, slug }) => ({ name, slug }));
  const categorySlugs = new Set(categoryList.map((category) => category.slug));

  logBulkVision("info", "provider_request_start", {
    requestId,
    provider,
    model,
    imageCount: images.length,
    internalIds: refs.map((ref) => ref.internalId),
    payloadBytes: totalPayloadBytes,
  });

  const prompt = buildVisionPrompt({
    categories: categoryList,
    internalIds: refs.map((ref) => ref.internalId),
  });

  const providerResult = await callVisionProvider({
    provider,
    apiKey,
    model,
    prompt,
    refs,
    images,
  });

  if (!providerResult.ok) {
    logBulkVision("error", "provider_failed", {
      requestId,
      provider,
      model,
      kind: providerResult.kind,
      status: providerResult.status,
      latencyMs: providerResult.latencyMs,
      attempts: providerResult.attempts,
      message: providerResult.message,
    });
    const groups = explicitFailureGroups(refs, providerResult.kind);
    return NextResponse.json({
      groups,
      status: "failed",
      failureKind: providerResult.kind,
      warning: statusWarning("failed", providerResult.kind),
    });
  }

  logBulkVision("info", "provider_response_received", {
    requestId,
    provider,
    model,
    latencyMs: providerResult.latencyMs,
    attempts: providerResult.attempts,
    outputChars: providerResult.text.length,
  });

  let parsedOutput: unknown;
  try {
    parsedOutput = JSON.parse(providerResult.text);
  } catch {
    logBulkVision("warn", "parser_failure", {
      requestId,
      imageCount: images.length,
      outputPreview: providerResult.text.slice(0, 240),
    });
    return NextResponse.json({
      groups: explicitFailureGroups(refs, "parser_failure"),
      status: "failed",
      failureKind: "parser_failure",
      warning: statusWarning("failed", "parser_failure"),
    });
  }

  const output = suggestionSchema.safeParse(parsedOutput);
  if (!output.success) {
    logBulkVision("error", "schema_validation_failure", {
      requestId,
      imageCount: images.length,
      issueCount: output.error.issues.length,
      paths: output.error.issues.slice(0, 8).map((issue) => issue.path.join(".")),
    });
    return NextResponse.json({
      groups: explicitFailureGroups(refs, "parser_failure"),
      status: "failed",
      failureKind: "parser_failure",
      warning: statusWarning("failed", "parser_failure"),
    });
  }

  const normalized = normalizeVisionGroups({
    refs,
    rawGroups: output.data.groups as RawVisionGroup[],
    categorySlugs,
    filenamesByInternalId,
  });

  logBulkVision(
    normalized.status === "failed" ? "warn" : "info",
    "normalization_complete",
    {
      requestId,
      provider,
      model,
      status: normalized.status,
      failureKind: normalized.failureKind,
      groupCount: normalized.groups.length,
      missingInternalIds: normalized.missingInternalIds,
      rejectedIdCount: normalized.rejectedIds.length,
      rejectedIds: normalized.rejectedIds.slice(0, 20),
      duplicateAssignments: normalized.duplicateAssignments.slice(0, 20),
      validationFailures: normalized.validationFailures.slice(0, 20),
      aiGeneratedCount: normalized.groups.filter((group) => group.aiGenerated).length,
    },
  );

  return NextResponse.json({
    groups: normalized.groups,
    status: normalized.status,
    failureKind: normalized.failureKind,
    warning: statusWarning(normalized.status, normalized.failureKind),
  });
}
