"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatAed } from "@/lib/format";
import type { Order } from "@/lib/types";
import AfsPaymentWidget from "./afs-payment-widget";

type CheckoutSession = {
  checkoutId: string;
  integrity: string | null;
  scriptUrl: string;
  amountAed: number;
  currency: string;
  orderId: string;
  shopperResultUrl: string;
};

export default function CheckoutPayPageClient({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [brands, setBrands] = useState("VISA MASTER");
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [widgetAttempt, setWidgetAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace(`/auth?next=${encodeURIComponent(`/checkout/pay/${orderId}`)}`);
        return;
      }

      const { data: orderData } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle();

      if (!active) return;

      if (!orderData) {
        setError("Order not found.");
        setLoading(false);
        return;
      }

      const typedOrder = orderData as Order;
      setOrder(typedOrder);

      if (typedOrder.payment_method !== "card") {
        router.replace(`/orders/${orderId}`);
        return;
      }
      if (typedOrder.payment_status === "paid") {
        router.replace(`/orders/${orderId}?paid=1`);
        return;
      }

      const configRes = await fetch("/api/payments/afs/config");
      const configPayload = (await configRes.json().catch(() => null)) as {
        enabled?: boolean;
        brands?: string;
      } | null;
      if (!active) return;

      if (!configPayload?.enabled) {
        setError("Card payments are not available right now.");
        setLoading(false);
        return;
      }
      if (configPayload.brands) setBrands(configPayload.brands);

      const checkoutRes = await fetch("/api/payments/afs/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const checkoutPayload = (await checkoutRes.json().catch(() => null)) as
        | (CheckoutSession & { error?: string })
        | null;

      if (!active) return;

      if (!checkoutRes.ok || !checkoutPayload?.checkoutId) {
        setError(checkoutPayload?.error ?? "Unable to start payment.");
        setLoading(false);
        return;
      }

      setSession({
        ...checkoutPayload,
        shopperResultUrl: `${window.location.origin}/api/payments/afs/result?orderId=${encodeURIComponent(orderId)}`,
      });
      setLoading(false);
    }

    void bootstrap();
    return () => {
      active = false;
    };
  }, [orderId, router]);

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <Link href={`/orders/${orderId}`} className="text-sm text-muted hover:text-ink">
        ← Back to order
      </Link>
      <h1 className="mt-4 font-display text-4xl text-ink">Pay securely</h1>
      <p className="mt-2 text-sm text-muted">
        Card details are entered on AFS&apos;s payment form. Morni never sees your full card number.
      </p>

      {order ? (
        <div className="mt-6 flex items-end justify-between border-y border-line py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-deep">
              {order.order_number}
            </p>
            <p className="mt-1 text-sm text-muted">Amount due</p>
          </div>
          <p className="text-2xl font-semibold text-ink">{formatAed(order.total_aed)}</p>
        </div>
      ) : null}

      {loading ? (
        <p className="mt-8 text-sm text-muted">Preparing secure checkout…</p>
      ) : null}

      {error ? (
        <div className="mt-8 space-y-4 rounded-xl bg-[#fff0f4] px-4 py-3 text-sm text-accent-deep">
          <p>{error}</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="border-b border-accent-deep font-semibold uppercase tracking-[0.08em]"
            >
              Try again
            </button>
            <Link href={`/orders/${orderId}`} className="text-muted underline-offset-2 hover:underline">
              View order
            </Link>
          </div>
        </div>
      ) : null}

      {session ? (
        <div className="mt-8 min-h-[12rem]">
          <AfsPaymentWidget
            key={`${session.checkoutId}-${widgetAttempt}`}
            checkoutId={session.checkoutId}
            scriptUrl={session.scriptUrl}
            integrity={session.integrity}
            shopperResultUrl={session.shopperResultUrl}
            brands={brands}
            onRetry={() => setWidgetAttempt((attempt) => attempt + 1)}
          />
        </div>
      ) : null}
    </div>
  );
}
