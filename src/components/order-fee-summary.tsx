import { formatAed } from "@/lib/format";
import {
  FREE_DELIVERY_THRESHOLD_AED,
  type CheckoutFees,
} from "@/lib/fees";

export function SmallOrderNudge({ fees }: { fees: CheckoutFees }) {
  if (fees.amountUntilNoSmallOrderFeeAed <= 0) return null;

  return (
    <div className="mb-3 rounded-xl bg-[#fff0f4] px-4 py-3 text-sm leading-relaxed text-accent-deep">
      Add <strong>{formatAed(fees.amountUntilNoSmallOrderFeeAed)}</strong> more
      to your cart to avoid the AED 15 small order fee
    </div>
  );
}

export function FreeDeliveryNudge({ fees }: { fees: CheckoutFees }) {
  const unlocked = fees.amountUntilFreeDeliveryAed <= 0;
  const progressPercent = Math.round(fees.freeDeliveryProgress * 100);

  return (
    <div className="mb-5 rounded-xl bg-[#fff0f4] px-4 py-3 text-sm leading-relaxed text-accent-deep">
      {unlocked ? (
        <p>
          You’ve unlocked <strong>free delivery</strong>
        </p>
      ) : fees.progressMessage === "small_order_fee" ? (
        <p>
          Add <strong>{formatAed(fees.amountUntilNoSmallOrderFeeAed)}</strong> more
          to remove the small order fee
        </p>
      ) : (
        <p>
          Add <strong>{formatAed(fees.amountUntilFreeDeliveryAed)}</strong> more
          for free delivery
        </p>
      )}
      <div
        className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/80"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent}
        aria-label={
          unlocked
            ? "Free delivery unlocked"
            : fees.progressMessage === "small_order_fee"
              ? "Progress toward removing the small order fee at AED 99"
              : `Progress toward free delivery at ${formatAed(FREE_DELIVERY_THRESHOLD_AED)}`
        }
      >
        <div
          className="h-full rounded-full bg-accent-deep transition-[width] duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      {!unlocked ? (
        <p className="mt-1.5 text-xs text-accent-deep/75">
          {fees.progressMessage === "small_order_fee"
            ? "Small order fee removed on orders of AED 99+"
            : `Free delivery on orders of ${formatAed(FREE_DELIVERY_THRESHOLD_AED)}+`}
        </p>
      ) : null}
    </div>
  );
}

export function OrderFeeLines({ fees }: { fees: CheckoutFees }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex justify-between gap-4">
        <span className="text-muted">Item price</span>
        <span>{formatAed(fees.itemSubtotalAed)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted">Delivery fee</span>
        <span>
          {fees.deliveryFeeAed > 0 ? formatAed(fees.deliveryFeeAed) : "Free"}
        </span>
      </div>
      {fees.smallOrderFeeAed > 0 ? (
        <div className="flex justify-between gap-4">
          <span className="text-muted">Small order fee</span>
          <span>{formatAed(fees.smallOrderFeeAed)}</span>
        </div>
      ) : null}
      <div className="flex justify-between gap-4">
        <span className="text-muted">Service fee</span>
        <span>{formatAed(fees.serviceFeeAed)}</span>
      </div>
      <div>
        <div className="flex justify-between gap-4">
          <span className="text-muted">Convenience fee</span>
          <span aria-label="Not charged">–</span>
        </div>
        <p className="mt-1 max-w-72 text-xs leading-relaxed text-muted">
          (Only applies if you return all items — AED 10 will be deducted from
          your refund)
        </p>
      </div>
    </div>
  );
}
