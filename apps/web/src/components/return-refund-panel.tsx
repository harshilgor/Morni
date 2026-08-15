"use client";

import { useMemo, useState } from "react";
import { calculateRefund } from "@/lib/fees";
import { formatAed } from "@/lib/format";
import type { Order, OrderItem } from "@/lib/types";

type RefundMethod = "wallet" | "original_payment_method";

export function ReturnRefundPanel({
  order,
  items,
}: {
  order: Order;
  items: OrderItem[];
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<RefundMethod>("wallet");

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

  return (
    <section className="mt-4 rounded-[1.5rem] border border-line bg-surface p-6">
      <h2 className="font-display text-2xl text-ink">Return &amp; refund</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        Select the quantities you are returning to see the exact refund.
      </p>

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
                detail="Added to your Morni wallet immediately"
              />
              <RefundOption
                checked={method === "original_payment_method"}
                onChange={() => setMethod("original_payment_method")}
                title={`Original payment method — ${formatAed(refund.refundAmountAed)}`}
                detail="Refunded in 7–9 working days"
              />
            </div>
          </fieldset>
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
