"use client";

import { useCallback, useEffect, useState } from "react";
import { PortalIcon } from "@/components/portal-icons";
import { createClient, createRealtimeChannelName } from "@/lib/supabase/client";
import { formatAed } from "@/lib/format";

type ReturnItem = { id: string; title: string; size: string | null; quantity: number };
type ReturnRequest = {
  id: string;
  order_id: string;
  status: string;
  reason: string;
  shopper_note: string | null;
  quoted_refund_aed: number;
  refund_method: string;
  created_at: string;
  return_request_items?: ReturnItem[] | null;
  return_jobs?: Array<{ id: string; status: string }> | null;
  return_refunds?: Array<{ id: string; status: string; processed_at: string | null }> | null;
};

const label: Record<string, string> = {
  pending_review: "Needs review", awaiting_pickup: "Waiting for original rider", picked_up: "Picked up", at_store: "At store · confirm receipt", refund_pending: "Refund ready to process", refunded: "Refund processed", rejected: "Declined", pickup_failed: "Pickup exception",
};

export function ReturnRequestsPanel({ storeId }: { storeId: string }) {
  const [requests, setRequests] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storeCodes, setStoreCodes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const { data, error: loadError } = await createClient().from("return_requests").select("*, return_request_items(*), return_jobs(id,status), return_refunds(id,status,processed_at)").eq("store_id", storeId).order("created_at", { ascending: false }).limit(20);
    if (loadError) setError(loadError.message); else setRequests((data as ReturnRequest[]) ?? []);
    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    let active = true;
    const requestLoad = () => {
      if (active) void load();
    };
    if (typeof queueMicrotask === "function") queueMicrotask(requestLoad);
    else window.setTimeout(requestLoad, 0);

    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(createRealtimeChannelName("store-returns", storeId))
        .on("postgres_changes", { event: "*", schema: "public", table: "return_requests", filter: `store_id=eq.${storeId}` }, () => void load())
        .on("postgres_changes", { event: "*", schema: "public", table: "return_handoffs" }, () => void load())
        .on("postgres_changes", { event: "*", schema: "public", table: "return_refunds" }, () => void load())
        .subscribe((status, subscriptionError) => {
          if (!active) return;
          if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && subscriptionError) {
            setError("Live return updates are temporarily unavailable. Refresh to retry.");
          }
        });
    } catch {
      queueMicrotask(() => {
        if (active) setError("Live return updates are temporarily unavailable. Refresh to retry.");
      });
    }

    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [load, storeId]);

  async function review(id: string, decision: "approve" | "reject") {
    setBusy(id); setError(null);
    const { error: actionError } = await createClient().rpc("review_return_request", { p_return_request_id: id, p_decision: decision, p_note: null });
    if (actionError) setError(actionError.message); else await load();
    setBusy(null);
  }

  async function receive(id: string) {
    setBusy(id); setError(null);
    const { error: actionError } = await createClient().rpc("confirm_return_received", { p_return_request_id: id, p_note: null });
    if (actionError) setError(actionError.message); else await load();
    setBusy(null);
  }

  async function showStoreCode(id: string) {
    setBusy(id); setError(null);
    const { data, error: codeError } = await createClient().rpc("store_return_handoff_code", { p_return_request_id: id });
    if (codeError) setError(codeError.message);
    else if ((data as { status?: string; otp_code?: string } | null)?.status === "pending") setStoreCodes((current) => ({ ...current, [id]: (data as { otp_code: string }).otp_code }));
    else setError("The driver has not requested the store handoff code yet.");
    setBusy(null);
  }

  const actionable = requests.filter((request) => ["pending_review", "at_store", "refund_pending", "refunded", "pickup_failed"].includes(request.status));
  if (loading || (!actionable.length && !error)) return null;

  return <section className="rounded-[1.5rem] border border-[#e4c6a8] bg-[#fffaf4] p-5 shadow-[0_16px_36px_-30px_rgba(130,75,29,0.7)]" aria-live="polite">
    <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#ffe8cc] text-[#a65316]"><PortalIcon name="package" className="h-5 w-5" /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#a65316]">Returns desk</p><h2 className="mt-1 text-xl font-semibold text-[#263530]">Return requests need your attention</h2><p className="mt-1 text-sm leading-6 text-[#6f5b4a]">Review the request, receive the parcel from the original driver, then release the refund.</p></div></div>
    <div className="mt-4 space-y-3">{actionable.map((request) => <article key={request.id} className="rounded-2xl border border-[#efdcc7] bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-bold text-[#263530]">Order return · {request.order_id.slice(0, 8)}</p><p className="mt-1 text-xs font-semibold text-[#a65316]">{label[request.status] ?? request.status.replaceAll("_", " ")}</p></div><span className="rounded-full bg-[#fff0dc] px-2.5 py-1 text-xs font-bold text-[#8d4a10]">{formatAed(request.quoted_refund_aed)}</span></div><p className="mt-3 text-sm text-[#4e5e57]">{request.return_request_items?.map((item) => `${item.title}${item.size ? ` · ${item.size}` : ""} ×${item.quantity}`).join(", ")}</p><p className="mt-2 text-xs text-[#7b6b5d]"><strong>Reason:</strong> {request.reason}{request.shopper_note ? ` · ${request.shopper_note}` : ""}</p><p className="mt-2 text-xs font-semibold text-[#668077]">{request.status === "pending_review" ? "Approval will assign the original delivery driver automatically." : request.status === "at_store" ? "The original driver has brought the return back. Give them the store code, then confirm receipt." : request.status === "refund_pending" ? "Inventory has been restored. Founder will review this refund in the Refunds tab." : request.status === "refunded" ? "Founder marked the refund as sent. The shopper has been updated." : "This return needs operational attention."}</p>{request.status === "at_store" && storeCodes[request.id] ? <div className="mt-3 rounded-xl border border-[#f1c58e] bg-[#fff7ed] p-3 text-center"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#a65316]">Store handoff code</p><p className="mt-2 text-2xl font-bold tracking-[0.28em] text-[#8a4b2c]">{storeCodes[request.id]}</p><p className="mt-1 text-xs text-[#8a5a42]">Read this code to the original driver.</p></div> : null}<div className="mt-4 flex flex-wrap gap-2">{request.status === "pending_review" ? <><button type="button" onClick={() => void review(request.id, "approve")} disabled={busy === request.id} className="min-h-10 rounded-xl bg-[#213d33] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{busy === request.id ? "Updating…" : "Approve & assign original rider"}</button><button type="button" onClick={() => void review(request.id, "reject")} disabled={busy === request.id} className="min-h-10 rounded-xl border border-[#e3c9b1] px-4 py-2 text-xs font-bold text-[#8d4a10] disabled:opacity-50">Decline</button></> : null}{request.status === "at_store" ? <><button type="button" onClick={() => void showStoreCode(request.id)} disabled={busy === request.id} className="min-h-10 rounded-xl border border-[#cfae8d] px-4 py-2 text-xs font-bold text-[#8d4a10] disabled:opacity-50">{busy === request.id ? "Loading…" : storeCodes[request.id] ? "Refresh store code" : "Show store code"}</button><button type="button" onClick={() => void receive(request.id)} disabled={busy === request.id || !storeCodes[request.id]} className="min-h-10 rounded-xl bg-[#2f8a64] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{busy === request.id ? "Confirming…" : "Confirm received & restore stock"}</button></> : null}</div></article>)}</div>{error ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700" role="alert">{error}</p> : null}
  </section>;
}
