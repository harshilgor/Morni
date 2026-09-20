/**
 * Founder route classification used by proxy.ts.
 * /founder/auth must never be treated as a protected route — doing so
 * rewrote ?next=/founder into ?next=/founder/auth… and bounced logins home.
 */
export function classifyFounderPath(pathname: string) {
  const isFounderAuthRoute =
    pathname === "/founder/auth" || pathname.startsWith("/founder/auth/");
  const isFounderProtectedRoute =
    (pathname === "/founder" || pathname.startsWith("/founder/")) &&
    !isFounderAuthRoute;
  return { isFounderAuthRoute, isFounderProtectedRoute };
}

export function founderProtectedRedirectNext(pathname: string, search = "") {
  const destination = `${pathname}${search}`;
  return destination.startsWith("/founder/auth") ? "/founder" : destination;
}
