export const SMALL_ORDER_FEE_AED = 0;
export const SERVICE_FEE_AED = 3;
export const FULL_RETURN_CONVENIENCE_FEE_AED = 10;

/** Road distance is passed in integer metres so the 10 km and 15 km limits
 * are exact and do not depend on display rounding. */
export function deliveryFeeForDistanceMeters(distanceMeters: number) {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) {
    throw new Error("A valid driving distance is required.");
  }
  if (distanceMeters <= 10_000) return 7;
  if (distanceMeters <= 15_000) return 10;
  return 15;
}

function roundAed(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export type CheckoutFees = {
  itemSubtotalAed: number;
  deliveryFeeAed: number;
  smallOrderFeeAed: number;
  serviceFeeAed: number;
  convenienceFeeAed: 0;
  deliveryDistanceKm: number | null;
  totalAed: number;
};

export function calculateCheckoutFees(itemSubtotalAed: number, deliveryDistanceMeters: number | null): CheckoutFees {
  const subtotal = roundAed(Math.max(0, itemSubtotalAed));
  const smallOrderFeeAed = SMALL_ORDER_FEE_AED;
  const deliveryFeeAed = deliveryDistanceMeters === null
    ? 0
    : deliveryFeeForDistanceMeters(deliveryDistanceMeters);

  return {
    itemSubtotalAed: subtotal,
    deliveryFeeAed,
    smallOrderFeeAed,
    serviceFeeAed: SERVICE_FEE_AED,
    convenienceFeeAed: 0,
    deliveryDistanceKm: deliveryDistanceMeters === null ? null : Number((deliveryDistanceMeters / 1000).toFixed(3)),
    totalAed: roundAed(
      subtotal + deliveryFeeAed + smallOrderFeeAed + SERVICE_FEE_AED,
    ),
  };
}

export type RefundBreakdown = {
  returnedItemPriceAed: number;
  smallOrderFeeRefundAed: number;
  deliveryFeeRefundAed: 0;
  serviceFeeRefundAed: 0;
  convenienceFeeDeductionAed: number;
  isFullReturn: boolean;
  refundAmountAed: number;
};

export function calculateRefund({
  returnedItemPriceAed,
  originalItemSubtotalAed,
  originalSmallOrderFeeAed,
}: {
  returnedItemPriceAed: number;
  originalItemSubtotalAed: number;
  originalSmallOrderFeeAed: number;
}): RefundBreakdown {
  const returnedItemPrice = roundAed(Math.max(0, returnedItemPriceAed));
  const originalItemSubtotal = roundAed(Math.max(0, originalItemSubtotalAed));
  const isFullReturn =
    originalItemSubtotal > 0 && returnedItemPrice >= originalItemSubtotal;
  const smallOrderFeeRefundAed = isFullReturn
    ? roundAed(Math.max(0, originalSmallOrderFeeAed))
    : 0;
  const convenienceFeeDeductionAed = isFullReturn
    ? FULL_RETURN_CONVENIENCE_FEE_AED
    : 0;

  return {
    returnedItemPriceAed: returnedItemPrice,
    smallOrderFeeRefundAed,
    deliveryFeeRefundAed: 0,
    serviceFeeRefundAed: 0,
    convenienceFeeDeductionAed,
    isFullReturn,
    refundAmountAed: roundAed(
      Math.max(
        0,
        returnedItemPrice +
          smallOrderFeeRefundAed -
          convenienceFeeDeductionAed,
      ),
    ),
  };
}
