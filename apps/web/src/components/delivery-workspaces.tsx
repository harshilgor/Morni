"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PortalIcon } from "@/components/portal-icons";
import { createClient } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/use-auth-user";
import { BrandMark } from "@/components/brand-logo";

type DeliveryJobStatus = "unassigned" | "assigned" | "accepted" | "at_pickup" | "collected" | "delivered" | "failed" | "cancelled";
type DriverAvailability = "offline" | "available" | "assigned" | "paused";

type PartnerData = {
  partner: { id: string; name: string; is_active: boolean; auto_dispatch_enabled: boolean };
  drivers: Array<{ id: string; display_name: string; availability: DriverAvailability; last_location_at: string | null }>;
  jobs: Array<{ id: string; status: DeliveryJobStatus; assigned_at: string | null; assignment_expires_at: string | null; failure_reason: string | null; order_number: string; store_name: string; pickup_area: string; delivery_area: string; driver_name: string | null }>;
};

type DriverData = {
  driver: { id: string; display_name: string; availability: DriverAvailability; is_active: boolean };
  jobs: Array<{ id: string; status: DeliveryJobStatus; assignment_expires_at: string | null; order_number: string; store_name: string; store_address: string; delivery_street: string; delivery_building: string | null; delivery_apartment: string | null; delivery_area: string; delivery_notes: string | null; delivery_phone: string | null }>;
};

const statusLabel: Record<DeliveryJobStatus, string> = {
  unassigned: "Waiting for rider",
  assigned: "Awaiting acceptance",
  accepted: "Heading to pickup",
  at_pickup: "At the store",
  collected: "Out for delivery",
  delivered: "Delivered",
  failed: "Needs attention",
  cancelled: "Cancelled",
};

const statusTone: Record<DeliveryJobStatus, string> = {
  unassigned: "bg-amber-100 text-amber-800",
  assigned: "bg-sky-100 text-sky-800",
  accepted: "bg-violet-100 text-violet-800",
  at_pickup: "bg-indigo-100 text-indigo-800",
  collected: "bg-teal-100 text-teal-800",
  delivered: "bg-emerald-100 text-emerald-800",
  failed: "bg-rose-100 text-rose-800",
  cancelled: "bg-stone-200 text-stone-700",
};

