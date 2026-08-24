"use client";

import { useEffect, useMemo, useState } from "react";
import { PortalIcon } from "@/components/portal-icons";

type MapJob = {
  id: string;
  status: string;
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
};

type Point = {
  id: "driver" | "pickup" | "dropoff";
  lat: number;
  lng: number;
  label: string;
  tone: string;
};

type Bounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

function destinationFor(job: MapJob) {
  return [job.delivery_street, job.delivery_building, job.delivery_apartment, job.delivery_area, job.delivery_emirate, "UAE"]
    .filter(Boolean)
    .join(", ");
}

function boundsFor(points: Point[]): Bounds {
  const latitudes = points.map((point) => point.lat);
  const longitudes = points.map((point) => point.lng);
  const latSpan = Math.max(Math.max(...latitudes) - Math.min(...latitudes), 0.006);
  const lngSpan = Math.max(Math.max(...longitudes) - Math.min(...longitudes), 0.006);
  const latPadding = latSpan * 0.35;
  const lngPadding = lngSpan * 0.35;
  return {
    north: Math.min(90, Math.max(...latitudes) + latPadding),
    south: Math.max(-90, Math.min(...latitudes) - latPadding),
    east: Math.min(180, Math.max(...longitudes) + lngPadding),
    west: Math.max(-180, Math.min(...longitudes) - lngPadding),
  };
}

function markerStyle(point: Point, bounds: Bounds) {
  const x = ((point.lng - bounds.west) / (bounds.east - bounds.west)) * 100;
  const y = ((bounds.north - point.lat) / (bounds.north - bounds.south)) * 100;
  return {
    left: `${Math.min(94, Math.max(6, x))}%`,
    top: `${Math.min(90, Math.max(10, y))}%`,
  };
}

function relativeLocationTime(value: string | null) {
  if (!value) return "Location not shared yet";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes === 0) return "Updated just now";
  return `Updated ${minutes}m ago`;
}

export function DriverMap({
  job,
  driverLat,
  driverLng,
  locationUpdatedAt,
  online,
  updating,
  onRefreshLocation,
}: {
  job: MapJob | null;
  driverLat: number | null;
  driverLng: number | null;
  locationUpdatedAt: string | null;
  online: boolean;
  updating: boolean;
  onRefreshLocation: () => void;
}) {
  const [dropoff, setDropoff] = useState<{ lat: number; lng: number } | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  const destination = useMemo(() => (job ? destinationFor(job) : ""), [job]);

  useEffect(() => {
    if (!job || !destination) {
      setDropoff(null);
      return;
    }

    let active = true;
    setGeocoding(true);
    void fetch(`/api/geocode?q=${encodeURIComponent(destination)}`)
      .then(async (response) => (response.ok ? (await response.json()) as { results?: Array<{ lat: number; lng: number }> } : null))
      .then((payload) => {
        if (!active) return;
        const result = payload?.results?.[0];
        setDropoff(result && Number.isFinite(result.lat) && Number.isFinite(result.lng) ? { lat: result.lat, lng: result.lng } : null);
      })
      .catch(() => {
        if (active) setDropoff(null);
      })
      .finally(() => {
        if (active) setGeocoding(false);
      });

    return () => {
      active = false;
    };
  }, [destination, job]);

  const points = useMemo<Point[]>(() => {
    const next: Point[] = [];
    if (driverLat != null && driverLng != null) next.push({ id: "driver", lat: driverLat, lng: driverLng, label: "You", tone: "bg-[#213d33]" });
    if (job?.store_lat != null && job.store_lng != null) next.push({ id: "pickup", lat: job.store_lat, lng: job.store_lng, label: "Pickup", tone: "bg-[#2f6f5d]" });
    if (dropoff) next.push({ id: "dropoff", lat: dropoff.lat, lng: dropoff.lng, label: "Drop-off", tone: "bg-[#b35b45]" });
    return next;
  }, [driverLat, driverLng, dropoff, job]);

  const bounds = useMemo(() => (points.length ? boundsFor(points) : null), [points]);
  const mapUrl = useMemo(() => {
    if (!bounds || !points.length) return null;
    const marker = points.find((point) => point.id === "dropoff") ?? points.find((point) => point.id === "pickup") ?? points[0];
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bounds.west}%2C${bounds.south}%2C${bounds.east}%2C${bounds.north}&layer=mapnik&marker=${marker.lat}%2C${marker.lng}`;
  }, [bounds, points]);

  return <section className="overflow-hidden rounded-2xl border border-[#dce5e0] bg-white shadow-[0_14px_30px_-28px_rgba(30,55,43,0.7)]">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e8efeb] px-4 py-4 sm:px-5">
      <div>
        <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#e8f4ee] text-[#2f6f5d]"><PortalIcon name="location" className="h-4 w-4" /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#4e8875]">Live route</p><h2 className="mt-0.5 text-lg font-semibold tracking-[-0.03em] text-[#19342b]">{job ? job.order_number : "Your location"}</h2></div></div>
        <p className="mt-2 text-xs text-[#718079]">{job ? `${job.status === "collected" ? "Head to the customer" : "Next stop: " + job.store_name}` : "Your map will appear when you have an active delivery."}</p>
      </div>
      <button type="button" onClick={onRefreshLocation} disabled={!online || updating} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#cfdcd5] px-3 py-2 text-xs font-semibold text-[#3f6155] transition hover:bg-[#f5f8f6] disabled:opacity-50"><PortalIcon name="refresh" className={`h-3.5 w-3.5 ${updating ? "animate-spin" : ""}`} />{updating ? "Updating…" : "Update location"}</button>
    </div>
    <div className="relative h-[18rem] overflow-hidden bg-[#e7eee9] sm:h-[22rem]">
      {mapUrl ? <iframe title="Driver route map" src={mapUrl} className="h-full w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /> : <div className="grid h-full place-items-center px-8 text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-[#4e8875] shadow-sm"><PortalIcon name="location" className="h-5 w-5" /></span><p className="mt-3 text-sm font-semibold text-[#33473e]">Waiting for a location pin</p><p className="mt-1 max-w-xs text-xs leading-5 text-[#718079]">Allow location access and tap “Update location” to place yourself on the map.</p></div></div>}
      {bounds ? <div className="pointer-events-none absolute inset-0">{points.map((point) => <span key={point.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={markerStyle(point, bounds)}><span className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold text-white shadow-lg ${point.tone}`}><span className="h-1.5 w-1.5 rounded-full bg-white" />{point.label}</span></span>)}</div> : null}
      <div className="absolute bottom-2 left-2 rounded-md bg-white/90 px-2 py-1 text-[10px] text-[#61756b] shadow-sm backdrop-blur"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="hover:underline">© OpenStreetMap contributors</a></div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5"><div className="flex flex-wrap gap-2 text-[11px] font-semibold text-[#5b6e65]"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#213d33]" />You</span>{job ? <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#2f6f5d]" />Pickup</span> : null}{job && dropoff ? <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#b35b45]" />Drop-off</span> : null}</div><span className="text-[11px] text-[#7b8982]">{geocoding ? "Finding drop-off pin…" : relativeLocationTime(locationUpdatedAt)}</span></div>
  </section>;
}
