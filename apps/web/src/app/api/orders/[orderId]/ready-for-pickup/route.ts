import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/orders/[orderId]/ready-for-pickup">,
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
    .select("id, store_id, status, payment_method, payment_status")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.payment_method === "card" && order.payment_status !== "paid") {
    return NextResponse.json(
      { error: "This order must be paid before it can be fulfilled." },
      { status: 409 },
    );
  }
  if (order.status !== "picking") {
    return NextResponse.json({ error: "Only an order being prepared can be marked ready for pickup." }, { status: 409 });
  }

  const [{ data: membership }, { data: profile }] = await Promise.all([
    admin.from("store_members").select("id").eq("store_id", order.store_id).eq("user_id", user.id).maybeSingle(),
    admin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);
  if (!membership && profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: delivery, error: dispatchError } = await admin
    .rpc("queue_order_for_delivery", { p_order_id: orderId })
    .single();
  if (dispatchError) return NextResponse.json({ error: dispatchError.message }, { status: 500 });

  return NextResponse.json({ delivery });
}