function time(value: string | null) {
  if (!value) return "No location signal";
  return new Intl.DateTimeFormat("en-AE", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function JobStatus({ status }: { status: DeliveryJobStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone[status]}`}>{statusLabel[status]}</span>;
}

function WorkspaceAccess({ title, description, href = "/auth" }: { title: string; description: string; href?: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#f6f7f5] px-5 text-center"><section className="max-w-md rounded-2xl border border-[#dbe4df] bg-white p-8 shadow-[0_24px_70px_-40px_rgba(25,42,35,0.45)]"><span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#e8f4ee] text-[#367762]"><PortalIcon name="package" className="h-5 w-5" /></span><h1 className="mt-5 text-2xl font-semibold text-[#19342b]">{title}</h1><p className="mt-3 text-sm leading-6 text-[#63726c]">{description}</p><Link href={href} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#213d33] px-4 py-2.5 text-sm font-semibold text-white">Sign in <PortalIcon name="arrow" className="h-4 w-4" /></Link></section></main>;
}

export function PartnerWorkspace() {
  const { auth, loading: authLoading } = useAuthUser();
  const [data, setData] = useState<PartnerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"dispatcher" | "driver">("driver");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [sendingInvite, setSendingInvite] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    // Existing dispatchers already have membership. A founder-added partner
    // owner is linked here only when their verified auth email matches.
    await supabase.rpc("claim_delivery_partner_owner_access");
    const { data: response, error: rpcError } = await supabase.rpc("partner_delivery_workspace_data");
    if (rpcError) { setError(rpcError.message); setData(null); } else { setData(response as unknown as PartnerData); setError(null); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!auth) return;
    const requestLoad = () => void load();
    if (typeof queueMicrotask === "function") queueMicrotask(requestLoad);
    else window.setTimeout(requestLoad, 0);
  }, [auth, load]);

  const counts = useMemo(() => ({
    active: data?.jobs.filter((job) => ["assigned", "accepted", "at_pickup", "collected"].includes(job.status)).length ?? 0,
    waiting: data?.jobs.filter((job) => job.status === "unassigned").length ?? 0,
    available: data?.drivers.filter((driver) => driver.availability === "available").length ?? 0,
  }), [data]);

  async function createInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    setSendingInvite(true); setInviteError(null); setInviteUrl(null);
    const response = await fetch(`/api/delivery/partners/${data.partner.id}/invites`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, role }) });
    const payload = (await response.json().catch(() => null)) as { inviteUrl?: string; error?: string } | null;
    if (!response.ok || !payload?.inviteUrl) setInviteError(payload?.error ?? "Unable to create the invite.");
    else { setInviteUrl(payload.inviteUrl); setEmail(""); }
    setSendingInvite(false);
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
  }

  if (authLoading || (auth && loading)) return <WorkspaceLoading />;
  if (!auth) return <WorkspaceAccess title="Partner sign in" description="Sign in with the account invited by your delivery company." href="/auth?next=/partner" />;
  if (error || !data) return <WorkspaceAccess title="Partner access is restricted" description="This workspace is available only to invited delivery-company dispatchers." />;

  return <main className="min-h-screen bg-[#f6f7f5] text-[#19342b]"><header className="border-b border-[#dce5e0] bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6"><div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg border border-[#dce5e0] bg-white p-1.5"><BrandMark className="h-full w-full object-contain" /></span><span className="min-w-0"><span className="block text-[10px] font-bold uppercase tracking-[0.15em] text-[#6b8077]">Morni delivery partner</span><span className="block truncate text-lg font-semibold">{data.partner.name}</span></span></div><Link href="/" className="text-xs font-semibold text-[#487368] hover:text-[#19342b]">Open Morni</Link></div></header><div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:py-10"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#4e8875]">Dispatch desk</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Automatic delivery queue</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#64736c]">Morn assigns ready orders to the nearest available rider. Keep availability accurate and only step in for exceptions.</p></div><button type="button" onClick={() => void load()} className="grid h-10 w-10 place-items-center rounded-lg border border-[#d5e0da] bg-white text-[#527067] hover:bg-[#edf5f0]" aria-label="Refresh dispatch queue"><PortalIcon name="refresh" className="h-4 w-4" /></button></div><div className="mt-7 grid gap-3 sm:grid-cols-3"><Metric label="Active deliveries" value={counts.active} detail="Assigned or moving" /><Metric label="Waiting for a rider" value={counts.waiting} detail="Auto-dispatch keeps trying" tone="warning" /><Metric label="Riders available" value={counts.available} detail={`${data.drivers.length} active rider${data.drivers.length === 1 ? "" : "s"} total`} tone="good" /></div><div className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]"><section className="overflow-hidden rounded-xl border border-[#dce5e0] bg-white"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e5ece8] p-5"><div><h2 className="font-semibold">Delivery queue</h2><p className="mt-1 text-xs text-[#708078]">Recent jobs assigned to {data.partner.name}.</p></div><span className="rounded-full bg-[#edf6f1] px-2.5 py-1 text-xs font-semibold text-[#376f5c]">Auto-dispatch {data.partner.auto_dispatch_enabled ? "on" : "paused"}</span></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-[#fbfdfc] text-[10px] font-bold uppercase tracking-[0.13em] text-[#75847d]"><tr>{["Order", "Pickup", "Drop-off", "Rider", "Status"].map((heading) => <th key={heading} className="px-5 py-3">{heading}</th>)}</tr></thead><tbody className="divide-y divide-[#e9efeb]">{data.jobs.map((job) => <tr key={job.id}><td className="px-5 py-4 font-semibold text-[#274337]">{job.order_number}</td><td className="px-5 py-4 text-[#5f7169]">{job.store_name}<span className="mt-0.5 block text-xs text-[#87948e]">{job.pickup_area}</span></td><td className="px-5 py-4 text-[#5f7169]">{job.delivery_area}</td><td className="px-5 py-4 text-[#5f7169]">{job.driver_name ?? "-"}</td><td className="px-5 py-4"><JobStatus status={job.status} /></td></tr>)}{data.jobs.length === 0 ? <tr><td colSpan={5} className="px-5 py-14 text-center text-sm text-[#75837d]">Jobs will appear here as Morni stores mark orders ready for pickup.</td></tr> : null}</tbody></table></div></section><aside className="space-y-5"><section className="rounded-xl border border-[#dce5e0] bg-white p-5"><h2 className="font-semibold">Invite your team</h2><p className="mt-1 text-xs leading-5 text-[#708078]">Invite dispatchers or riders using their email address. The link is safe to share once.</p><form onSubmit={createInvite} className="mt-4 space-y-3"><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" className="w-full rounded-lg border border-[#d6e1db] px-3 py-2.5 text-sm outline-none focus:border-[#4e8875]" /><select value={role} onChange={(event) => setRole(event.target.value as "dispatcher" | "driver")} className="w-full rounded-lg border border-[#d6e1db] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#4e8875]"><option value="driver">Rider</option><option value="dispatcher">Dispatcher</option></select><button type="submit" disabled={sendingInvite} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#213d33] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{sendingInvite ? "Creating invite" : "Create invite"}<PortalIcon name="arrow" className="h-4 w-4" /></button></form>{inviteError ? <p className="mt-3 text-xs leading-5 text-[#b14a3f]">{inviteError}</p> : null}{inviteUrl ? <div className="mt-4 rounded-lg bg-[#edf6f1] p-3"><p className="text-xs font-semibold text-[#356c59]">Invite ready</p><button type="button" onClick={() => void copyInvite()} className="mt-2 w-full rounded-md border border-[#b9d9c9] bg-white px-3 py-2 text-xs font-semibold text-[#315e50]">Copy invite link</button></div> : null}</section><section className="rounded-xl border border-[#dce5e0] bg-white p-5"><h2 className="font-semibold">Rider availability</h2><div className="mt-4 space-y-3">{data.drivers.map((driver) => <div key={driver.id} className="flex items-center justify-between gap-3"><span className="min-w-0"><span className="block truncate text-sm font-medium text-[#33473e]">{driver.display_name}</span><span className="mt-0.5 block text-xs text-[#829089]">{time(driver.last_location_at)}</span></span><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${driver.availability === "available" ? "bg-emerald-100 text-emerald-800" : driver.availability === "assigned" ? "bg-sky-100 text-sky-800" : "bg-stone-100 text-stone-600"}`}>{driver.availability}</span></div>)}{data.drivers.length === 0 ? <p className="text-sm leading-6 text-[#77867f]">Invite a rider to begin receiving automatic assignments.</p> : null}</div></section></aside></div></div></main>;
}

