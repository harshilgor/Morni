import { Suspense } from "react";
import { DeliveryInviteJoin } from "@/components/delivery-invite-join";

export default function DriverJoinPage() {
  return (
    <Suspense fallback={<main className="grid min-h-dvh place-items-center text-sm text-[#65756d]">Loading invite…</main>}>
      <DeliveryInviteJoin target="driver" />
    </Suspense>
  );
}
