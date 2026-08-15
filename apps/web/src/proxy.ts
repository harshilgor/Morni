import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsSessionRefresh = [
    "/account",
    "/addresses",
    "/cart",
    "/checkout",
    "/driver",
    "/orders",
    "/partner",
    "/portal",
    "/sell",
    "/wishlist",
  ].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

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
