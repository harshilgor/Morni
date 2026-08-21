import { NextResponse } from "next/server";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  context: RouteContext<"/api/orders/[orderId]/confirmation">,
) {
  const limited = rateLimit(`order-confirm:${clientIp(request)}`, 10, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const { orderId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .eq("shopper_id", user.id)
    .maybeSingle();
  if (error || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  try {
    const result = await sendOrderConfirmationEmail(orderId);
    return NextResponse.json(result);
  } catch (sendError) {
    console.error("Unable to send order confirmation", sendError);
    return NextResponse.json({ error: "Unable to send order confirmation" }, { status: 500 });
  }
}
