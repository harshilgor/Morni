"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrandMark } from "@/components/brand-logo";
import { PortalIcon } from "@/components/portal-icons";
import { createClient } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/use-auth-user";
import { uploadDeliveryProof } from "@/lib/media-upload";
import { DriverMap } from "./driver-map";

type DeliveryJobStatus = "unassigned" | "assigned" | "accepted" | "at_pickup" | "collected" | "delivered" | "failed" | "cancelled";
type DriverAvailability = "offline" | "available" | "assigned" | "paused";
type DriverSection = "route" | "history" | "help";
type JobAction = "accept" | "decline" | "at_pickup" | "collected" | "delivered" | "failed";

type DriverJob = {
  id: string;
  status: DeliveryJobStatus;
  assignment_expires_at: string | null;
  order_number: string;
  store_name: string;
  store_address: string;
  store_lat: number | null;
  store_lng: number | null;
  delivery_street: string;
  delivery_building: string | null;
  delivery_apartment: string | null;
  delivery_area: string;
  delivery_emirate: string | null;
  delivery_notes: string | null;
  delivery_phone: string | null;
  delivery_eta_minutes: number | null;
  item_count: number;
  bag_summary: string | null;
  pickup_handoff_status?: "pending" | "verified" | "expired" | null;
  delivery_handoff_status?: "pending" | "verified" | "expired" | null;
  proof_count?: number;
};

type DriverHistoryJob = {
  id: string;
  status: Extract<DeliveryJobStatus, "delivered" | "failed" | "cancelled">;
  order_number: string;
  store_name: string;
  delivery_area: string;
  delivered_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  updated_at: string;
};

type DriverData = {
  driver: {
    id: string;
    display_name: string;
    availability: DriverAvailability;
    is_active: boolean;
    last_lat: number | null;
    last_lng: number | null;
    last_location_at: string | null;
  };
  partner?: { name?: string | null; support_email?: string | null };
  jobs: DriverJob[];
  history: DriverHistoryJob[];
};

const FAILURE_REASONS = ["Customer unavailable", "Wrong address", "Could not access building", "Order damaged", "Other delivery issue"] as const;
const statusLabel: Record<DeliveryJobStatus, string> = {
  unassigned: "Waiting for rider", assigned: "Awaiting acceptance", accepted: "Heading to pickup", at_pickup: "At the store",
  collected: "Out for delivery", delivered: "Delivered", failed: "Needs attention", cancelled: "Cancelled",
};
const statusTone: Record<DeliveryJobStatus, string> = {
  unassigned: "bg-[#FFF1C2] text-[#6B4F00]", assigned: "bg-[#DCEBFF] text-[#174A8B]", accepted: "bg-[#E8E0FF] text-[#4B3A90]",
  at_pickup: "bg-[#DCEBFF] text-[#174A8B]", collected: "bg-[#FFE4CF] text-[#8A3E08]", delivered: "bg-[#DDF5E7] text-[#12663B]",
  failed: "bg-[#FFE0DC] text-[#9C2F28]", cancelled: "bg-[#E8ECEA] text-[#53625C]",
};

function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-AE", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function relativeTime(value: string | null | undefined) {
  if (!value) return "Location not shared yet";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 15) return "Updated just now";
  if (seconds < 60) return `Updated ${seconds}s ago`;
  return `Updated ${Math.round(seconds / 60)}m ago`;
}

function friendlyError(message: string) {
  if (/no rider profile|access is restricted/i.test(message)) return "Your account is not linked to an active rider profile yet.";
  if (/expired|no longer available/i.test(message)) return "That assignment is no longer available. Your route has been refreshed.";
  if (/finish the current delivery/i.test(message)) return "Finish the current delivery before changing availability.";
  if (/verification code|handoff/i.test(message)) return message;
  return "We could not complete that action. Check your connection and try again.";
}

function destinationFor(job: DriverJob) {
  return [job.delivery_street, job.delivery_building, job.delivery_apartment, job.delivery_area, job.delivery_emirate].filter(Boolean).join(", ");
}

function useCountdown(expiresAt: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);
  if (!expiresAt) return null;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
}

