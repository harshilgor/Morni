import { NextResponse } from "next/server";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/orders/[orderId]/confirmation">,
) {
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
