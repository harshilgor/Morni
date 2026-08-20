"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BrandMark } from "@/components/brand-logo";
import { PortalIcon } from "@/components/portal-icons";
import { createClient } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/use-auth-user";

type DeliveryJobStatus =
  | "unassigned"
  | "assigned"
  | "accepted"
  | "at_pickup"
  | "collected"
  | "delivered"
  | "failed"
  | "cancelled";

type DriverAvailability = "offline" | "available" | "assigned" | "paused";

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
};

type DriverData = {
  driver: {
    id: string;
    display_name: string;
    availability: DriverAvailability;
    is_active: boolean;
  };
  jobs: DriverJob[];
};

type JobAction =
  | "accept"
  | "decline"
  | "at_pickup"
  | "collected"
  | "delivered"
  | "failed";

const FAILURE_REASONS = [
  "Customer unavailable",
  "Wrong address",
  "Could not access building",
  "Order damaged",
  "Other delivery issue",
] as const;

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

function useCountdown(expiresAt: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);
  if (!expiresAt) return null;
  const remainingMs = new Date(expiresAt).getTime() - now;
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

function JobStatus({ status }: { status: DeliveryJobStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone[status]}`}>
      {statusLabel[status]}
    </span>
  );
}

function DriverAccess({
  title,
  description,
  href = "/driver/sign-in?next=/driver",
}: {
  title: string;
  description: string;
  href?: string;
}) {
  return (
    <main className="grid min-h-dvh place-items-center px-5 text-center">
      <section className="max-w-md rounded-2xl border border-[#dbe4df] bg-white p-8 shadow-[0_24px_70px_-40px_rgba(25,42,35,0.45)]">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#e8f4ee] text-[#367762]">
          <PortalIcon name="package" className="h-5 w-5" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold text-[#19342b]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[#63726c]">{description}</p>
        <Link
          href={href}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#213d33] px-4 py-2.5 text-sm font-semibold text-white"
        >
          Sign in <PortalIcon name="arrow" className="h-4 w-4" />
        </Link>
      </section>
    </main>
  );
}

function DriverLoading() {
  return (
    <main className="grid min-h-dvh place-items-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#d2e2da] border-t-[#3f806b]" />
    </main>
  );
}

function AcceptCountdown({ expiresAt }: { expiresAt: string | null }) {
  const seconds = useCountdown(expiresAt);
  if (seconds === null) return null;
  const urgent = seconds <= 20;
  return (
    <p
      className={`rounded-lg px-3 py-2 text-sm font-semibold tabular-nums ${
        urgent ? "bg-rose-50 text-rose-700" : "bg-sky-50 text-sky-800"
      }`}
    >
      {seconds > 0 ? `Accept within ${seconds}s` : "Assignment expired — refreshing…"}
    </p>
  );
}

function DriverJobCard({
  job,
  updating,
  onAction,
}: {
  job: DriverJob;
  updating: boolean;
  onAction: (id: string, action: JobAction, note?: string) => void;
}) {
  const [failureOpen, setFailureOpen] = useState(false);
  const destination = [
    job.delivery_street,
    job.delivery_building,
    job.delivery_apartment,
    job.delivery_area,
    job.delivery_emirate,
  ]
    .filter(Boolean)
    .join(", ");
  const navigatePickup =
    job.status === "assigned" || job.status === "accepted" || job.status === "at_pickup";
  const mapsTarget =
    navigatePickup && job.store_lat != null && job.store_lng != null
      ? `${job.store_lat},${job.store_lng}`
      : navigatePickup
        ? job.store_address
        : destination;
  const mapsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsTarget)}`;
  const action: JobAction | null =
    job.status === "assigned"
      ? "accept"
      : job.status === "accepted"
        ? "at_pickup"
        : job.status === "at_pickup"
          ? "collected"
          : job.status === "collected"
            ? "delivered"
            : null;
  const actionLabel =
    job.status === "assigned"
      ? "Accept delivery"
      : job.status === "accepted"
        ? "I am at the store"
        : job.status === "at_pickup"
          ? "I collected the order"
          : "Mark delivered";

  return (
    <article className="overflow-hidden rounded-xl border border-[#dce5e0] bg-white shadow-[0_14px_30px_-28px_rgba(30,55,43,0.7)]">
      <div className="flex items-start justify-between gap-3 border-b border-[#e8efeb] px-4 py-3">
        <div>
          <p className="text-xs font-bold text-[#487767]">{job.order_number}</p>
          <p className="mt-1 text-sm font-semibold">{job.store_name}</p>
        </div>
        <JobStatus status={job.status} />
      </div>
      <div className="space-y-4 p-4">
        {job.status === "assigned" ? <AcceptCountdown expiresAt={job.assignment_expires_at} /> : null}
        <div className="flex flex-wrap gap-2 text-xs font-semibold text-[#5b6e65]">
          {job.item_count > 0 ? (
            <span className="rounded-full bg-[#edf6f1] px-2.5 py-1">
              {job.item_count} item{job.item_count === 1 ? "" : "s"}
            </span>
          ) : null}
          {job.bag_summary ? (
            <span className="rounded-full bg-[#edf6f1] px-2.5 py-1">{job.bag_summary}</span>
          ) : null}
          {job.delivery_eta_minutes ? (
            <span className="rounded-full bg-[#edf6f1] px-2.5 py-1">ETA {job.delivery_eta_minutes} min</span>
          ) : null}
          {job.delivery_emirate ? (
            <span className="rounded-full bg-[#edf6f1] px-2.5 py-1 capitalize">{job.delivery_emirate}</span>
          ) : null}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#708078]">Pickup</p>
          <p className="mt-1 text-sm leading-5 text-[#33473e]">{job.store_address}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#708078]">Drop-off</p>
          <p className="mt-1 text-sm leading-5 text-[#33473e]">{destination}</p>
          {job.delivery_notes ? (
            <p className="mt-2 rounded-lg bg-[#f5f8f6] px-3 py-2 text-xs leading-5 text-[#5c6c64]">
              {job.delivery_notes}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={mapsHref}
            target="_blank"
            rel="noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-[#cfdcd5] px-3 py-2.5 text-sm font-semibold text-[#3f6155]"
          >
            <PortalIcon name="location" className="h-4 w-4" />
            {navigatePickup ? "Navigate to store" : "Navigate to customer"}
          </a>
          {job.delivery_phone ? (
            <a
              href={`tel:${job.delivery_phone}`}
              className="grid h-11 w-11 place-items-center rounded-lg border border-[#cfdcd5] text-[#3f6155]"
              aria-label="Call customer"
            >
              <PortalIcon name="phone" className="h-4 w-4" />
            </a>
          ) : null}
        </div>
        {job.status === "assigned" ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={updating}
              onClick={() => onAction(job.id, "decline")}
              className="rounded-lg border border-[#ead4d0] px-3 py-2.5 text-sm font-semibold text-[#a24a40] disabled:opacity-50"
            >
              Decline
            </button>
            <button
              type="button"
              disabled={updating}
              onClick={() => onAction(job.id, "accept")}
              className="rounded-lg bg-[#213d33] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Accept
            </button>
          </div>
        ) : null}
        {action && job.status !== "assigned" ? (
          <button
            type="button"
            disabled={updating}
            onClick={() => onAction(job.id, action)}
            className="w-full rounded-lg bg-[#213d33] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {updating ? "Updating" : actionLabel}
          </button>
        ) : null}
        {job.status === "collected" ? (
          failureOpen ? (
            <div className="space-y-2 rounded-lg border border-[#ead4d0] bg-[#fff8f7] p-3">
              <p className="text-xs font-semibold text-[#9e5348]">Why couldn&apos;t you complete delivery?</p>
              {FAILURE_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  disabled={updating}
                  onClick={() => onAction(job.id, "failed", reason)}
                  className="block w-full rounded-md border border-[#ead4d0] bg-white px-3 py-2 text-left text-xs font-semibold text-[#9e5348] disabled:opacity-50"
                >
                  {reason}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setFailureOpen(false)}
                className="w-full text-xs font-semibold text-[#5b6e65]"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={updating}
              onClick={() => setFailureOpen(true)}
              className="w-full text-xs font-semibold text-[#9e5348] disabled:opacity-50"
            >
              Report delivery issue
            </button>
          )
        ) : null}
      </div>
    </article>
  );
}

export function DriverWorkspace() {
  const { auth, loading: authLoading } = useAuthUser();
  const [data, setData] = useState<DriverData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { data: response, error: rpcError } = await createClient().rpc("driver_delivery_workspace_data");
    if (rpcError) {
      setData(null);
      setError(rpcError.message);
    } else {
      setData(response as unknown as DriverData);
      setError(null);
    }
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    if (!auth) return;
    const requestLoad = () => void load();
    if (typeof queueMicrotask === "function") queueMicrotask(requestLoad);
    else window.setTimeout(requestLoad, 0);
  }, [auth, load]);

  useEffect(() => {
    if (!auth || !data?.driver.id) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`driver-jobs-${data.driver.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_jobs",
          filter: `driver_id=eq.${data.driver.id}`,
        },
        () => void load(true),
      )
      .subscribe();
    const poll = window.setInterval(() => void load(true), 15_000);
    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [auth, data?.driver.id, load]);

  const hasExpiredAssignment = useMemo(
    () =>
      data?.jobs.some(
        (job) =>
          job.status === "assigned" &&
          job.assignment_expires_at &&
          new Date(job.assignment_expires_at).getTime() <= Date.now(),
      ) ?? false,
    [data?.jobs],
  );

  useEffect(() => {
    if (!hasExpiredAssignment) return;
    const id = window.setTimeout(() => void load(true), 1200);
    return () => window.clearTimeout(id);
  }, [hasExpiredAssignment, load]);

  async function setAvailability(availability: DriverAvailability) {
    if (!data) return;
    setUpdating("availability");
    setError(null);
    let lat: number | null = null;
    let lng: number | null = null;
    if (availability === "available" && "geolocation" in navigator) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 7000,
            maximumAge: 60_000,
          }),
        );
        lat = position.coords.latitude;
        lng = position.coords.longitude;
      } catch {
        /* A rider can still make themselves available but ranks after located riders. */
      }
    }
    const { error: rpcError } = await createClient().rpc("set_delivery_driver_availability", {
      p_availability: availability,
      p_lat: lat,
      p_lng: lng,
    });
    if (rpcError) setError(rpcError.message);
    else await load(true);
    setUpdating(null);
  }

  async function jobAction(jobId: string, action: JobAction, note?: string) {
    setUpdating(jobId);
    setError(null);
    const supabase = createClient();
    let rpcError: { message: string } | null = null;
    if (action === "accept") {
      ({ error: rpcError } = await supabase.rpc("accept_delivery_job", { p_delivery_job_id: jobId }));
    } else if (action === "decline") {
      ({ error: rpcError } = await supabase.rpc("decline_delivery_job", {
        p_delivery_job_id: jobId,
        p_reason: "Rider unavailable",
      }));
    } else {
      ({ error: rpcError } = await supabase.rpc("advance_delivery_job", {
        p_delivery_job_id: jobId,
        p_status: action,
        p_note: action === "failed" ? note ?? "Delivery could not be completed." : null,
      }));
    }
    if (rpcError) setError(rpcError.message);
    else await load(true);
    setUpdating(null);
  }

  if (authLoading || (auth && loading)) return <DriverLoading />;
  if (!auth) {
    return (
      <DriverAccess
        title="Rider sign in"
        description="Sign in with the account invited by your delivery company."
        href="/driver/sign-in?next=/driver"
      />
    );
  }
  if (error && !data) {
    return <DriverAccess title="Rider access is restricted" description={error} />;
  }

  const driver = data!.driver;
  return (
    <div className="pb-10">
      <header className="sticky top-0 z-20 border-b border-[#dce5e0] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-4 px-4 py-3">
          <span className="flex items-center gap-3">
            <BrandMark className="h-9 w-9 object-contain" />
            <span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.15em] text-[#6b8077]">
                Morni rider
              </span>
              <span className="block text-lg font-semibold">
                Hello, {driver.display_name.split(" ")[0]}
              </span>
            </span>
          </span>
          <button
            type="button"
            onClick={() => void load()}
            className="grid h-10 w-10 place-items-center rounded-lg border border-[#d7e1dc] bg-white text-[#4d6c60]"
            aria-label="Refresh deliveries"
          >
            <PortalIcon name="refresh" className="h-4 w-4" />
          </button>
        </div>
      </header>
      <div className="mx-auto max-w-xl px-4 py-5">
        <section className="rounded-xl border border-[#dce5e0] bg-white p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6c7d75]">
                Availability
              </p>
              <p className="mt-1 text-lg font-semibold capitalize">{driver.availability}</p>
            </div>
            <div className="flex gap-2">
              {driver.availability !== "available" ? (
                <button
                  type="button"
                  onClick={() => void setAvailability("available")}
                  disabled={updating === "availability"}
                  className="rounded-lg bg-[#217057] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Go available
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void setAvailability("offline")}
                  disabled={updating === "availability" || data!.jobs.length > 0}
                  className="rounded-lg border border-[#d7e1dc] px-3 py-2 text-sm font-semibold text-[#48645b] disabled:opacity-50"
                >
                  Go offline
                </button>
              )}
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-[#718079]">
            Share your location when you go available so Morni can assign nearby pickups first.
          </p>
        </section>
        {error ? (
          <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        <section className="mt-5">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#4e8875]">
                Your delivery jobs
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-[-0.04em]">Today&apos;s route</h1>
            </div>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#5b6e65]">
              {data!.jobs.length} active
            </span>
          </div>
          <div className="mt-4 space-y-4">
            {data!.jobs.map((job) => (
              <DriverJobCard
                key={job.id}
                job={job}
                updating={updating === job.id}
                onAction={jobAction}
              />
            ))}
            {data!.jobs.length === 0 ? (
              <section className="rounded-xl border border-dashed border-[#cad8d1] bg-white p-8 text-center">
                <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#e8f4ee] text-[#3c7d68]">
                  <PortalIcon name="package" className="h-5 w-5" />
                </span>
                <h2 className="mt-4 font-semibold">No active delivery jobs</h2>
                <p className="mt-2 text-sm leading-6 text-[#6d7d75]">
                  Stay available and Morni will automatically send nearby pickup requests here.
                </p>
              </section>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