export function DriverWorkspace() {
  const { auth, loading: authLoading } = useAuthUser();
  const [data, setData] = useState<DriverData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: response, error: rpcError } = await createClient().rpc("driver_delivery_workspace_data");
    if (rpcError) { setData(null); setError(rpcError.message); } else { setData(response as unknown as DriverData); setError(null); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!auth) return;
    const requestLoad = () => void load();
    if (typeof queueMicrotask === "function") queueMicrotask(requestLoad);
    else window.setTimeout(requestLoad, 0);
  }, [auth, load]);

  async function setAvailability(availability: DriverAvailability) {
    if (!data) return;
    setUpdating("availability"); setError(null);
    let lat: number | null = null; let lng: number | null = null;
    if (availability === "available" && "geolocation" in navigator) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 7000, maximumAge: 60_000 }));
        lat = position.coords.latitude; lng = position.coords.longitude;
      } catch { /* A rider can still make themselves available but ranks after located riders. */ }
    }
    const { error: rpcError } = await createClient().rpc("set_delivery_driver_availability", { p_availability: availability, p_lat: lat, p_lng: lng });
    if (rpcError) setError(rpcError.message); else await load();
    setUpdating(null);
  }

  async function jobAction(jobId: string, action: "accept" | "decline" | "at_pickup" | "collected" | "delivered" | "failed") {
    setUpdating(jobId); setError(null);
    const supabase = createClient();
    let rpcError: { message: string } | null = null;
    if (action === "accept") ({ error: rpcError } = await supabase.rpc("accept_delivery_job", { p_delivery_job_id: jobId }));
    else if (action === "decline") ({ error: rpcError } = await supabase.rpc("decline_delivery_job", { p_delivery_job_id: jobId, p_reason: "Rider unavailable" }));
    else ({ error: rpcError } = await supabase.rpc("advance_delivery_job", { p_delivery_job_id: jobId, p_status: action, p_note: action === "failed" ? "Delivery could not be completed." : null }));
    if (rpcError) setError(rpcError.message); else await load();
    setUpdating(null);
  }

  if (authLoading || (auth && loading)) return <WorkspaceLoading />;
  if (!auth) return <WorkspaceAccess title="Rider sign in" description="Sign in with the account invited by your delivery company." href="/auth?next=/driver" />;
  if (error && !data) return <WorkspaceAccess title="Rider access is restricted" description="This workspace is available only to invited delivery riders." />;

  const driver = data!.driver;
  return <main className="min-h-screen bg-[#f6f7f5] pb-10 text-[#19342b]"><header className="sticky top-0 z-20 border-b border-[#dce5e0] bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-xl items-center justify-between gap-4 px-4 py-3"><span className="flex items-center gap-3"><BrandMark className="h-9 w-9 object-contain" /><span><span className="block text-[10px] font-bold uppercase tracking-[0.15em] text-[#6b8077]">Morni rider</span><span className="block text-lg font-semibold">Hello, {driver.display_name.split(" ")[0]}</span></span></span><button type="button" onClick={() => void load()} className="grid h-10 w-10 place-items-center rounded-lg border border-[#d7e1dc] bg-white text-[#4d6c60]" aria-label="Refresh deliveries"><PortalIcon name="refresh" className="h-4 w-4" /></button></div></header><div className="mx-auto max-w-xl px-4 py-5"><section className="rounded-xl border border-[#dce5e0] bg-white p-4"><div className="flex items-center justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6c7d75]">Availability</p><p className="mt-1 text-lg font-semibold capitalize">{driver.availability}</p></div><div className="flex gap-2">{driver.availability !== "available" ? <button type="button" onClick={() => void setAvailability("available")} disabled={updating === "availability"} className="rounded-lg bg-[#217057] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Go available</button> : <button type="button" onClick={() => void setAvailability("offline")} disabled={updating === "availability" || data!.jobs.length > 0} className="rounded-lg border border-[#d7e1dc] px-3 py-2 text-sm font-semibold text-[#48645b] disabled:opacity-50">Go offline</button>}</div></div><p className="mt-3 text-xs leading-5 text-[#718079]">Share your location when you go available so Morni can assign nearby pickups first.</p></section>{error ? <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{error}</p> : null}<section className="mt-5"><div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#4e8875]">Your delivery jobs</p><h1 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">Today’s route</h1></div><span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#5b6e65]">{data!.jobs.length} active</span></div><div className="mt-4 space-y-4">{data!.jobs.map((job) => <DriverJobCard key={job.id} job={job} updating={updating === job.id} onAction={jobAction} />)}{data!.jobs.length === 0 ? <section className="rounded-xl border border-dashed border-[#cad8d1] bg-white p-8 text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#e8f4ee] text-[#3c7d68]"><PortalIcon name="package" className="h-5 w-5" /></span><h2 className="mt-4 font-semibold">No active delivery jobs</h2><p className="mt-2 text-sm leading-6 text-[#6d7d75]">Stay available and Morni will automatically send nearby pickup requests here.</p></section> : null}</div></section></div></main>;
}

function DriverJobCard({ job, updating, onAction }: { job: DriverData["jobs"][number]; updating: boolean; onAction: (id: string, action: "accept" | "decline" | "at_pickup" | "collected" | "delivered" | "failed") => void }) {
  const destination = [job.delivery_street, job.delivery_building, job.delivery_apartment, job.delivery_area].filter(Boolean).join(", ");
  const mapsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.status === "accepted" || job.status === "at_pickup" ? job.store_address : destination)}`;
  const action = job.status === "assigned" ? "accept" : job.status === "accepted" ? "at_pickup" : job.status === "at_pickup" ? "collected" : job.status === "collected" ? "delivered" : null;
  const actionLabel = job.status === "assigned" ? "Accept delivery" : job.status === "accepted" ? "I am at the store" : job.status === "at_pickup" ? "I collected the order" : "Mark delivered";
  return <article className="overflow-hidden rounded-xl border border-[#dce5e0] bg-white shadow-[0_14px_30px_-28px_rgba(30,55,43,0.7)]"><div className="flex items-start justify-between gap-3 border-b border-[#e8efeb] px-4 py-3"><div><p className="text-xs font-bold text-[#487767]">{job.order_number}</p><p className="mt-1 text-sm font-semibold">{job.store_name}</p></div><JobStatus status={job.status} /></div><div className="space-y-4 p-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#708078]">Pickup</p><p className="mt-1 text-sm leading-5 text-[#33473e]">{job.store_address}</p></div><div><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#708078]">Drop-off</p><p className="mt-1 text-sm leading-5 text-[#33473e]">{destination}</p>{job.delivery_notes ? <p className="mt-2 rounded-lg bg-[#f5f8f6] px-3 py-2 text-xs leading-5 text-[#5c6c64]">{job.delivery_notes}</p> : null}</div><div className="flex flex-wrap gap-2"><a href={mapsHref} target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-[#cfdcd5] px-3 py-2.5 text-sm font-semibold text-[#3f6155]"><PortalIcon name="location" className="h-4 w-4" />Navigate</a>{job.delivery_phone ? <a href={`tel:${job.delivery_phone}`} className="grid h-11 w-11 place-items-center rounded-lg border border-[#cfdcd5] text-[#3f6155]" aria-label="Call customer"><PortalIcon name="phone" className="h-4 w-4" /></a> : null}</div>{job.status === "assigned" ? <div className="grid grid-cols-2 gap-2"><button type="button" disabled={updating} onClick={() => onAction(job.id, "decline")} className="rounded-lg border border-[#ead4d0] px-3 py-2.5 text-sm font-semibold text-[#a24a40] disabled:opacity-50">Decline</button><button type="button" disabled={updating} onClick={() => onAction(job.id, "accept")} className="rounded-lg bg-[#213d33] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Accept</button></div> : null}{action && job.status !== "assigned" ? <button type="button" disabled={updating} onClick={() => onAction(job.id, action)} className="w-full rounded-lg bg-[#213d33] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{updating ? "Updating" : actionLabel}</button> : null}{job.status === "collected" ? <button type="button" disabled={updating} onClick={() => onAction(job.id, "failed")} className="w-full text-xs font-semibold text-[#9e5348] disabled:opacity-50">Report delivery issue</button> : null}</div></article>;
}

function Metric({ label, value, detail, tone = "default" }: { label: string; value: number; detail: string; tone?: "default" | "warning" | "good" }) {
  const styles = tone === "good" ? "border-emerald-200 bg-emerald-50" : tone === "warning" ? "border-amber-200 bg-amber-50" : "border-[#dce5e0] bg-white";
  return <section className={`rounded-xl border p-4 ${styles}`}><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#74837c]">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums text-[#1e392f]">{value}</p><p className="mt-1 text-xs text-[#708078]">{detail}</p></section>;
}

function WorkspaceLoading() {
  return <main className="grid min-h-screen place-items-center bg-[#f6f7f5]"><div className="h-10 w-10 animate-spin rounded-full border-4 border-[#d2e2da] border-t-[#3f806b]" /></main>;
}
