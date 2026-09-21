import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

type EmbeddingJob = { product_id: string; input_hash: string; canonical_text: string };

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 503 });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_product_embedding_jobs", { p_limit: 32 });
  if (error) return NextResponse.json({ error: "Unable to claim embedding work" }, { status: 500 });
  const jobs = (data ?? []) as EmbeddingJob[];
  if (jobs.length === 0) return NextResponse.json({ processed: 0, failed: 0 });

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: jobs.map((job) => job.canonical_text), dimensions: 512 }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) throw new Error(`Embedding provider returned ${response.status}`);
    const payload = (await response.json()) as { data?: { index: number; embedding: number[] }[] };
    const vectors = new Map((payload.data ?? []).map((item) => [item.index, item.embedding]));
    let processed = 0;
    let failed = 0;
    await Promise.all(jobs.map(async (job, index) => {
      const vector = vectors.get(index);
      if (!vector || vector.length !== 512) {
        failed += 1;
        await admin.rpc("fail_product_embedding_job", { p_product_id: job.product_id, p_input_hash: job.input_hash, p_error: "Provider omitted a valid 512-dimensional embedding" });
        return;
      }
      const { data: completed } = await admin.rpc("complete_product_embedding_job", {
        p_product_id: job.product_id,
        p_input_hash: job.input_hash,
        p_embedding: `[${vector.join(",")}]`,
        p_model: "text-embedding-3-small",
        p_version: "v1-512",
      });
      if (completed) processed += 1;
    }));
    return NextResponse.json({ processed, failed });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Embedding batch failed";
    await Promise.all(jobs.map((job) => admin.rpc("fail_product_embedding_job", {
      p_product_id: job.product_id,
      p_input_hash: job.input_hash,
      p_error: message,
    })));
    return NextResponse.json({ error: "Embedding batch failed", failed: jobs.length }, { status: 502 });
  }
}
