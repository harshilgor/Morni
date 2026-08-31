"use client";

import { useEffect, useMemo, useState } from "react";
import { calculateRefund } from "@/lib/fees";
import { formatAed } from "@/lib/format";
import type { Order, OrderItem } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

type RefundMethod = "wallet" | "original_payment_method";
type ExistingReturn = {
  id: string;
  status: string;
  reason: string;
  quoted_refund_aed: number;
  refund_method: RefundMethod;
};

export function ReturnRefundPanel({
  order,
  items,
  existingReturn,
  returnWindowEndsAt,
  onSubmitted,
}: {
  order: Order;
  items: OrderItem[];
  existingReturn?: ExistingReturn | null;
  returnWindowEndsAt?: string | null;
  onSubmitted?: () => void;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<RefundMethod>("original_payment_method");
  const [reason, setReason] = useState("Item does not fit");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [returnCode, setReturnCode] = useState<string | null>(null);

  useEffect(() => {
    if (!existingReturn || !["awaiting_pickup", "picked_up"].includes(existingReturn.status)) {
      return;
    }
    let active = true;
    const loadCode = async () => {
      const { data } = await createClient().rpc("shopper_return_handoff_code", { p_return_request_id: existingReturn.id });
      const code = data as { status?: string; otp_code?: string } | null;
      if (active) setReturnCode(code?.status === "pending" ? code.otp_code ?? null : null);
    };
    void loadCode();
    const interval = window.setInterval(() => void loadCode(), 5000);
    return () => { active = false; window.clearInterval(interval); };
  }, [existingReturn]);

  const returnedItemPriceAed = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + item.unit_price_aed * (quantities[item.id] ?? 0),
        0,
      ),
    [items, quantities],
  );
  const refund = calculateRefund({
    returnedItemPriceAed,
    originalItemSubtotalAed: Number(order.subtotal_aed),
    originalSmallOrderFeeAed: Number(order.small_order_fee_aed ?? 0),
  });
  const hasSelection = returnedItemPriceAed > 0;

  async function submitReturn() {
    const returnItems = Object.entries(quantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([order_item_id, quantity]) => ({ order_item_id, quantity }));
    if (!returnItems.length) return;
    setSubmitting(true);
    setError(null);
    const { error: requestError } = await createClient().rpc("create_return_request", {
      p_order_id: order.id,
      p_return_items: returnItems,
      p_reason: reason,
      p_shopper_note: note || null,
      p_refund_method: method,
    });
    if (requestError) setError(requestError.message);
    else {
      setSubmitted(true);
      setQuantities({});
      onSubmitted?.();
    }
    setSubmitting(false);
  }

  if (existingReturn || submitted) {
    const status = existingReturn?.status ?? "pending_review";
    const statusLabel = status === "pending_review" ? "Waiting for store review" : status === "awaiting_pickup" ? "Original driver will collect it" : status === "picked_up" ? "Collected by your original driver" : status === "at_store" ? "At the store · awaiting confirmation" : status === "refund_pending" ? "Return received · refund processing" : status === "refunded" ? "Refund processed" : status === "rejected" ? "Return request declined" : status.replaceAll("_", " ");
    return <section className="mt-4 rounded-[1.5rem] border border-line bg-surface p-6" aria-live="polite">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-accent-deep">Return request</p>
      <h2 className="mt-1 font-display text-2xl text-ink">{statusLabel}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{existingReturn?.status === "awaiting_pickup" ? "Your return is assigned to the same rider. Keep the selected items ready for the return handoff." : existingReturn?.status === "refund_pending" ? `Your refund of ${formatAed(existingReturn.quoted_refund_aed)} is queued for manual Founder processing.` : "We will keep this order updated as the return moves through pickup, store receipt, and refund processing."}</p>
      {returnCode ? <div className="mt-5 rounded-xl border border-[#f1c58e] bg-[#fff7ed] p-4 text-center"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#a65316]">Return pickup code</p><p className="mt-2 text-xs leading-5 text-[#8a5a42]">Show this code to the original driver after they take a clear parcel photo.</p><p className="mt-3 rounded-lg bg-white py-3 text-3xl font-bold tracking-[0.28em] text-[#8a4b2c]">{returnCode}</p></div> : null}
    </section>;
  }

  return (
    <section className="mt-4 rounded-[1.5rem] border border-line bg-surface p-6">
      <h2 className="font-display text-2xl text-ink">Return &amp; refund</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        Select the quantities you are returning. The return must be handed to the driver while they are waiting at your door.
      </p>
      {returnWindowEndsAt ? <p className="mt-2 text-xs font-semibold text-[#a65316]">Driver waiting window ends {new Date(returnWindowEndsAt).toLocaleTimeString("en-AE", { hour: "numeric", minute: "2-digit" })}.</p> : null}

      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <label
            key={item.id}
            className="flex items-center justify-between gap-4 rounded-xl border border-line/70 px-4 py-3"
          >
            <span className="min-w-0 text-sm text-ink">
              <span className="block truncate font-medium">{item.title}</span>
              <span className="text-xs text-muted">
                {formatAed(item.unit_price_aed)} each
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
              Return
              <select
                aria-label={`Quantity of ${item.title} to return`}
                value={quantities[item.id] ?? 0}
                onChange={(event) =>
                  setQuantities((current) => ({
                    ...current,
                    [item.id]: Number(event.target.value),
                  }))
                }
                className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-ink"
              >
                {Array.from({ length: item.quantity + 1 }, (_, quantity) => (
                  <option key={quantity} value={quantity}>
                    {quantity}
                  </option>
                ))}
              </select>
            </span>
          </label>
        ))}
      </div>

      {hasSelection ? (
        <div className="mt-6 border-t border-line pt-5">
          <h3 className="font-display text-xl text-ink">Refund summary</h3>
          <div className="mt-4 space-y-3 text-sm">
            <RefundLine
              label="Item price"
              value={formatAed(refund.returnedItemPriceAed)}
            />
            <RefundLine label="Delivery fee" value="Non-refundable" muted />
            {Number(order.small_order_fee_aed ?? 0) > 0 ? (
              <RefundLine
                label="Small order fee"
                value={refund.isFullReturn ? "Refunded" : "Not refunded"}
                muted={!refund.isFullReturn}
              />
            ) : null}
            <RefundLine label="Service fee" value="Non-refundable" muted />
            <RefundLine
              label="Convenience fee"
              value={
                refund.isFullReturn
                  ? `– ${formatAed(refund.convenienceFeeDeductionAed)}`
                  : "Not applied"
              }
              muted={!refund.isFullReturn}
            />
            {refund.isFullReturn ? (
              <p className="text-xs leading-relaxed text-muted">
                Applied — all items in this order were returned.
              </p>
            ) : (
              <p className="text-xs leading-relaxed text-muted">
                The AED 10 convenience fee only applies when every item is
                returned.
              </p>
            )}
          </div>
          <div className="mt-5 flex justify-between border-t border-line pt-4 font-semibold text-ink">
            <span>Refund amount</span>
            <span>{formatAed(refund.refundAmountAed)}</span>
          </div>

          <fieldset className="mt-6">
            <legend className="text-sm font-semibold text-ink">
              Choose how you&apos;d like this refunded:
            </legend>
            <div className="mt-3 grid gap-3">
              <RefundOption
                checked={method === "wallet"}
                onChange={() => setMethod("wallet")}
                title={`Instant credit — ${formatAed(refund.refundAmountAed)}`}
                detail="Founder will send this manually after store receipt"
              />
              <RefundOption
                checked={method === "original_payment_method"}
                onChange={() => setMethod("original_payment_method")}
                title={`Original payment method — ${formatAed(refund.refundAmountAed)}`}
                detail="Founder will send this manually to the original payment method"
              />
            </div>
          </fieldset>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-ink">Reason
              <select value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm font-normal text-ink">
                <option>Item does not fit</option>
                <option>Item is damaged</option>
                <option>Wrong item received</option>
                <option>Item is not as described</option>
                <option>Changed my mind</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-ink">Note (optional)
              <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={500} placeholder="Add details for the store" className="mt-2 w-full resize-none rounded-xl border border-line bg-white px-3 py-2.5 text-sm font-normal text-ink" />
            </label>
          </div>
          {error ? <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700" role="alert">{error}</p> : null}
          <button type="button" onClick={() => void submitReturn()} disabled={submitting} className="mt-5 min-h-12 w-full rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">{submitting ? "Submitting return request…" : "Request this return"}</button>
        </div>
      ) : null}
    </section>
  );
}

function RefundLine({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className={muted ? "text-muted" : "text-ink"}>{value}</span>
    </div>
  );
}

function RefundOption({
  checked,
  onChange,
  title,
  detail,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  detail: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
        checked ? "border-ink bg-background ring-1 ring-ink" : "border-line"
      }`}
    >
      <input
        type="radio"
        name="refund-method"
        checked={checked}
        onChange={onChange}
        className="mt-0.5"
      />
      <span>
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="mt-1 block text-xs text-muted">{detail}</span>
      </span>
    </label>
  );
}
