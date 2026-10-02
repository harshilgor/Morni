import { NextResponse } from "next/server";
import { processAbandonedCartReminders, processUnpaidOrderReminders } from "@/lib/email";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [carts, unpaidOrders] = await Promise.allSettled([
      processAbandonedCartReminders(),
      processUnpaidOrderReminders(),
    ]);
    if (carts.status === "rejected" || unpaidOrders.status === "rejected") {
      if (carts.status === "rejected") console.error("Cart reminder processing failed", carts.reason);
      if (unpaidOrders.status === "rejected") console.error("Unpaid order reminder processing failed", unpaidOrders.reason);
      return NextResponse.json({ error: "Unable to process all reminders." }, { status: 500 });
    }
    return NextResponse.json({ carts: carts.value, unpaid_orders: unpaidOrders.value });
  } catch (error) {
    console.error("Abandoned cart reminder processing failed", error);
    return NextResponse.json({ error: "Unable to process abandoned cart reminders." }, { status: 500 });
  }
}
