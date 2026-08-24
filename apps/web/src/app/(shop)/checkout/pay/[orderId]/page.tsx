import { connection } from "next/server";
import CheckoutPayPageClient from "./checkout-pay-page-client";

export default async function CheckoutPayPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  await connection();
  const { orderId } = await params;
  return <CheckoutPayPageClient orderId={orderId} />;
}
