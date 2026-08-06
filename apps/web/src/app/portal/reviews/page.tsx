"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useOwnerStore } from "@/lib/use-owner-store";
import { StarRating } from "@/components/star-rating";
import type { Product, ProductReview } from "@/lib/types";

type ReviewRow = ProductReview & {
  products: { title: string } | null;
};

export default function PortalReviewsPage() {
  const { store, loading, error } = useOwnerStore();
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [ratingFilter, setRatingFilter] = useState<"all" | "5" | "4" | "3" | "2" | "1">(
    "all",
  );
  const [productFilter, setProductFilter] = useState<string>("all");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!store) return;
    const supabase = createClient();
    Promise.all([
      supabase
        .from("product_reviews")
        .select("*, products(title)")
        .eq("store_id", store.id)
        .order("created_at", { ascending: false }),
      supabase.from("products").select("*").eq("store_id", store.id).order("title"),
    ]).then(([reviewsRes, productsRes]) => {
      const rows = (reviewsRes.data as ReviewRow[]) ?? [];
      setReviews(rows);
      setProducts((productsRes.data as Product[]) ?? []);
      setReplyDrafts(
        rows.reduce<Record<string, string>>((acc, row) => {
          acc[row.id] = row.owner_reply ?? "";
          return acc;
        }, {}),
      );
    });
  }, [store]);

  const filtered = useMemo(() => {
    return reviews.filter((review) => {
      if (ratingFilter !== "all" && review.rating !== Number(ratingFilter)) {
        return false;
      }
      if (productFilter !== "all" && review.product_id !== productFilter) {
        return false;
      }
      return true;
    });
  }, [reviews, ratingFilter, productFilter]);

  const summary = useMemo(() => {
    if (reviews.length === 0) {
      return { avgRating: 0, total: 0, unreplied: 0 };
    }
    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    return {
      avgRating: Number((sum / reviews.length).toFixed(1)),
      total: reviews.length,
      unreplied: reviews.filter((review) => !review.owner_reply?.trim()).length,
    };
  }, [reviews]);

  async function saveReply(reviewId: string) {
    setSavingId(reviewId);
    setMessage(null);
    const supabase = createClient();
    const reply = replyDrafts[reviewId]?.trim() ?? "";
    const { error: err } = await supabase
      .from("product_reviews")
      .update({ owner_reply: reply || null })
      .eq("id", reviewId);
    setSavingId(null);
    if (err) {
      setMessage(err.message);
      return;
    }
    setReviews((current) =>
      current.map((review) =>
        review.id === reviewId
          ? {
              ...review,
              owner_reply: reply || null,
              owner_replied_at: reply ? new Date().toISOString() : null,
            }
          : review,
      ),
    );
    setMessage("Reply saved.");
  }

  if (error === "unauthenticated") {
    return (
      <div>
        <p className="text-muted">Sign in as a store owner to manage reviews.</p>
        <Link href="/auth?next=/portal/reviews" className="mt-3 inline-block text-accent-deep underline">
          Sign in
        </Link>
      </div>
    );
  }

  if (loading) return <p className="text-muted">Loading reviews…</p>;

  if (!store) {
    return (
      <div>
        <p className="text-muted">Finish store setup to see product reviews.</p>
        <Link href="/sell/setup" className="mt-3 inline-block text-accent-deep underline">
          Continue setup
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink">Reviews</h1>
        <p className="mt-1 text-sm text-muted">
          Verified feedback from shoppers who received their orders.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Average rating" value={summary.avgRating > 0 ? `${summary.avgRating} ★` : "—"} />
        <StatCard label="Total reviews" value={String(summary.total)} />
        <StatCard label="Awaiting reply" value={String(summary.unreplied)} />
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "5", "4", "3", "2", "1"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRatingFilter(value)}
            className={`rounded-full border px-3 py-1.5 text-xs ${
              ratingFilter === value
                ? "border-ink bg-ink text-white"
                : "border-line bg-surface text-ink"
            }`}
          >
            {value === "all" ? "All ratings" : `${value} stars`}
          </button>
        ))}
        <label className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs">
          <span className="text-muted">Product</span>
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="bg-transparent text-xs font-medium outline-none"
          >
            <option value="all">All products</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      {message ? (
        <p className="rounded-xl bg-[#fff0f4] px-4 py-3 text-sm text-accent-deep" role="status">
          {message}
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface/70 p-10 text-center">
          <p className="text-muted">No reviews yet for your products.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {filtered.map((review) => (
            <li
              key={review.id}
              className="rounded-2xl border border-line bg-surface p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {review.products?.title ?? "Product"}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {review.shopper_name} ·{" "}
                    {new Date(review.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <StarRating value={review.rating} />
              </div>
              {review.body ? (
                <p className="mt-3 text-sm leading-relaxed text-ink/90">{review.body}</p>
              ) : (
                <p className="mt-3 text-sm italic text-muted">No written comment.</p>
              )}
              <div className="mt-4 space-y-2">
                <label htmlFor={`reply-${review.id}`} className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Your public reply
                </label>
                <textarea
                  id={`reply-${review.id}`}
                  value={replyDrafts[review.id] ?? ""}
                  onChange={(e) =>
                    setReplyDrafts((current) => ({
                      ...current,
                      [review.id]: e.target.value,
                    }))
                  }
                  rows={3}
                  maxLength={1000}
                  placeholder="Thank the shopper or share sizing tips for future buyers."
                  className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink/40"
                />
                <button
                  type="button"
                  onClick={() => saveReply(review.id)}
                  disabled={savingId === review.id}
                  className="rounded-full bg-ink px-4 py-2 text-sm text-white disabled:opacity-40"
                >
                  {savingId === review.id ? "Saving…" : "Save reply"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-2 font-display text-3xl text-ink">{value}</p>
    </div>
  );
}
