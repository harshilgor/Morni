export const SMALL_ORDER_FEE_AED = 0;
export const FREE_DELIVERY_THRESHOLD_AED = 200;
export const SERVICE_FEE_AED = 3;
export const FULL_RETURN_CONVENIENCE_FEE_AED = 10;

/**
 * Delivery tiers are based on the merchandise subtotal before service fees.
 * The requested AED 100–150 tier is extended through AED 199.99 so there is
 * no undefined gap before free delivery starts at AED 200.
 */
export function deliveryFeeForSubtotal(subtotalAed: number) {
  const subtotal = Math.max(0, subtotalAed);
  if (subtotal >= FREE_DELIVERY_THRESHOLD_AED) return 0;
  if (subtotal >= 100) return 3;
  if (subtotal >= 50) return 5;
  return 7;
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
  amountUntilNoSmallOrderFeeAed: number;
  amountUntilFreeDeliveryAed: number;
  freeDeliveryProgress: number;
  progressTargetAed: number;
  progressMessage: "free_delivery" | "free_delivery_unlocked";
  totalAed: number;
};

export function calculateCheckoutFees(itemSubtotalAed: number): CheckoutFees {
  const subtotal = roundAed(Math.max(0, itemSubtotalAed));
  // Small-order surcharge removed; delivery is tiered by merchandise subtotal.
  const smallOrderFeeAed = SMALL_ORDER_FEE_AED;
  const deliveryFeeAed = deliveryFeeForSubtotal(subtotal);
  const qualifiesForFreeDelivery = deliveryFeeAed === 0;
  const progressTargetAed = FREE_DELIVERY_THRESHOLD_AED;

  return {
    itemSubtotalAed: subtotal,
    deliveryFeeAed,
    smallOrderFeeAed,
    serviceFeeAed: SERVICE_FEE_AED,
    convenienceFeeAed: 0,
    amountUntilNoSmallOrderFeeAed: 0,
    amountUntilFreeDeliveryAed: qualifiesForFreeDelivery
      ? 0
      : roundAed(FREE_DELIVERY_THRESHOLD_AED - subtotal),
    freeDeliveryProgress: Math.min(1, subtotal / progressTargetAed),
    progressTargetAed,
    progressMessage: qualifiesForFreeDelivery ? "free_delivery_unlocked" : "free_delivery",
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