function StatusPill({ status }: { status: DeliveryJobStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone[status]}`}>{statusLabel[status]}</span>;
}

function DriverLoading() {
  return <main className="grid min-h-dvh place-items-center bg-[#FFFDF8] px-5"><div className="w-full max-w-md space-y-4"><div className="h-16 animate-pulse rounded-2xl bg-[#F1E9D9]" /><div className="h-28 animate-pulse rounded-2xl bg-[#F1E9D9]" /><div className="h-72 animate-pulse rounded-2xl bg-[#F1E9D9]" /></div></main>;
}

function DriverAccess({ title, description, href = "/driver/sign-in?next=/driver" }: { title: string; description: string; href?: string }) {
  return <main className="grid min-h-dvh place-items-center bg-[#f6f8f6] px-5 text-center"><section className="w-full max-w-md rounded-2xl border border-[#dbe4df] bg-white p-8 shadow-[0_24px_70px_-40px_rgba(25,42,35,0.45)]"><span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#e8f4ee] text-[#367762]"><PortalIcon name="package" className="h-5 w-5" /></span><p className="mt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#4e8875]">Morni rider</p><h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#19342b]">{title}</h1><p className="mt-3 text-sm leading-6 text-[#63726c]">{description}</p><Link href={href} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#213d33] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2f6f5d]">Sign in <PortalIcon name="arrow" className="h-4 w-4" /></Link></section></main>;
}

function AcceptCountdown({ expiresAt }: { expiresAt: string | null }) {
  const seconds = useCountdown(expiresAt);
  if (seconds === null) return null;
  const urgent = seconds <= 20;
  return <div className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold tabular-nums ${urgent ? "bg-[#FFE0DC] text-[#9C2F28]" : "bg-[#FFF1C2] text-[#6B4F00]"}`}><span className="flex items-center gap-2"><PortalIcon name="clock" className="h-4 w-4" /> Assignment window</span><span>{seconds > 0 ? `${seconds}s left` : "Refreshing…"}</span></div>;
}

function DeliveryTimeline({ job, destination }: { job: DriverJob; destination: string }) {
  const delivered = job.status === "delivered";
  const headingToCustomer = job.status === "collected";
  const pickupComplete = headingToCustomer || delivered;
  return <ol className="relative space-y-4 border-l-2 border-[#dbe7e1] pl-5">
    <li className="relative"><span className={`absolute -left-[1.78rem] top-0.5 grid h-7 w-7 place-items-center rounded-full border-2 border-white text-[11px] font-bold shadow-sm ${pickupComplete ? "bg-[#2f8a64] text-white" : "bg-[#f97316] text-[#132c2a]"}`}>{pickupComplete ? <PortalIcon name="check" className="h-4 w-4" /> : "1"}</span><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#708078]">{pickupComplete ? "Picked up" : "Current step · pickup"}</p><p className="mt-1 text-sm font-bold text-[#213d33]">{job.store_name}</p><p className="mt-0.5 text-xs leading-5 text-[#60736a]">{job.store_address}</p></li>
    <li className="relative"><span className={`absolute -left-[1.78rem] top-0.5 grid h-7 w-7 place-items-center rounded-full border-2 border-white text-[11px] font-bold shadow-sm ${headingToCustomer ? "bg-[#2b6cb0] text-white" : "bg-[#edf2ef] text-[#718079]"}`}>{delivered ? <PortalIcon name="check" className="h-4 w-4" /> : "2"}</span><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#708078]">{headingToCustomer ? "Current step · deliver" : "Next · drop-off"}</p><p className="mt-1 text-sm font-bold text-[#213d33]">Customer delivery</p><p className="mt-0.5 text-xs leading-5 text-[#60736a]">{destination}</p></li>
  </ol>;
}

