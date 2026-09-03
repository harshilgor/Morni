const AFS_ORIGINS =
  "https://*.oppwa.com https://eu-test.oppwa.com https://eu-prod.oppwa.com";
const AFS_DEVICE_ORIGINS =
  "https://mpshare.iesnare.com https://mpshare.iesnap.com";

/**
 * Payment authentication can navigate an embedded 3-D Secure method/challenge
 * frame to an issuer-controlled HTTPS origin. Those origins vary by card and
 * issuing bank, so the broader frame permission must be scoped to the payment
 * page instead of being added to the whole storefront.
 */
export function contentSecurityPolicy(pathname: string) {
  const isPaymentPage = pathname.startsWith("/checkout/pay/");
  const frameSources = isPaymentPage
    ? "'self' https:"
    : `'self' ${AFS_ORIGINS} ${AFS_DEVICE_ORIGINS} https://www.openstreetmap.org`;

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    `form-action 'self' ${AFS_ORIGINS}`,
    `script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com ${AFS_ORIGINS} ${AFS_DEVICE_ORIGINS} https://maps.googleapis.com https://maps.gstatic.com`,
    `script-src-elem 'self' 'unsafe-inline' https://va.vercel-scripts.com ${AFS_ORIGINS} https://*.iesnare.com https://*.iesnap.com https://maps.googleapis.com https://maps.gstatic.com`,
    `style-src 'self' 'unsafe-inline' ${AFS_ORIGINS} ${AFS_DEVICE_ORIGINS} https://maps.googleapis.com`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' https://api.morniuae.com wss://api.morniuae.com https://*.supabase.co wss://*.supabase.co ${AFS_ORIGINS} https://*.iesnare.com https://*.iesnap.com https://vitals.vercel-insights.com https://va.vercel-scripts.com https://maps.googleapis.com https://maps.gstatic.com https://*.googleapis.com https://*.gstatic.com`,
    `frame-src ${frameSources}`,
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
  ].join("; ");
}
