import { connection } from "next/server";
import OrderDetailPageClient from "./order-detail-page-client";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  return <OrderDetailPageClient orderId={id} />;
}
