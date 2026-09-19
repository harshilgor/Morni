import type { InternalImageRef } from "./types";

export type VisionProvider = "Gemini" | "OpenAI";

export type VisionProviderResult =
  | { ok: true; text: string; latencyMs: number; attempts: number }
  | {
      ok: false;
      kind: "provider_timeout" | "provider_error" | "model_failure";
      status?: number;
      latencyMs: number;
      attempts: number;
      message: string;
    };

const PROVIDER_TIMEOUT_MS = 45_000;
const MAX_ATTEMPTS = 2;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(error: unknown, status?: number) {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return true;
  }
  if (status === 429 || status === 503 || status === 502) return true;
  return false;
}

export function buildVisionPrompt(options: {
  categories: Array<{ name: string; slug: string }>;
  internalIds: string[];
}) {
  return [
    "You are analysing fashion product photos for a UAE marketplace (Morni).",
    "Task 1 — GROUPING: Decide which images show the same sellable product (same garment/design). Different fabrics, prints, or designs are different products. Different angles/close-ups of the same item belong together.",
    "Task 2 — LISTING: For each product group, write a concise customer-facing title and a natural 2–3 sentence description (about 45–90 words) based ONLY on visually observable characteristics.",
    "Analyze the garment shown in the supplied images and generate a concise customer-facing product title based only on visually observable characteristics. Never derive or copy a product title, category, description, or attribute from the filename, image ID, UUID, metadata, or upload order. Filenames and internal image IDs exist only to identify images and contain no product information.",
    "Never invent brand, exact fabric when unclear, measurements, care instructions, price, stock, sizes, or SKU.",
    "Use ONLY these image IDs in imageIds arrays. Every ID must appear exactly once across all groups:",
    options.internalIds.join(", "),
    `Choose categorySlug only from this list (or empty string if unsure): ${JSON.stringify(options.categories)}`,
    "Return JSON with shape: { groups: [{ imageIds, title, description, categorySlug, colorName, confidence, needsReview, colorGroups: [{ imageIds, colorName, confidence, needsReview }] }] }.",
    "colorGroups may be a single group with empty colorName when colourways are unclear — sellers add colours manually.",
  ].join("\n");
}

export function buildGeminiSchema(internalIds: string[]) {
  const imageIdSchema = {
    type: "STRING",
    enum: internalIds,
  };
  const colorGroupSchema = {
    type: "OBJECT",
    properties: {
      imageIds: { type: "ARRAY", minItems: 1, items: imageIdSchema },
      colorName: { type: "STRING" },
      confidence: { type: "NUMBER" },
      needsReview: { type: "BOOLEAN" },
    },
    required: ["imageIds", "colorName", "confidence", "needsReview"],
  };
  return {
    type: "OBJECT",
    properties: {
      groups: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            imageIds: { type: "ARRAY", minItems: 1, items: imageIdSchema },
            title: { type: "STRING" },
            description: { type: "STRING" },
            categorySlug: { type: "STRING" },
            colorName: { type: "STRING" },
            confidence: { type: "NUMBER" },
            needsReview: { type: "BOOLEAN" },
            colorGroups: { type: "ARRAY", items: colorGroupSchema },
          },
          required: [
            "imageIds",
            "title",
            "description",
            "categorySlug",
            "colorName",
            "confidence",
            "needsReview",
            "colorGroups",
          ],
        },
      },
    },
    required: ["groups"],
  };
}

export function buildOpenAiSchema(internalIds: string[]) {
  const imageIdSchema = { type: "string" as const, enum: internalIds };
  return {
    type: "object" as const,
    additionalProperties: false,
    properties: {
      groups: {
        type: "array" as const,
        minItems: 1,
        maxItems: 30,
        items: {
          type: "object" as const,
          additionalProperties: false,
          properties: {
            imageIds: {
              type: "array" as const,
              minItems: 1,
              items: imageIdSchema,
            },
            title: { type: "string" as const },
            description: { type: "string" as const },
            categorySlug: { type: "string" as const },
            colorName: { type: "string" as const },
            confidence: { type: "number" as const, minimum: 0, maximum: 1 },
            needsReview: { type: "boolean" as const },
            colorGroups: {
              type: "array" as const,
              items: {
                type: "object" as const,
                additionalProperties: false,
                properties: {
                  imageIds: {
                    type: "array" as const,
                    minItems: 1,
                    items: imageIdSchema,
                  },
                  colorName: { type: "string" as const },
                  confidence: { type: "number" as const },
                  needsReview: { type: "boolean" as const },
                },
                required: ["imageIds", "colorName", "confidence", "needsReview"],
              },
            },
          },
          required: [
            "imageIds",
            "title",
            "description",
            "categorySlug",
            "colorName",
            "confidence",
            "needsReview",
            "colorGroups",
          ],
        },
      },
    },
    required: ["groups"],
  };
}

