import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const CAMPAIGN = process.env.NEXT_PUBLIC_LAUNCH_CAMPAIGN_KEY ?? "launch-2026";
const COOKIE = "morni-launch-visitor";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const cookieVisitor = request.headers.get("cookie")?.match(/(?:^|;\s*)morni-launch-visitor=([^;]+)/)?.[1];
  // Never accept a caller-supplied identity header: it would let anyone burn
  // through the shared launch sequence. Guests are identified only by our
  // HTTP-only cookie; authenticated users use their Supabase account id.
  const visitor = cookieVisitor || crypto.randomUUID();
  const visitorKey = user?.id ? `user:${user.id}` : `visitor:${visitor}`;
  const { data, error } = await createAdminClient().rpc("assign_launch_customer_number", { p_campaign_key: CAMPAIGN, p_visitor_key: visitorKey });
  if (error || typeof data !== "number") return NextResponse.json({ error: "Unable to assign launch number" }, { status: 503 });
  const response = NextResponse.json({ customerNumber: data });
  if (!user && !cookieVisitor) response.cookies.set(COOKIE, visitor, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  return response;
}
