"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { StarRatingInput } from "@/components/star-rating";

export function ProductReviewForm({
  productId,
  orderId,
  orderItemId,
  existingReviewId,
  initialRating,
  initialBody,
  onSaved,
}: {
  productId: string;
  orderId: string;
  orderItemId?: string | null;
  existingReviewId?: string | null;
  initialRating?: number;
  initialBody?: string | null;
  onSaved?: () => void;
}) {
  const [rating, setRating] = useState(initialRating ?? 0);
  const [body, setBody] = useState(initialBody ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (rating < 1) {
      setMessage("Choose a star rating first.");
      return;
    }
    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setMessage("Sign in to leave a review.");
      setSaving(false);
      return;
    }

    const payload = {
      product_id: productId,
      order_id: orderId,
      order_item_id: orderItemId ?? null,
      shopper_id: user.id,
      rating,
      body: body.trim() ? body.trim() : null,
    };

    const { error } = existingReviewId
      ? await supabase
          .from("product_reviews")
          .update({ rating: payload.rating, body: payload.body })
          .eq("id", existingReviewId)
      : await supabase.from("product_reviews").insert(payload);

    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(existingReviewId ? "Review updated." : "Thanks for your review!");
    onSaved?.();
  }

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-surface/80 p-5">
      <div>
        <p className="text-sm font-medium text-ink">Your rating</p>
        <div className="mt-2">
          <StarRatingInput value={rating} onChange={setRating} disabled={saving} />
        </div>
      </div>
      <div>
        <label htmlFor={`review-body-${productId}`} className="text-sm font-medium text-ink">
          Your review <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id={`review-body-${productId}`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="How was the fit, fabric, and delivery experience?"
          className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink/40"
          disabled={saving}
        />
      </div>
      {message ? (
        <p className="text-sm text-accent-deep" role="status">
          {message}
        </p>
      ) : null}
      <button
        type="button"
        onClick={submit}
        disabled={saving || rating < 1}
        className="rounded-full bg-ink px-5 py-2.5 text-sm text-white disabled:opacity-40"
      >
        {saving
          ? "Saving…"
          : existingReviewId
            ? "Update review"
            : "Submit review"}
      </button>
    </div>
  );
}