function extractOutputText(payload: {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}) {
  return (
    payload.output_text ??
    payload.output?.flatMap((item) => item.content ?? []).map((part) => part.text ?? "").join("") ??
    payload.candidates
      ?.flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("") ??
    ""
  );
}

export async function callVisionProvider(options: {
  provider: VisionProvider;
  apiKey: string;
  model: string;
  prompt: string;
  refs: InternalImageRef[];
  images: Array<{ data: string }>;
}): Promise<VisionProviderResult> {
  const started = Date.now();
  let attempts = 0;
  let lastError = "provider_error";

  while (attempts < MAX_ATTEMPTS) {
    attempts += 1;
    try {
      const response = await fetch(
        options.provider === "Gemini"
          ? `https://generativelanguage.googleapis.com/v1beta/models/${options.model}:generateContent?key=${encodeURIComponent(options.apiKey)}`
          : "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(options.provider === "OpenAI"
              ? { Authorization: `Bearer ${options.apiKey}` }
              : {}),
          },
          signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
          body: JSON.stringify(
            options.provider === "Gemini"
              ? {
                  contents: [
                    {
                      parts: [
                        { text: options.prompt },
                        ...options.refs.flatMap((ref, index) => [
                          { text: `IMAGE ID: ${ref.internalId}` },
                          {
                            inline_data: {
                              mime_type:
                                options.images[index]?.data.match(
                                  /^data:(image\/[a-z]+);base64,/i,
                                )?.[1] ?? "image/jpeg",
                              data: options.images[index]?.data.replace(
                                /^data:image\/[a-z]+;base64,/i,
                                "",
                              ),
                            },
                          },
                        ]),
                      ],
                    },
                  ],
                  generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: buildGeminiSchema(
                      options.refs.map((ref) => ref.internalId),
                    ),
                  },
                }
              : {
                  model: options.model,
                  store: false,
                  input: [
                    {
                      role: "user",
                      content: [
                        { type: "input_text", text: options.prompt },
                        ...options.refs.flatMap((ref, index) => [
                          {
                            type: "input_text",
                            text: `IMAGE ID: ${ref.internalId}`,
                          },
                          {
                            type: "input_image",
                            image_url: options.images[index]?.data,
                            detail: "high",
                          },
                        ]),
                      ],
                    },
                  ],
                  text: {
                    format: {
                      type: "json_schema",
                      name: "product_photo_groups",
                      strict: true,
                      schema: buildOpenAiSchema(
                        options.refs.map((ref) => ref.internalId),
                      ),
                    },
                  },
                },
          ),
        },
      );

      if (!response.ok) {
        lastError = `http_${response.status}`;
        if (attempts < MAX_ATTEMPTS && isRetryable(undefined, response.status)) {
          await sleep(400 * attempts);
          continue;
        }
        return {
          ok: false,
          kind: response.status === 404 ? "model_failure" : "provider_error",
          status: response.status,
          latencyMs: Date.now() - started,
          attempts,
          message: lastError,
        };
      }

      const payload = (await response.json()) as Parameters<typeof extractOutputText>[0];
      const text = extractOutputText(payload);
      if (!text.trim()) {
        return {
          ok: false,
          kind: "model_failure",
          latencyMs: Date.now() - started,
          attempts,
          message: "empty_model_output",
        };
      }
      return {
        ok: true,
        text,
        latencyMs: Date.now() - started,
        attempts,
      };
    } catch (error) {
      const timedOut =
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError");
      lastError = error instanceof Error ? error.name : "unknown";
      if (attempts < MAX_ATTEMPTS && isRetryable(error)) {
        await sleep(500 * attempts);
        continue;
      }
      return {
        ok: false,
        kind: timedOut ? "provider_timeout" : "provider_error",
        latencyMs: Date.now() - started,
        attempts,
        message: lastError,
      };
    }
  }

  return {
    ok: false,
    kind: "provider_error",
    latencyMs: Date.now() - started,
    attempts,
    message: lastError,
  };
}