function DriverJobCard({ job, updating, onAction, onRequestHandoff, onVerifyHandoff, onRefresh }: { job: DriverJob; updating: boolean; onAction: (id: string, action: JobAction, note?: string) => void; onRequestHandoff: (id: string, type: "pickup" | "delivery") => Promise<boolean>; onVerifyHandoff: (id: string, type: "pickup" | "delivery", code: string) => Promise<boolean>; onRefresh: () => void }) {
  const [failureOpen, setFailureOpen] = useState(false);
  const [handoffType, setHandoffType] = useState<"pickup" | "delivery" | null>(null);
  const [handoffCode, setHandoffCode] = useState("");
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [proofLoading, setProofLoading] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const destination = destinationFor(job);
  const navigatePickup = ["assigned", "accepted", "at_pickup"].includes(job.status);
  const mapsTarget = navigatePickup ? job.store_lat != null && job.store_lng != null ? `${job.store_lat},${job.store_lng}` : job.store_address : destination;
  const mapsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsTarget)}`;
  const action: JobAction | null = job.status === "assigned" ? "accept" : job.status === "accepted" ? "at_pickup" : null;
  const actionLabel = job.status === "assigned" ? "Accept delivery" : "I am at the store";
  const proofCount = job.proof_count ?? 0;

  async function copyAddress() {
    try { await navigator.clipboard.writeText(navigatePickup ? job.store_address : destination); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { setCopied(false); }
  }

  async function startHandoff(type: "pickup" | "delivery") {
    setHandoffLoading(true);
    const ok = await onRequestHandoff(job.id, type);
    if (ok) { setHandoffType(type); setHandoffCode(""); }
    setHandoffLoading(false);
  }

  async function submitHandoff() {
    if (!handoffType || handoffCode.length !== 6) return;
    setHandoffLoading(true);
    const ok = await onVerifyHandoff(job.id, handoffType, handoffCode);
    if (ok) { setHandoffType(null); setHandoffCode(""); }
    setHandoffLoading(false);
  }

  async function captureProof(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, 3);
    if (!files.length) return;
    setProofLoading(true); setProofError(null);
    try {
      for (const file of files) await uploadDeliveryProof({ deliveryJobId: job.id, file });
      onRefresh();
    } catch (error) { setProofError(error instanceof Error ? error.message : "Could not upload delivery proof."); }
    event.target.value = "";
    setProofLoading(false);
  }

  return <article className="driver-job-card overflow-hidden rounded-[1.5rem] border border-[#dce5e0] bg-white shadow-[0_14px_30px_-28px_rgba(30,55,43,0.7)]">
    <div className="flex items-start justify-between gap-3 border-b border-[#e8efeb] px-4 py-4 sm:px-5"><div className="min-w-0"><p className="text-xs font-bold text-[#487767]">{job.order_number}</p><p className="mt-1 truncate text-base font-semibold text-[#19342b]">{job.store_name}</p></div><StatusPill status={job.status} /></div>
    <div className="space-y-4 p-4 sm:p-5">
      {job.status === "assigned" ? <AcceptCountdown expiresAt={job.assignment_expires_at} /> : null}
      <div className="flex flex-wrap gap-2 text-xs font-semibold text-[#5b6e65]">{job.item_count > 0 ? <span className="rounded-full bg-[#edf6f1] px-2.5 py-1">{job.item_count} item{job.item_count === 1 ? "" : "s"}</span> : null}{job.bag_summary ? <span className="max-w-full rounded-full bg-[#edf6f1] px-2.5 py-1">{job.bag_summary}</span> : null}{job.delivery_eta_minutes ? <span className="rounded-full bg-[#edf6f1] px-2.5 py-1">ETA {job.delivery_eta_minutes} min</span> : null}</div>
      <div className="rounded-xl border border-[#e2ebe6] bg-[#fbfdfc] p-4"><DeliveryTimeline job={job} destination={destination} /></div>
      {job.status === "at_pickup" ? <div className="rounded-xl border border-[#f1c58e] bg-[#fff7ed] px-3 py-3"><p className="text-sm font-bold text-[#8a4b2c]">Pickup verification required</p><p className="mt-1 text-xs leading-5 text-[#8a5a42]">Ask the store owner for the 6-digit pickup code before taking the parcel.</p>{job.pickup_handoff_status === "pending" ? <p className="mt-2 text-xs font-semibold text-[#b55a36]">Code requested · waiting for the store owner</p> : <button type="button" onClick={() => void startHandoff("pickup")} disabled={handoffLoading} className="mt-3 min-h-10 rounded-lg bg-[#F97316] px-3 py-2 text-xs font-bold text-[#132C2A] disabled:opacity-50">{handoffLoading ? "Requesting code…" : "Request pickup code"}</button>}</div> : null}
      {job.status === "collected" ? <div className="rounded-xl border border-[#b9d9c7] bg-[#f0faf3] px-3 py-3"><p className="text-sm font-bold text-[#155C4B]">Delivery proof and customer code</p><p className="mt-1 text-xs leading-5 text-[#4e6d61]">Take a clear parcel photo, then ask the customer for the delivery code.</p><label className="mt-3 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#155C4B] ring-1 ring-[#b9d9c7] hover:bg-[#f5fbf7]"><PortalIcon name="camera" className="h-4 w-4" />{proofLoading ? "Uploading photo…" : proofCount > 0 ? `${proofCount} proof photo${proofCount === 1 ? "" : "s"} · Add more` : "Take parcel photo"}<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple className="sr-only" onChange={(event) => void captureProof(event)} disabled={proofLoading} /></label>{proofCount > 0 ? <p className="mt-2 text-[11px] font-semibold text-[#277044]">Proof uploaded. The owner will see it on this order.</p> : null}{proofError ? <p className="mt-2 text-xs text-[#a53b30]">{proofError}</p> : null}{proofCount > 0 && job.delivery_handoff_status === "pending" ? <p className="mt-2 text-xs font-semibold text-[#b55a36]">Code requested · waiting for the customer</p> : null}{proofCount > 0 && job.delivery_handoff_status !== "pending" ? <button type="button" onClick={() => void startHandoff("delivery")} disabled={handoffLoading} className="mt-3 min-h-10 w-full rounded-lg bg-[#16824B] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{handoffLoading ? "Requesting code…" : "Request delivery code"}</button> : null}</div> : null}
      {job.delivery_notes ? <div className="flex gap-2 rounded-xl bg-[#FFF1C2] px-3 py-2.5 text-xs leading-5 text-[#6B4F00]"><PortalIcon name="warning" className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>Delivery note:</strong> {job.delivery_notes}</span></div> : null}
      <div className="flex flex-wrap gap-2"><a href={mapsHref} target="_blank" rel="noreferrer" className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#155C4B] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0F4639]"><PortalIcon name="location" className="h-4 w-4" />{navigatePickup ? "Navigate to store" : "Navigate to customer"}</a><button type="button" onClick={() => void copyAddress()} className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-[#D3DDD8] px-3 text-xs font-semibold text-[#155C4B] transition hover:bg-[#F3F8F4]" aria-label="Copy current address">{copied ? "Copied" : "Copy"}</button>{job.delivery_phone ? <a href={`tel:${job.delivery_phone}`} className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-[#D3DDD8] text-[#155C4B] transition hover:bg-[#F3F8F4]" aria-label="Call customer"><PortalIcon name="phone" className="h-4 w-4" /></a> : null}</div>
{action ? <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 -mx-4 rounded-t-2xl border-t border-[#e6eeea] bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(19,44,42,0.08)] backdrop-blur sm:static sm:mx-0 sm:rounded-xl sm:border sm:bg-[#fbfdfc] sm:px-4 sm:shadow-none"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6e827a]">Next action</p><button type="button" disabled={updating} onClick={() => onAction(job.id, action)} className="mt-2 min-h-12 w-full rounded-xl bg-[#F97316] px-3 py-2.5 text-sm font-bold text-[#132C2A] transition hover:bg-[#EA580C] disabled:opacity-50">{updating ? "Updating…" : actionLabel}</button></div> : null}
      {job.status === "collected" ? failureOpen ? <div className="space-y-2 rounded-xl border border-[#ead4d0] bg-[#fff8f7] p-3"><p className="text-xs font-semibold text-[#9e5348]">Why couldn’t delivery be completed?</p>{FAILURE_REASONS.map((reason) => <button key={reason} type="button" disabled={updating} onClick={() => onAction(job.id, "failed", reason)} className="block min-h-10 w-full rounded-lg border border-[#ead4d0] bg-white px-3 py-2 text-left text-xs font-semibold text-[#9e5348] disabled:opacity-50">{reason}</button>)}<button type="button" onClick={() => setFailureOpen(false)} className="w-full py-1 text-xs font-semibold text-[#5b6e65]">Cancel</button></div> : <button type="button" disabled={updating} onClick={() => setFailureOpen(true)} className="w-full py-1 text-xs font-semibold text-[#9e5348] disabled:opacity-50">Report delivery issue</button> : null}
      {handoffType ? <div className="fixed inset-0 z-50 grid place-items-end bg-[#132c2a]/45 p-4 sm:place-items-center"><div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-[1.5rem] bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#4e8875]">{handoffType === "pickup" ? "Store handoff" : "Customer handoff"}</p><h2 className="mt-1 text-xl font-semibold text-[#19342b]">Enter the 6-digit code</h2></div><button type="button" onClick={() => setHandoffType(null)} className="text-2xl leading-none text-[#718079]" aria-label="Close">×</button></div><p className="mt-3 text-sm leading-6 text-[#5b6e65]">{handoffType === "pickup" ? "The store owner should read the pickup code to you." : "The customer should read the delivery code to you."}</p><input autoFocus inputMode="numeric" maxLength={6} value={handoffCode} onChange={(event) => setHandoffCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-5 h-14 w-full rounded-xl border border-[#cfdcd5] text-center text-2xl font-bold tracking-[0.35em] text-[#19342b] outline-none focus:border-[#4e8875]" placeholder="000000" aria-label="6-digit verification code" /><button type="button" onClick={() => void submitHandoff()} disabled={handoffCode.length !== 6 || handoffLoading} className="mt-4 min-h-12 w-full rounded-xl bg-[#155C4B] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{handoffLoading ? "Verifying…" : "Verify and continue"}</button></div></div> : null}
    </div>
  </article>;
}

function AvailabilityCard({ driver, activeJobs, updating, online, onAvailability }: { driver: DriverData["driver"]; activeJobs: number; updating: boolean; online: boolean; onAvailability: (availability: DriverAvailability) => void }) {
  const available = driver.availability === "available";
  const nextAvailability: DriverAvailability = available ? "paused" : "available";
  return <section className="rounded-2xl border border-[#dce5e0] bg-white p-4 shadow-[0_12px_28px_-26px_rgba(30,55,43,0.7)] sm:p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><span className={`grid h-11 w-11 place-items-center rounded-xl ${available ? "bg-[#e6f5ed] text-[#237052]" : "bg-[#f1f4f2] text-[#718079]"}`}><span className={`h-3 w-3 rounded-full ${available ? "bg-[#2f8a64] shadow-[0_0_0_5px_rgba(47,138,100,0.12)]" : "bg-[#9aa9a2]"}`} /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#708078]">Shift status</p><p className="mt-1 text-lg font-bold text-[#19342b]">{available ? "Online and receiving jobs" : driver.availability === "paused" ? "Paused" : "Offline"}</p><p className="mt-1 text-xs text-[#6d7d75]">{activeJobs ? `${activeJobs} active ${activeJobs === 1 ? "delivery" : "deliveries"} in your queue` : available ? "Ready for nearby delivery requests" : "Resume when you are ready for work"}</p></div></div><button type="button" disabled={updating || !online} onClick={() => onAvailability(nextAvailability)} className={`min-h-11 rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:opacity-50 ${available ? "border border-[#d2ddd7] bg-white text-[#48685d] hover:bg-[#f5f8f6]" : "bg-[#155c4b] text-white hover:bg-[#0f4639]"}`}>{updating ? "Updating…" : available ? "Pause requests" : "Go online"}</button></div></section>;
}

function AssignmentNotice({ job, alertsEnabled, onEnableAlerts, onDismiss }: { job: DriverJob; alertsEnabled: boolean; onEnableAlerts: () => void; onDismiss: () => void }) {
  return <section className="mx-auto mt-4 w-[min(100%-2rem,72rem)] rounded-2xl border border-[#F3C48D] bg-[#FFF4E8] p-4 shadow-[0_16px_40px_-28px_rgba(185,89,22,0.5)] sm:flex sm:items-center sm:justify-between sm:gap-5"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F97316] text-[#132C2A]"><PortalIcon name="bell" className="h-5 w-5" /></span><div><p className="text-sm font-bold text-[#8A3E08]">New delivery assigned</p><p className="mt-1 text-xs leading-5 text-[#7A512F]">{job.order_number} from {job.store_name}. Accept it before the assignment window closes.</p></div></div><div className="mt-3 flex gap-2 sm:mt-0">{!alertsEnabled ? <button type="button" onClick={onEnableAlerts} className="min-h-10 rounded-lg border border-[#E6B879] bg-white px-3 text-xs font-semibold text-[#8A3E08]">Enable alerts</button> : null}<button type="button" onClick={onDismiss} className="min-h-10 rounded-lg px-3 text-xs font-semibold text-[#7A512F]">Dismiss</button></div></section>;
}

function HistoryList({ history }: { history: DriverHistoryJob[] }) {
  return <section className="rounded-2xl border border-[#dce5e0] bg-white p-4 sm:p-5"><div className="flex items-end justify-between gap-3 border-b border-[#edf1ee] pb-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#4e8875]">Recent work</p><h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#19342b]">Delivery history</h2></div><span className="rounded-full bg-[#edf6f1] px-2.5 py-1 text-xs font-semibold text-[#376f5c]">Last 30 days</span></div><div className="divide-y divide-[#edf1ee]">{history.map((job) => <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="text-sm font-semibold text-[#33473e]">{job.order_number} · {job.store_name}</p><p className="mt-1 text-xs text-[#7a8982]">{job.delivery_area} · {job.status === "delivered" ? `Delivered ${formatTime(job.delivered_at)}` : job.failure_reason ?? statusLabel[job.status]}</p></div><StatusPill status={job.status} /></div>)}{history.length === 0 ? <div className="py-12 text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#e8f4ee] text-[#3c7d68]"><PortalIcon name="orders" className="h-5 w-5" /></span><p className="mt-3 text-sm font-semibold text-[#33473e]">No completed deliveries yet</p><p className="mt-1 text-xs leading-5 text-[#718079]">Your completed route will appear here.</p></div> : null}</div></section>;
}

function ShiftSummary({ activeJobs, completedJobs }: { activeJobs: number; completedJobs: number }) {
  return <section className="rounded-2xl border border-[#dce5e0] bg-white p-5"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#4e8875]">Today at a glance</p><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-[#f5f8f6] p-3"><p className="text-2xl font-semibold tracking-[-0.04em] text-[#19342b]">{activeJobs}</p><p className="mt-1 text-xs text-[#718079]">Active jobs</p></div><div className="rounded-xl bg-[#f5f8f6] p-3"><p className="text-2xl font-semibold tracking-[-0.04em] text-[#19342b]">{completedJobs}</p><p className="mt-1 text-xs text-[#718079]">Completed today</p></div></div><p className="mt-4 text-xs leading-5 text-[#718079]">Keep availability accurate so dispatch can send you the closest next pickup.</p></section>;
}

function HelpPanel({ supportEmail, partnerName }: { supportEmail?: string | null; partnerName?: string | null }) {
  return <section className="rounded-2xl border border-[#dce5e0] bg-white p-5"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#4e8875]">Need help?</p><h2 className="mt-1 text-lg font-semibold text-[#19342b]">Contact dispatch</h2><p className="mt-2 text-xs leading-5 text-[#718079]">{partnerName ?? "Your delivery partner"} can help with address, store, or customer issues.</p>{supportEmail ? <a href={`mailto:${supportEmail}`} className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#213d33] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2f6f5d]"><PortalIcon name="phone" className="h-4 w-4" /> Email dispatch</a> : <p className="mt-4 rounded-lg bg-[#f5f8f6] px-3 py-2 text-xs text-[#718079]">Ask your dispatcher for a support contact.</p>}</section>;
}

function BottomNav({ section, onChange }: { section: DriverSection; onChange: (section: DriverSection) => void }) {
  const items: Array<{ id: DriverSection; label: string; icon: "location" | "orders" | "phone" }> = [{ id: "route", label: "Route", icon: "location" }, { id: "history", label: "History", icon: "orders" }, { id: "help", label: "Help", icon: "phone" }];
  return <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#DCE5E0] bg-white/95 px-4 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur sm:hidden" aria-label="Rider sections"><div className="mx-auto grid max-w-md grid-cols-3 gap-2">{items.map((item) => <button key={item.id} type="button" onClick={() => onChange(item.id)} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold ${section === item.id ? "bg-[#FFF1C2] text-[#8A3E08]" : "text-[#718079]"}`} aria-current={section === item.id ? "page" : undefined}><PortalIcon name={item.icon} className="h-4 w-4" />{item.label}</button>)}</div></nav>;
}

