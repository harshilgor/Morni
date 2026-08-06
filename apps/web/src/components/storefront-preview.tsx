"use client";

import { deliveryPromise, emirateLabel, formatAed } from "@/lib/format";
import type { UaeEmirate } from "@/lib/types";

export type StorefrontPreviewData = {
  name: string;
  description: string;
  emirate: UaeEmirate;
  area: string;
  address: string;
  logoUrl?: string | null;
  coverUrl?: string | null;
  deliveryEtaMinutes: number;
  opensAt: string;
  closesAt: string;
  product?: {
    title: string;
    priceAed: number;
    compareAtPriceAed?: number | null;
    imageUrl?: string | null;
  } | null;
};

export function StorefrontPreview({
  data,
  mode = "store",
}: {
  data: StorefrontPreviewData;
  mode?: "store" | "product" | "launch";
}) {
  const eta = deliveryPromise(data.deliveryEtaMinutes || 60);

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-line bg-white shadow-sm">
      <div className="border-b border-line bg-[#fff7f9] px-4 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-deep">
          Live shopper preview
        </p>
      </div>

      <div className="relative aspect-[16/7] bg-sand">
        {data.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.coverUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted">
            Banner preview
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-4 pt-10">
          <div className="flex items-end gap-3">
            <div className="h-14 w-14 overflow-hidden rounded-2xl border-2 border-white bg-white shadow">
              {data.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.logoUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] text-muted">
                  Logo
                </div>
              )}
            </div>
            <div className="min-w-0 pb-0.5 text-white">
              <p className="truncate font-display text-xl leading-tight">
                {data.name || "Your boutique"}
              </p>
              <p className="truncate text-xs text-white/80">
                {data.area || "Area"} · {emirateLabel(data.emirate)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <p className="text-sm leading-relaxed text-muted">
            {data.description || "Your store description will appear here."}
          </p>
          <p className="mt-2 text-xs text-muted">
            {eta} · Open {data.opensAt || "10:00"}–{data.closesAt || "22:00"}
          </p>
          {data.address ? (
            <p className="mt-1 text-xs text-muted">{data.address}</p>
          ) : null}
        </div>

        {(mode === "product" || mode === "launch") && data.product ? (
          <div className="overflow-hidden rounded-2xl border border-line">
            <div className="aspect-[3/4] bg-sand">
              {data.product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.product.imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted">
                  Product photo
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="text-sm font-medium text-ink">
                {data.product.title || "First product"}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <p className="text-sm text-ink">
                  {formatAed(data.product.priceAed || 0)}
                </p>
                {data.product.compareAtPriceAed ? (
                  <p className="text-xs text-muted line-through">
                    {formatAed(data.product.compareAtPriceAed)}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {mode === "launch" ? (
          <p className="rounded-xl bg-[#e8f5ef] px-3 py-2 text-xs text-mint">
            Ready for shoppers once you launch.
          </p>
        ) : (
          <p className="rounded-xl bg-sand px-3 py-2 text-xs text-muted">
            Hidden from shoppers until you finish setup and launch.
          </p>
        )}
      </div>
    </div>
  );
}
