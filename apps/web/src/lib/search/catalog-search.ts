import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { productSatisfiesCentralIntent, understandSearchQuery, type SearchIntent } from "./query-understanding";
import type { BrowsableProduct } from "@/components/product-browser";

type LexicalCandidate = {
  product_id: string;
  lexical_rank: number;
  structured_rank: number;
  fuzzy_rank: number;
  relevance_class: "exact" | "substitute" | "complement" | "irrelevant";
};

type SemanticCandidate = { product_id: string; semantic_rank: number };

export type RankedSearchProduct = BrowsableProduct & {
  search_score?: number;
  search_relevance?: "exact" | "substitute";
  search_sources?: string[];
};

export type CatalogSearchResult = {
  intent: SearchIntent;
  products: RankedSearchProduct[];
  exactCount: number;
  substituteCount: number;
  candidateCounts: { lexical: number; semantic: number; fused: number };
  latencyMs: number;
};

const queryEmbeddingCache = new Map<string, { embedding: number[]; expires: number }>();

async function safeLexicalFallback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  intent: SearchIntent,
) {
  const candidates = new Map<string, LexicalCandidate>();
  if (intent.category) {
    const { data: categories } = await supabase.from("categories").select("id").eq("slug", intent.category);
    const categoryIds = (categories ?? []).map((category) => category.id);
    if (categoryIds.length > 0) {
      const { data } = await supabase.from("storefront_products").select("id").in("category_id", categoryIds).eq("is_available", true).limit(200);
      (data ?? []).forEach((product) => candidates.set(product.id, {
        product_id: product.id,
        lexical_rank: 0.5,
        structured_rank: 1,
        fuzzy_rank: 0,
        relevance_class: "exact",
      }));
    }
  }

  const titleTerms = intent.category
    ? intent.tokens.filter((token) => !["women", "womens", "woman", "ladies"].includes(token))
    : intent.tokens;
  if (titleTerms.length > 0) {
    const titleFilter = titleTerms.map((token) => `title.ilike.%${token.replace(/[,%().]/g, " ")}%`).join(",");
    const { data } = await supabase.from("storefront_products").select("id").eq("is_available", true).or(titleFilter).limit(200);
    (data ?? []).forEach((product) => {
      if (!candidates.has(product.id)) candidates.set(product.id, {
        product_id: product.id,
        lexical_rank: 0.25,
        structured_rank: 0,
        fuzzy_rank: 0,
        relevance_class: intent.category ? "substitute" : "exact",
      });
    });
  }
  return [...candidates.values()];
}

async function createQueryEmbedding(query: string, enabled: boolean) {
  if (!enabled || !process.env.OPENAI_API_KEY) return null;
  const cached = queryEmbeddingCache.get(query);
  if (cached && cached.expires > Date.now()) return cached.embedding;

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "text-embedding-3-small", input: query, dimensions: 512 }),
      signal: AbortSignal.timeout(1_800),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { data?: { embedding?: number[] }[] };
    const embedding = json.data?.[0]?.embedding;
    if (!embedding || embedding.length !== 512) return null;
    queryEmbeddingCache.set(query, { embedding, expires: Date.now() + 30 * 60_000 });
    if (queryEmbeddingCache.size > 500) queryEmbeddingCache.delete(queryEmbeddingCache.keys().next().value!);
    return embedding;
  } catch {
    return null;
  }
}

function reciprocalRank(rank: number, weight: number) {
  return weight / (60 + rank);
}

