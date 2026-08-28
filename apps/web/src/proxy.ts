import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isFounderRoute = pathname === "/founder" || pathname.startsWith("/founder/");
  const hasAuthCookie = request.cookies
    .getAll()
    .some(({ name }) => name.startsWith("sb-") && name.includes("-auth-token"));
  const needsSessionRefresh = [
    "/account",
    "/addresses",
    "/cart",
    "/checkout",
    "/driver",
    "/founder",
    "/orders",
    "/partner",
    "/portal",
    "/sell",
    "/wishlist",
  ].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  // Redirect direct visits to Founder into the auth flow before the route can
  // be served from the static cache. The original destination survives login.
  if (
    isFounderRoute &&
    !hasAuthCookie
  ) {
    const authUrl = request.nextUrl.clone();
    authUrl.pathname = "/auth";
    authUrl.search = `?next=${encodeURIComponent(`${pathname}${request.nextUrl.search}`)}`;
    return NextResponse.redirect(authUrl);
  }

  // Storefront pages use public data. Avoid an auth-network round trip before
  // every browse/product navigation; protected areas still refresh sessions.
  if (!needsSessionRefresh) return NextResponse.next({ request });
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