export function DriverWorkspace() {
  const { auth, loading: authLoading } = useAuthUser();
  const router = useRouter();
  const [data, setData] = useState<DriverData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [section, setSection] = useState<DriverSection>("route");
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [assignmentNotice, setAssignmentNotice] = useState<DriverJob | null>(null);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const previousAssignedIds = useRef<Set<string> | null>(null);
  const autoOnlineAttempted = useRef(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    const { data: response, error: rpcError } = await createClient().rpc("driver_delivery_workspace_data");
    if (rpcError) { setError(friendlyError(rpcError.message)); if (!silent) setData(null); }
    else { const nextData = response as unknown as Partial<DriverData>; setData({ ...(nextData as DriverData), jobs: nextData.jobs ?? [], history: nextData.history ?? [] }); setError(null); setLastUpdatedAt(new Date().toISOString()); }
    setLoading(false); setRefreshing(false);
  }, []);

  useEffect(() => {
    if (!auth) return;
    const requestLoad = () => void load();
    if (typeof queueMicrotask === "function") queueMicrotask(requestLoad); else window.setTimeout(requestLoad, 0);
  }, [auth, load]);

  useEffect(() => {
    if (!auth || !data || !online || autoOnlineAttempted.current) return;
    autoOnlineAttempted.current = true;
    if (data.driver.availability === "offline" && data.jobs.length === 0) void setAvailability("available");
  }, [auth, data, online]);

  useEffect(() => {
    const onlineHandler = () => setOnline(true); const offlineHandler = () => setOnline(false);
    window.addEventListener("online", onlineHandler); window.addEventListener("offline", offlineHandler);
    return () => { window.removeEventListener("online", onlineHandler); window.removeEventListener("offline", offlineHandler); };
  }, []);

  useEffect(() => {
    if (!auth || !data?.driver.id) return;
    const supabase = createClient();
    const channel = supabase.channel(`driver-jobs-${data.driver.id}`).on("postgres_changes", { event: "*", schema: "public", table: "delivery_jobs", filter: `driver_id=eq.${data.driver.id}` }, () => void load(true)).subscribe();
    const poll = window.setInterval(() => void load(true), 15_000);
    return () => { window.clearInterval(poll); void supabase.removeChannel(channel); };
  }, [auth, data?.driver.id, load]);

  useEffect(() => {
    const assigned = data?.jobs.filter((job) => job.status === "assigned") ?? [];
    const ids = new Set(assigned.map((job) => job.id));
    if (previousAssignedIds.current) {
      const newJob = assigned.find((job) => !previousAssignedIds.current?.has(job.id));
      if (newJob) {
        setAssignmentNotice(newJob);
        if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate([160, 80, 160]);
        if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification("New Morni delivery", { body: `${newJob.order_number} from ${newJob.store_name}` });
      }
    }
    previousAssignedIds.current = ids;
  }, [data?.jobs]);

  const hasExpiredAssignment = useMemo(() => data?.jobs.some((job) => job.status === "assigned" && job.assignment_expires_at && new Date(job.assignment_expires_at).getTime() <= Date.now()) ?? false, [data?.jobs]);
  useEffect(() => { if (!hasExpiredAssignment) return; const id = window.setTimeout(() => void load(true), 1200); return () => window.clearTimeout(id); }, [hasExpiredAssignment, load]);

  async function setAvailability(availability: DriverAvailability) {
    if (!data || (availability !== "offline" && !online)) return;
    setUpdating("availability"); setError(null);
    let lat: number | null = null; let lng: number | null = null;
    if (availability === "available" && "geolocation" in navigator) {
      try { const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 7000, maximumAge: 60_000 })); lat = position.coords.latitude; lng = position.coords.longitude; } catch { /* The backend still permits availability without location. */ }
    }
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("set_delivery_driver_availability", { p_availability: availability, p_lat: lat, p_lng: lng });
    if (rpcError) setError(friendlyError(rpcError.message));
    else if (availability === "offline") {
      await supabase.auth.signOut();
      router.replace("/driver/sign-in?offline=1");
    } else await load(true);
    setUpdating(null);
  }

  async function refreshLocation() {
    if (!data || !online) return;
    if (!("geolocation" in navigator)) {
      setError("Location access is not available on this device.");
      return;
    }
    setUpdating("location");
    setError(null);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 }));
      const { error: locationError } = await createClient().rpc("set_delivery_driver_availability", { p_availability: data.driver.availability, p_lat: position.coords.latitude, p_lng: position.coords.longitude });
      if (locationError) setError(friendlyError(locationError.message)); else await load(true);
    } catch {
      setError("Location access was blocked. Allow it in your browser settings and try again.");
    }
    setUpdating(null);
  }

  async function jobAction(jobId: string, action: JobAction, note?: string) {
    if (!online) { setError("You are offline. Reconnect before updating a delivery."); return; }
    setUpdating(jobId); setError(null);
    const supabase = createClient(); let rpcError: { message: string } | null = null;
    if (action === "accept") ({ error: rpcError } = await supabase.rpc("accept_delivery_job", { p_delivery_job_id: jobId }));
    else if (action === "decline") ({ error: rpcError } = await supabase.rpc("decline_delivery_job", { p_delivery_job_id: jobId, p_reason: "Rider unavailable" }));
    else ({ error: rpcError } = await supabase.rpc("advance_delivery_job", { p_delivery_job_id: jobId, p_status: action, p_note: note ?? null }));
    if (rpcError) setError(friendlyError(rpcError.message)); else await load(true);
    setUpdating(null);
  }

  async function requestHandoff(jobId: string, type: "pickup" | "delivery") {
    if (!online) { setError("You are offline. Reconnect before requesting a verification code."); return false; }
    setUpdating(jobId); setError(null);
    const { error: rpcError } = await createClient().rpc("request_delivery_handoff", { p_delivery_job_id: jobId, p_handoff_type: type });
    if (rpcError) { setError(friendlyError(rpcError.message)); setUpdating(null); return false; }
    await load(true); setUpdating(null); return true;
  }

  async function verifyHandoff(jobId: string, type: "pickup" | "delivery", code: string) {
    if (!online) { setError("You are offline. Reconnect before verifying a handoff."); return false; }
    setUpdating(jobId); setError(null);
    const { error: rpcError } = await createClient().rpc("verify_delivery_handoff", { p_delivery_job_id: jobId, p_handoff_type: type, p_code: code });
    if (rpcError) { setError(friendlyError(rpcError.message)); setUpdating(null); return false; }
    await load(true); setUpdating(null); return true;
  }

  async function enableAlerts() {
    if (typeof Notification === "undefined") return;
    setAlertsEnabled((await Notification.requestPermission()) === "granted");
  }

  if (authLoading || (auth && loading)) return <DriverLoading />;
  if (!auth) return <DriverAccess title="Rider sign in" description="Sign in with the account invited by your delivery company." />;
  if (error && !data) return <DriverAccess title="Rider access is restricted" description={error} />;

  const driver = data!.driver;
  const activeJobs = data!.jobs;
  const currentJob = activeJobs.find((job) => ["accepted", "at_pickup", "collected"].includes(job.status)) ?? activeJobs[0] ?? null;
  const otherJobs = currentJob ? activeJobs.filter((job) => job.id !== currentJob.id) : [];
  const completedToday = data!.history.filter((job) => job.status === "delivered" && job.delivered_at?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length;

  return <main className="driver-app min-h-dvh pb-[calc(7rem+env(safe-area-inset-bottom))] sm:pb-10">
    <header className="sticky top-0 z-20 border-b border-[#dce5e0] bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6"><div className="flex min-w-0 items-center gap-3"><BrandMark className="h-10 w-10 object-contain" /><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6b8077]">Morni rider</p><p className="truncate text-lg font-semibold">Hello, {driver.display_name.split(" ")[0]}</p></div></div><div className="flex items-center gap-2"><span className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline-flex ${driver.availability === "available" ? "bg-[#e8f4ee] text-[#2f6f5d]" : "bg-[#f1f4f2] text-[#6f7e77]"}`}><span className={`h-1.5 w-1.5 rounded-full ${driver.availability === "available" ? "bg-[#2f8a64]" : "bg-[#9aa9a2]"}`} />{driver.availability}</span><span className="hidden text-[11px] text-[#819089] lg:inline">{lastUpdatedAt ? `Updated ${formatTime(lastUpdatedAt)}` : "Connecting"}</span><button type="button" onClick={() => void load(true)} disabled={refreshing || !online} className="grid h-10 w-10 place-items-center rounded-xl border border-[#d7e1dc] bg-white text-[#4d6c60] transition hover:bg-[#f5f8f6] disabled:opacity-50" aria-label="Refresh deliveries"><PortalIcon name="refresh" className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /></button></div></div></header>
    {!online ? <div className="border-b border-[#E6B879] bg-[#FFF1C2] px-4 py-2.5 text-center text-xs font-semibold text-[#6B4F00]">You are offline. Current jobs are visible, but actions are paused until you reconnect.</div> : null}
    {assignmentNotice ? <AssignmentNotice job={assignmentNotice} alertsEnabled={alertsEnabled} onEnableAlerts={() => void enableAlerts()} onDismiss={() => setAssignmentNotice(null)} /> : null}
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8"><div className="mb-5 flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#4e8875]">Driver cockpit</p><h1 className="mt-1 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">{section === "route" ? "Today’s route" : section === "history" ? "Delivery history" : "Rider support"}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#64736c]">{section === "route" ? "Keep your availability accurate and take the next delivery one clear step at a time." : section === "history" ? "Review completed and exception deliveries from the last 30 days." : "Get help from your delivery partner when a route or customer needs attention."}</p></div><Link href="/" className="hidden text-xs font-semibold text-[#487368] transition hover:text-[#19342b] sm:inline-flex">Open Morni</Link></div>
      {section === "route" ? <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]"><div className="space-y-5"><AvailabilityCard driver={driver} activeJobs={activeJobs.length} updating={updating === "availability"} online={online} onAvailability={(next) => void setAvailability(next)} /><DriverMap job={currentJob} driverLat={driver.last_lat} driverLng={driver.last_lng} locationUpdatedAt={driver.last_location_at} online={online} updating={updating === "location"} onRefreshLocation={() => void refreshLocation()} />{error ? <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{error}</p> : null}<section><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#4e8875]">Next up</p><h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">{currentJob ? "Active delivery" : "No active delivery"}</h2></div><span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#5b6e65]">{activeJobs.length} active</span></div><div className="mt-4 space-y-4">{currentJob ? <DriverJobCard job={currentJob} updating={updating === currentJob.id} onAction={jobAction} onRequestHandoff={requestHandoff} onVerifyHandoff={verifyHandoff} onRefresh={() => void load(true)} /> : <div className="rounded-2xl border border-dashed border-[#cad8d1] bg-white p-8 text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#e8f4ee] text-[#3c7d68]"><PortalIcon name="package" className="h-5 w-5" /></span><h2 className="mt-4 font-semibold">No active delivery jobs</h2><p className="mt-2 text-sm leading-6 text-[#6d7d75]">You are available. Morni will send nearby pickup requests here.</p></div>}{otherJobs.length > 0 ? <div><p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[#708078]">Other active jobs</p><div className="space-y-4">{otherJobs.map((job) => <DriverJobCard key={job.id} job={job} updating={updating === job.id} onAction={jobAction} onRequestHandoff={requestHandoff} onVerifyHandoff={verifyHandoff} onRefresh={() => void load(true)} />)}</div></div> : null}</div></section></div><aside className="hidden space-y-5 xl:block"><ShiftSummary activeJobs={activeJobs.length} completedJobs={completedToday} /><HelpPanel supportEmail={data!.partner?.support_email} partnerName={data!.partner?.name} /></aside></div> : null}
      {section === "history" ? <HistoryList history={data!.history} /> : null}
      {section === "help" ? <div className="max-w-xl"><HelpPanel supportEmail={data!.partner?.support_email} partnerName={data!.partner?.name} /></div> : null}
    </div>
    <div className="mx-auto hidden max-w-6xl px-4 sm:block sm:px-6"><div className="mt-5 grid max-w-xl grid-cols-3 gap-2 rounded-2xl border border-[#dce5e0] bg-white p-1"><button type="button" onClick={() => setSection("route")} className={`rounded-xl px-3 py-2 text-xs font-semibold ${section === "route" ? "bg-[#eaf4ee] text-[#2f6f5d]" : "text-[#718079]"}`}>Route</button><button type="button" onClick={() => setSection("history")} className={`rounded-xl px-3 py-2 text-xs font-semibold ${section === "history" ? "bg-[#eaf4ee] text-[#2f6f5d]" : "text-[#718079]"}`}>History</button><button type="button" onClick={() => setSection("help")} className={`rounded-xl px-3 py-2 text-xs font-semibold ${section === "help" ? "bg-[#eaf4ee] text-[#2f6f5d]" : "text-[#718079]"}`}>Help</button></div></div>
    <BottomNav section={section} onChange={setSection} />
  </main>;
}