export async function searchCatalog(
  rawQuery: string,
  options: { limit?: number; semantic?: boolean } = {},
): Promise<CatalogSearchResult> {
  const started = performance.now();
  const intent = understandSearchQuery(rawQuery);
  const limit = Math.max(1, Math.min(options.limit ?? 48, 100));
  if (!intent.normalizedQuery) {
    return { intent, products: [], exactCount: 0, substituteCount: 0, candidateCounts: { lexical: 0, semantic: 0, fused: 0 }, latencyMs: 0 };
  }

  const supabase = await createClient();
  const embeddingPromise = createQueryEmbedding(intent.normalizedQuery, options.semantic !== false);
  const lexicalPromise = supabase.rpc("search_catalog_lexical", {
    p_query: intent.normalizedQuery,
    p_limit: 250,
  });
  const [lexicalResponse, embedding] = await Promise.all([lexicalPromise, embeddingPromise]);
  const lexical = lexicalResponse.error
    ? await safeLexicalFallback(supabase, intent)
    : (lexicalResponse.data ?? []) as LexicalCandidate[];

  let semantic: SemanticCandidate[] = [];
  if (embedding && !lexicalResponse.error) {
    const vectorLiteral = `[${embedding.join(",")}]`;
    const semanticResponse = await supabase.rpc("search_catalog_semantic", {
      p_embedding: vectorLiteral,
      p_limit: 200,
    });
    semantic = (semanticResponse.data ?? []) as SemanticCandidate[];
  }

  const fusion = new Map<string, { score: number; lexical?: LexicalCandidate; semantic?: SemanticCandidate; sources: string[] }>();
  lexical.forEach((candidate, index) => {
    const exactBoost = candidate.relevance_class === "exact" ? 0.03 : 0.012;
    fusion.set(candidate.product_id, {
      score: reciprocalRank(index + 1, 0.4) + exactBoost + Math.min(candidate.structured_rank, 3) * 0.01,
      lexical: candidate,
      sources: ["lexical", ...(candidate.structured_rank > 0 ? ["structured"] : [])],
    });
  });
  semantic.forEach((candidate, index) => {
    const current = fusion.get(candidate.product_id) ?? { score: 0, sources: [] };
    current.score += reciprocalRank(index + 1, 0.25) + Math.max(0, candidate.semantic_rank) * 0.004;
    current.semantic = candidate;
    current.sources.push("semantic");
    fusion.set(candidate.product_id, current);
  });

  const ids = [...fusion.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 300)
    .map(([id]) => id);
  if (ids.length === 0) {
    return { intent, products: [], exactCount: 0, substituteCount: 0, candidateCounts: { lexical: lexical.length, semantic: semantic.length, fused: 0 }, latencyMs: Math.round(performance.now() - started) };
  }

  const { data } = await supabase
    .from("storefront_products")
    .select("*, category:categories(name, slug), stores!inner(id, slug, name, is_active, emirate, area, delivery_eta_minutes)")
    .in("id", ids)
    .eq("is_available", true)
    .eq("stores.is_active", true);

  const ranked = ((data ?? []) as unknown as RankedSearchProduct[])
    .filter((product) => productSatisfiesCentralIntent(intent, product))
    .map((product) => {
      const signals = fusion.get(product.id)!;
      const relevance = signals.lexical?.relevance_class === "substitute" ? "substitute" as const : "exact" as const;
      return { ...product, search_score: signals.score, search_relevance: relevance, search_sources: [...new Set(signals.sources)] };
    })
    .sort((a, b) => (b.search_score ?? 0) - (a.search_score ?? 0));

  const exact = ranked.filter((product) => product.search_relevance === "exact");
  const substitutes = ranked.filter((product) => product.search_relevance === "substitute");
  const products = [...exact, ...substitutes].slice(0, limit);
  return {
    intent,
    products,
    exactCount: exact.length,
    substituteCount: substitutes.length,
    candidateCounts: { lexical: lexical.length, semantic: semantic.length, fused: fusion.size },
    latencyMs: Math.round(performance.now() - started),
  };
}

export async function searchStores(query: string, limit = 4) {
  const admin = createAdminClient();
  const normalized = understandSearchQuery(query).normalizedQuery.replace(/[,%().]/g, " ");
  if (!normalized) return [];
  const { data } = await admin
    .from("stores")
    .select("id, name, slug, area, emirate")
    .eq("is_active", true)
    .or(`name.ilike.%${normalized}%,area.ilike.%${normalized}%`)
    .order("name")
    .limit(limit);
  return data ?? [];
}
