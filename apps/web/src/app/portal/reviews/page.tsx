"use client";

import { useEffect, useMemo, useState } from "react";
import { PortalEmpty, PortalMetric, PortalPageHeader } from "@/components/portal-ui";
import { StarRating } from "@/components/star-rating";
import { createClient } from "@/lib/supabase/client";
import { useOwnerStore } from "@/lib/use-owner-store";
import type { Product, ProductReview } from "@/lib/types";

type ReviewRow = ProductReview & { products: { title: string } | null };

export default function PortalReviewsPage() {
  const { store, loading, error } = useOwnerStore();
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [ratingFilter, setRatingFilter] = useState<"all" | "5" | "4" | "3" | "2" | "1">("all");
  const [productFilter, setProductFilter] = useState("all");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!store) return;
    const supabase = createClient();
    void Promise.all([
      supabase.from("product_reviews").select("*, products(title)").eq("store_id", store.id).order("created_at", { ascending: false }),
      supabase.from("products").select("*").eq("store_id", store.id).order("title"),
    ]).then(([reviewsResult, productsResult]) => {
      const rows = (reviewsResult.data as ReviewRow[]) ?? [];
      setReviews(rows);
      setProducts((productsResult.data as Product[]) ?? []);
      setReplyDrafts(rows.reduce<Record<string, string>>((acc, row) => {
        acc[row.id] = row.owner_reply ?? "";
        return acc;
      }, {}));
    });
  }, [store]);

  const filtered = useMemo(() => reviews.filter((review) => {
    if (ratingFilter !== "all" && review.rating !== Number(ratingFilter)) return false;
    if (productFilter !== "all" && review.product_id !== productFilter) return false;
    return true;
  }), [productFilter, ratingFilter, reviews]);

  const summary = useMemo(() => {
    const total = reviews.length;
    return {
      total,
      average: total ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / total).toFixed(1)) : 0,
      unreplied: reviews.filter((review) => !review.owner_reply?.trim()).length,
    };
  }, [reviews]);

  async function saveReply(reviewId: string) {
    setSavingId(reviewId);
    setMessage(null);
    const reply = replyDrafts[reviewId]?.trim() ?? "";
    const { error: updateError } = await createClient().from("product_reviews").update({ owner_reply: reply || null }).eq("id", reviewId);
    setSavingId(null);
    if (updateError) {
      setMessage(updateError.message);
      return;
    }
    setReviews((current) => current.map((review) => review.id === reviewId ? { ...review, owner_reply: reply || null, owner_replied_at: reply ? new Date().toISOString() : null } : review));
    setMessage("Reply saved.");
  }

  if (error === "unauthenticated") return <PortalEmpty icon="reviews" title="Sign in to manage customer reviews" description="Use the owner account linked to your Morni store." action={{ label: "Sign in", href: "/auth?next=/portal/reviews" }} />;
  if (loading) return <div className="grid gap-4 sm:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-white/65" />)}</div>;
  if (!store) return <PortalEmpty icon="store" title="Set up a store to see reviews" description="Verified feedback appears after shoppers receive and review their orders." action={{ label: "Start store setup", href: "/sell/setup" }} />;

  return <div className="space-y-6">
    <PortalPageHeader eyebrow="Customer trust" title="Reviews" description="Verified feedback from shoppers who received their orders. Reply quickly to help future customers buy with confidence." />
    <div className="grid gap-3 sm:grid-cols-3"><PortalMetric label="Average rating" value={summary.average ? `${summary.average} stars` : "-"} detail="From verified buyers" icon="reviews" /><PortalMetric label="Total reviews" value={String(summary.total)} detail="Across your catalog" icon="sparkle" /><PortalMetric label="Awaiting reply" value={String(summary.unreplied)} detail="Acknowledge feedback promptly" icon="warning" tone={summary.unreplied ? "urgent" : "default"} /></div>
    <section className="portal-card flex flex-wrap gap-2 p-3">{(["all", "5", "4", "3", "2", "1"] as const).map((value) => <button key={value} type="button" onClick={() => setRatingFilter(value)} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${ratingFilter === value ? "bg-[#21342e] text-white" : "border border-[#dce5e0] bg-white text-[#5b6a64] hover:border-[#afc2bb]"}`}>{value === "all" ? "All ratings" : `${value} stars`}</button>)}<label className="ml-auto flex items-center gap-2 rounded-lg border border-[#dce5e0] bg-white px-3 py-1.5 text-xs"><span className="text-[#66736e]">Product</span><select value={productFilter} onChange={(event) => setProductFilter(event.target.value)} className="bg-transparent text-xs font-semibold text-[#34423d] outline-none"><option value="all">All products</option>{products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}</select></label></section>
    {message ? <p role="status" className="rounded-xl bg-[#edf7f3] px-4 py-3 text-sm text-[#277044]">{message}</p> : null}
    {filtered.length ? <ul className="grid gap-4 xl:grid-cols-2">{filtered.map((review) => <li key={review.id} className="portal-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-[#263530]">{review.products?.title ?? "Product"}</p><p className="mt-1 text-xs text-[#7b8882]">{review.shopper_name} - {new Date(review.created_at).toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric" })}</p></div><StarRating value={review.rating} /></div>{review.body ? <p className="mt-3 text-sm leading-relaxed text-[#40534d]">{review.body}</p> : <p className="mt-3 text-sm italic text-[#7b8882]">No written comment.</p>}<div className="mt-4 border-t border-[#edf1ef] pt-4"><label htmlFor={`reply-${review.id}`} className="portal-eyebrow">Your public reply</label><textarea id={`reply-${review.id}`} value={replyDrafts[review.id] ?? ""} onChange={(event) => setReplyDrafts((current) => ({ ...current, [review.id]: event.target.value }))} rows={3} maxLength={1000} placeholder="Thank the shopper or share sizing tips for future buyers." className="portal-input mt-2 w-full" /><button type="button" onClick={() => saveReply(review.id)} disabled={savingId === review.id} className="portal-button-primary mt-3 disabled:opacity-40">{savingId === review.id ? "Saving" : "Save reply"}</button></div></li>)}</ul> : <PortalEmpty icon="reviews" title="No reviews match these filters" description="Verified customer feedback will appear here after shoppers receive their orders." />}
  </div>;
}
