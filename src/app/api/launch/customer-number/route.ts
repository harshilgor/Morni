import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const CAMPAIGN = process.env.NEXT_PUBLIC_LAUNCH_CAMPAIGN_KEY ?? "launch-2026";
const COOKIE = "morni-launch-visitor";
const visitorIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const cookieVisitor = request.headers.get("cookie")?.match(/(?:^|;\s*)morni-launch-visitor=([^;]+)/)?.[1];
  const clientVisitor = request.headers.get("x-morni-launch-visitor");
  // A stable browser UUID closes the first-load race: several client mounts
  // can happen before a Set-Cookie response returns. This is an anonymous
  // display counter, not authorization; logged-in customers still always use
  // their immutable account id.
  const visitor = visitorIdPattern.test(clientVisitor ?? "")
    ? clientVisitor!
    : visitorIdPattern.test(cookieVisitor ?? "")
      ? cookieVisitor!
      : crypto.randomUUID();
  const visitorKey = user?.id ? `user:${user.id}` : `visitor:${visitor}`;
  const { data, error } = await createAdminClient().rpc("assign_launch_customer_number", { p_campaign_key: CAMPAIGN, p_visitor_key: visitorKey });
  if (error || typeof data !== "number") return NextResponse.json({ error: "Unable to assign launch number" }, { status: 503 });
  const response = NextResponse.json({ customerNumber: data });
  if (!user && !cookieVisitor) response.cookies.set(COOKIE, visitor, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365 });
  return response;
}
