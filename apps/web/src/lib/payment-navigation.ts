type AssignLocation = (url: string) => void;

export function paymentPagePath(orderId: string) {
  return `/checkout/pay/${encodeURIComponent(orderId)}`;
}

/**
 * Payment pages require a fresh document so their route-specific CSP can
 * permit issuer-controlled 3DS frames. Next.js client navigation would keep
 * the CSP of the storefront document that initiated checkout.
 */
export function navigateToPaymentPage(
  orderId: string,
  assign: AssignLocation = (url) => window.location.assign(url),
) {
  assign(paymentPagePath(orderId));
}
