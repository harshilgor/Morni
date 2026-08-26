import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/types";

const CANCELLABLE_STATUSES: OrderStatus[] = ["placed", "accepted", "picking"];

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/orders/[orderId]">,
) {
  const { orderId } = await context.params;
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

  const [{ data: membership }, { data: profile }, { data: deliveryJob }] = await Promise.all([
    admin
      .from("store_members")
      .select("id")
      .eq("store_id", order.store_id)
      .eq("user_id", user.id)
      .maybeSingle(),
    admin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    admin.from("delivery_jobs").select("id").eq("order_id", orderId).maybeSingle(),
  ]);
  if (!membership && profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!CANCELLABLE_STATUSES.includes(order.status as OrderStatus)) {
    return NextResponse.json({ error: "Only orders awaiting fulfilment can be deleted." }, { status: 409 });
  }
  if (deliveryJob) {
    return NextResponse.json({ error: "This order is already with delivery dispatch and cannot be deleted." }, { status: 409 });
  }

  const { data: cancelledOrder, error: cancelError } = await admin
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", orderId)
    .eq("status", order.status)
    .select("id, status")
    .maybeSingle();
  if (cancelError) return NextResponse.json({ error: cancelError.message }, { status: 500 });
  if (!cancelledOrder) {
    return NextResponse.json({ error: "This order changed before it could be deleted. Refresh and try again." }, { status: 409 });
  }

  // The database trigger queues the shopper cancellation email durably.
  return NextResponse.json({ order: cancelledOrder });
}
