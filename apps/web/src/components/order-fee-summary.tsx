import { formatAed } from "@/lib/format";
import type { CheckoutFees } from "@/lib/fees";

export function SmallOrderNudge({ fees }: { fees: CheckoutFees }) {
  if (fees.amountUntilNoSmallOrderFeeAed <= 0) return null;

  return (
    <div className="mb-5 rounded-xl bg-[#fff0f4] px-4 py-3 text-sm leading-relaxed text-accent-deep">
      Add <strong>{formatAed(fees.amountUntilNoSmallOrderFeeAed)}</strong> more
      to your cart to avoid the AED 15 small order fee
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
        <span>{formatAed(fees.deliveryFeeAed)}</span>
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
