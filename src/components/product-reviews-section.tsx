"use client";

import type { ProductReview } from "@/lib/types";
import { formatRatingLabel } from "@/lib/product-ratings";
import { StarRating } from "@/components/star-rating";
import { ProductReviewForm } from "@/components/product-review-form";

function formatReviewDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ProductReviewsSection({
  reviews,
  avgRating,
  reviewCount,
  canReview,
  reviewContext,
  existingReview,
  onReviewSaved,
}: {
  reviews: ProductReview[];
  avgRating: number | null;
  reviewCount: number;
  canReview?: {
    productId: string;
    orderId: string;
    orderItemId?: string | null;
  } | null;
  existingReview?: ProductReview | null;
  reviewContext?: {
    productId: string;
    orderId: string;
    orderItemId?: string | null;
  } | null;
  onReviewSaved?: () => void;
}) {
  const showForm = canReview || existingReview;
  const formContext = existingReview
    ? {
        productId: existingReview.product_id,
        orderId: existingReview.order_id,
        orderItemId: null as string | null,
      }
    : reviewContext ?? canReview ?? null;

  return (
    <section className="mt-12 rounded-[1.6rem] border border-line bg-white/70 p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl text-ink">What shoppers say</h2>
          {reviewCount > 0 && avgRating != null ? (
            <p className="mt-1 text-sm text-muted">
              {formatRatingLabel(avgRating)} average · {reviewCount}{" "}
              {reviewCount === 1 ? "verified review" : "verified reviews"}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">
              Verified reviews from shoppers who received their order.
            </p>
          )}
        </div>
        {reviewCount > 0 && avgRating != null ? (
          <div className="flex items-center gap-2 rounded-full bg-[#fff7e8] px-3 py-1.5">
            <StarRating value={avgRating} />
            <span className="text-sm font-medium text-[#8a6418]">
              {formatRatingLabel(avgRating)}
            </span>
          </div>
        ) : null}
      </div>

      {showForm && formContext ? (
        <div className="mt-6">
          <p className="mb-3 text-sm font-medium text-ink">
            {existingReview ? "Update your review" : "Write a review"}
          </p>
          <ProductReviewForm
            key={existingReview?.id ?? `${formContext.productId}-${formContext.orderId}`}
            productId={formContext.productId}
            orderId={formContext.orderId}
            orderItemId={formContext.orderItemId}
            existingReviewId={existingReview?.id}
            initialRating={existingReview?.rating}
            initialBody={existingReview?.body}
            onSaved={onReviewSaved}
          />
        </div>
      ) : null}

      {reviews.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          No reviews yet. Be the first after your order is delivered.
        </p>
      ) : (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {reviews.map((review) => (
            <article
              key={review.id}
              className="rounded-2xl border border-line bg-surface/80 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{review.shopper_name}</p>
                <span className="rounded-full bg-[#fff7e8] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#8a6418]">
                  Verified purchase
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <StarRating value={review.rating} />
                <span className="text-xs text-muted">
                  {formatReviewDate(review.created_at)}
                </span>
              </div>
              {review.body ? (
                <p className="mt-3 text-sm leading-relaxed text-muted">{review.body}</p>
              ) : null}
              {review.owner_reply ? (
                <div className="mt-4 rounded-xl border border-line/70 bg-white/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-accent-deep">
                    Store reply
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-ink">{review.owner_reply}</p>
                  {review.owner_replied_at ? (
                    <p className="mt-1 text-xs text-muted">
                      {formatReviewDate(review.owner_replied_at)}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
