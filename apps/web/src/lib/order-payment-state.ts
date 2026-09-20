import type { Order } from "@/lib/types";

/** An order is operationally "real" only after successful payment. */
export function isPaidOrder(
  order: Pick<Order, "payment_status"> | { payment_status?: string | null },
) {
  return order.payment_status === "paid";
}

export function isNewPaidOrder(
  order: Pick<Order, "status" | "payment_status"> | {
    status: string;
    payment_status?: string | null;
  },
) {
  return order.status === "placed" && isPaidOrder(order);
}
