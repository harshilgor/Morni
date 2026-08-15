export const FREE_SMALL_ORDER_FEE_THRESHOLD_AED = 99;
export const SMALL_ORDER_FEE_AED = 15;
export const DELIVERY_FEE_AED = 7;
export const SERVICE_FEE_AED = 3;
export const FULL_RETURN_CONVENIENCE_FEE_AED = 10;

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
  totalAed: number;
};

export function calculateCheckoutFees(itemSubtotalAed: number): CheckoutFees {
  const subtotal = roundAed(Math.max(0, itemSubtotalAed));
  const hasSmallOrderFee = subtotal < FREE_SMALL_ORDER_FEE_THRESHOLD_AED;
  const smallOrderFeeAed = hasSmallOrderFee ? SMALL_ORDER_FEE_AED : 0;

  return {
    itemSubtotalAed: subtotal,
    deliveryFeeAed: DELIVERY_FEE_AED,
    smallOrderFeeAed,
    serviceFeeAed: SERVICE_FEE_AED,
    convenienceFeeAed: 0,
    amountUntilNoSmallOrderFeeAed: hasSmallOrderFee
      ? roundAed(FREE_SMALL_ORDER_FEE_THRESHOLD_AED - subtotal)
      : 0,
    totalAed: roundAed(
      subtotal + DELIVERY_FEE_AED + smallOrderFeeAed + SERVICE_FEE_AED,
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
