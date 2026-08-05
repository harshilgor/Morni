"use client";

import Link from "next/link";
import { cartLineId, useCart } from "@/lib/cart";
import { formatAed } from "@/lib/format";

export default function CartPage() {
  const { items, setQuantity, removeItem, subtotal } = useCart();
  const total = subtotal();
  const storeName = items[0]?.storeName;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-4xl text-ink">Your cart</h1>
      {storeName ? (
        <p className="mt-2 text-sm text-muted">
          From {storeName} · one store per order for 1-hour delivery
        </p>
      ) : null}

      {items.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-line bg-surface/70 p-10 text-center">
          <p className="text-muted">Your cart is empty.</p>
          <Link href="/" className="mt-4 inline-block text-accent-deep underline">
            Browse stores
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {items.map((item) => (
            <div
              key={item.lineId ?? cartLineId(item.productId, item.size)}
              className="flex gap-4 rounded-2xl border border-line bg-surface p-4"
            >
              <div className="h-24 w-20 overflow-hidden rounded-xl bg-sand">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="flex flex-1 flex-col justify-between">
                <div className="flex justify-between gap-3">
                  <div>
                    <h2 className="font-medium text-ink">{item.title}</h2>
                    <p className="text-sm text-muted">{formatAed(item.priceAed)}</p>
                    {item.size ? (
                      <p className="mt-1 text-xs font-medium text-accent-deep">
                        Size {item.size}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      removeItem(
                        item.lineId ?? cartLineId(item.productId, item.size),
                      )
                    }
                    className="text-xs text-muted hover:text-ink"
                  >
                    Remove
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="h-8 w-8 rounded-full border border-line"
                    onClick={() =>
                      setQuantity(
                        item.lineId ?? cartLineId(item.productId, item.size),
                        item.quantity - 1,
                      )
                    }
                  >
                    −
                  </button>
                  <span className="text-sm">{item.quantity}</span>
                  <button
                    type="button"
                    className="h-8 w-8 rounded-full border border-line"
                    onClick={() =>
                      setQuantity(
                        item.lineId ?? cartLineId(item.productId, item.size),
                        item.quantity + 1,
                      )
                    }
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Subtotal</span>
              <span>{formatAed(total)}</span>
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-muted">Delivery</span>
              <span className="text-mint">AED 0 · within 1 hour</span>
            </div>
            <div className="mt-4 flex justify-between border-t border-line pt-4 font-medium">
              <span>Total</span>
              <span>{formatAed(total)}</span>
            </div>
            <Link
              href="/checkout"
              className="mt-5 block rounded-full bg-ink py-3 text-center text-sm text-white transition hover:bg-accent-deep"
            >
              Checkout · Pay on delivery
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
