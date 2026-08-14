import { NextResponse } from "next/server";
import { sendOrderStatusEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/types";

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  placed: "accepted",
  accepted: "picking",
};

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/orders/[orderId]/status">,
) {
  const { orderId } = await context.params;
  const body = (await request.json().catch(() => null)) as { status?: OrderStatus } | null;
  if (!body?.status) return NextResponse.json({ error: "A status is required" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, store_id, status")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const [{ data: membership }, { data: profile }] = await Promise.all([
    admin
      .from("store_members")
      .select("id")
      .eq("store_id", order.store_id)
      .eq("user_id", user.id)
      .maybeSingle(),
    admin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);
  if (!membership && profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const expectedStatus = NEXT_STATUS[order.status as OrderStatus];
  if (body.status !== expectedStatus) {
    return NextResponse.json({ error: "This status transition is not available" }, { status: 409 });
  }

  const { data: updatedOrder, error: updateError } = await admin
    .from("orders")
    .update({ status: body.status })
    .eq("id", orderId)
    .select("id, status")
    .single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  try {
    await sendOrderStatusEmail(orderId);
  } catch (sendError) {
    console.error("Order updated but status email failed", sendError);
  }

  return NextResponse.json({ order: updatedOrder });
}
