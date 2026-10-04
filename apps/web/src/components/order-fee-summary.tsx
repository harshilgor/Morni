import { formatAed } from "@/lib/format";
import type { CheckoutFees } from "@/lib/fees";

export function OrderFeeLines({ fees }: { fees: CheckoutFees }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex justify-between gap-4">
        <span className="text-muted">Item price</span>
        <span>{formatAed(fees.itemSubtotalAed)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted">Delivery fee{fees.deliveryDistanceKm === null ? "" : ` · ${fees.deliveryDistanceKm} km`}</span>
        <span>
          {fees.deliveryDistanceKm === null ? "Confirm location" : formatAed(fees.deliveryFeeAed)}
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
      </div>
    </div>
  );
}
