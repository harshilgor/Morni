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

type Point = { id: "driver" | "pickup" | "dropoff"; lat: number; lng: number; label: string; tone: string };
type Bounds = { north: number; south: number; east: number; west: number };
type Route = { distanceMeters: number; durationSeconds: number; geometry: Array<[number, number]>; steps: Array<{ name: string; distanceMeters: number; instruction: string }> };

function destinationFor(job: MapJob) {
  return [job.delivery_street, job.delivery_building, job.delivery_apartment, job.delivery_area, job.delivery_emirate, "UAE"].filter(Boolean).join(", ");
}

function boundsFor(points: Point[]): Bounds {
  const latitudes = points.map((point) => point.lat);
  const longitudes = points.map((point) => point.lng);
  const latSpan = Math.max(Math.max(...latitudes) - Math.min(...latitudes), 0.006);
  const lngSpan = Math.max(Math.max(...longitudes) - Math.min(...longitudes), 0.006);
  return { north: Math.min(90, Math.max(...latitudes) + latSpan * 0.35), south: Math.max(-90, Math.min(...latitudes) - latSpan * 0.35), east: Math.min(180, Math.max(...longitudes) + lngSpan * 0.35), west: Math.max(-180, Math.min(...longitudes) - lngSpan * 0.35) };
}

function markerStyle(point: { lat: number; lng: number }, bounds: Bounds) {
  const x = ((point.lng - bounds.west) / (bounds.east - bounds.west)) * 100;
  const y = ((bounds.north - point.lat) / (bounds.north - bounds.south)) * 100;
  return { left: `${Math.min(94, Math.max(6, x))}%`, top: `${Math.min(90, Math.max(10, y))}%` };
}

function relativeLocationTime(value: string | null) {
  if (!value) return "Location not shared yet";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  return minutes === 0 ? "Updated just now" : `Updated ${minutes}m ago`;
}

function distanceLabel(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`;
}

function durationLabel(seconds: number) {
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

export function DriverMap({ job, driverLat, driverLng, locationUpdatedAt, online, updating, onRefreshLocation }: { job: MapJob | null; driverLat: number | null; driverLng: number | null; locationUpdatedAt: string | null; online: boolean; updating: boolean; onRefreshLocation: () => void }) {
  const [dropoff, setDropoff] = useState<{ lat: number; lng: number } | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [route, setRoute] = useState<Route | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const destination = useMemo(() => (job ? destinationFor(job) : ""), [job]);
  const goingToDropoff = job?.status === "collected";

  useEffect(() => {
    if (!job || !destination) { setDropoff(null); return; }
    let active = true;
    setGeocoding(true);
    void fetch(`/api/geocode?q=${encodeURIComponent(destination)}`)
      .then(async (response) => response.ok ? await response.json() as { results?: Array<{ lat: number; lng: number }> } : null)
      .then((payload) => { if (!active) return; const result = payload?.results?.[0]; setDropoff(result && Number.isFinite(result.lat) && Number.isFinite(result.lng) ? { lat: result.lat, lng: result.lng } : null); })
      .catch(() => { if (active) setDropoff(null); })
      .finally(() => { if (active) setGeocoding(false); });
    return () => { active = false; };
  }, [destination, job]);

  const points = useMemo<Point[]>(() => {
    const next: Point[] = [];
    if (driverLat != null && driverLng != null) next.push({ id: "driver", lat: driverLat, lng: driverLng, label: "You", tone: "bg-[#155C4B]" });
    if (job?.store_lat != null && job.store_lng != null) next.push({ id: "pickup", lat: job.store_lat, lng: job.store_lng, label: "Pickup", tone: "bg-[#F97316]" });
    if (dropoff) next.push({ id: "dropoff", lat: dropoff.lat, lng: dropoff.lng, label: "Drop-off", tone: "bg-[#2B6CB0]" });
    return next;
  }, [driverLat, driverLng, dropoff, job]);
  const routeFrom = driverLat != null && driverLng != null ? { lat: driverLat, lng: driverLng } : null;
  const routeTo = goingToDropoff && dropoff ? dropoff : job?.store_lat != null && job.store_lng != null ? { lat: job.store_lat, lng: job.store_lng } : null;

  useEffect(() => {
    if (!online || !routeFrom || !routeTo || !job) { setRoute(null); setRouteError(null); return; }
    const controller = new AbortController();
    setRouteLoading(true); setRouteError(null);
    const query = new URLSearchParams({ fromLat: String(routeFrom.lat), fromLng: String(routeFrom.lng), toLat: String(routeTo.lat), toLng: String(routeTo.lng) });
    void fetch(`/api/directions?${query.toString()}`, { signal: controller.signal })
      .then(async (response) => { const payload = await response.json() as Route & { error?: string }; if (!response.ok) throw new Error(payload.error ?? "Directions unavailable"); return payload; })
      .then((payload) => setRoute(payload))
      .catch((error: unknown) => { if ((error as { name?: string })?.name !== "AbortError") { setRoute(null); setRouteError("Road directions are unavailable right now."); } })
      .finally(() => { if (!controller.signal.aborted) setRouteLoading(false); });
    return () => controller.abort();
  }, [job, online, routeFrom?.lat, routeFrom?.lng, routeTo?.lat, routeTo?.lng]);

  const bounds = useMemo(() => points.length ? boundsFor(points) : null, [points]);
  const mapUrl = useMemo(() => {
    if (!bounds || !points.length) return null;
    const marker = points.find((point) => point.id === (goingToDropoff ? "dropoff" : "pickup")) ?? points[0];
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bounds.west}%2C${bounds.south}%2C${bounds.east}%2C${bounds.north}&layer=mapnik&marker=${marker.lat}%2C${marker.lng}`;
  }, [bounds, goingToDropoff, points]);
  const mapsTarget = goingToDropoff && dropoff ? `${dropoff.lat},${dropoff.lng}` : job?.store_lat != null && job.store_lng != null ? `${job.store_lat},${job.store_lng}` : job?.store_address ?? destination;
  const mapsHref = `https://www.google.com/maps/dir/?api=1${driverLat != null && driverLng != null ? `&origin=${driverLat},${driverLng}` : ""}&destination=${encodeURIComponent(mapsTarget)}`;
  const routeLine = route?.geometry.map(([lng, lat]) => markerStyle({ lat, lng }, bounds ?? { north: 1, south: 0, east: 1, west: 0 })).map((style) => `${parseFloat(style.left)} ${parseFloat(style.top)}`).join(",");

  return <section className="overflow-hidden rounded-[1.5rem] border border-[#dce5e0] bg-white shadow-[0_14px_30px_-28px_rgba(30,55,43,0.7)]">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e8efeb] px-4 py-4 sm:px-5">
      <div><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#e8f4ee] text-[#2f6f5d]"><PortalIcon name="location" className="h-4 w-4" /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#4e8875]">Live navigation</p><h2 className="mt-0.5 text-lg font-semibold tracking-[-0.03em] text-[#19342b]">{job ? job.order_number : "Your location"}</h2></div></div><p className="mt-2 text-xs text-[#718079]">{job ? goingToDropoff ? "Follow the route to the customer" : `Next stop: ${job.store_name}` : "Your map will appear when you have an active delivery."}</p></div>
      <div className="flex gap-2"><a href={mapsHref} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#155C4B] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#0F4639]"><PortalIcon name="location" className="h-3.5 w-3.5" />Open navigation</a><button type="button" onClick={onRefreshLocation} disabled={!online || updating} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#cfdcd5] px-3 py-2 text-xs font-semibold text-[#3f6155] transition hover:bg-[#f5f8f6] disabled:opacity-50"><PortalIcon name="refresh" className={updating ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />{updating ? "Updating…" : "Refresh"}</button></div>
    </div>
    <div className="relative h-[18rem] overflow-hidden bg-[#FFF4D6] sm:h-[23rem]">
      {mapUrl ? <iframe title="Driver road map" src={mapUrl} className="h-full w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /> : <div className="grid h-full place-items-center px-8 text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-[#4e8875] shadow-sm"><PortalIcon name="location" className="h-5 w-5" /></span><p className="mt-3 text-sm font-semibold text-[#33473e]">Waiting for a location pin</p><p className="mt-1 max-w-xs text-xs leading-5 text-[#718079]">Allow location access and tap “Refresh” to place yourself on the map.</p></div></div>}
      {bounds && routeLine ? <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points={routeLine} fill="none" stroke="white" strokeWidth="2.7" vectorEffect="non-scaling-stroke" opacity="0.9" /><polyline points={routeLine} fill="none" stroke={goingToDropoff ? "#2B6CB0" : "#F97316"} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
      {bounds ? <div className="pointer-events-none absolute inset-0">{points.map((point) => <span key={point.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={markerStyle(point, bounds)}><span className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold text-white shadow-lg ${point.tone}`}><span className="h-1.5 w-1.5 rounded-full bg-white" />{point.label}</span></span>)}</div> : null}
      {routeLoading ? <span className="absolute right-2 top-2 rounded-lg bg-white/90 px-2.5 py-1.5 text-[10px] font-bold text-[#376f5c] shadow-sm">Finding best road route…</span> : null}
      <div className="absolute bottom-2 left-2 rounded-md bg-white/90 px-2 py-1 text-[10px] text-[#61756b] shadow-sm backdrop-blur"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="hover:underline">© OpenStreetMap contributors</a></div>
    </div>
    <div className="border-t border-[#e8efeb] px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-2 text-[11px] font-semibold text-[#4E6D61]"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#155C4B]" />You</span>{job ? <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#F97316]" />Pickup</span> : null}{job && dropoff ? <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#2B6CB0]" />Drop-off</span> : null}</div><span className="text-[11px] text-[#6D7D75]">{geocoding ? "Finding customer pin…" : relativeLocationTime(locationUpdatedAt)}</span></div>
      {route ? <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#f1f8f4] px-3 py-2.5 text-xs font-semibold text-[#245448]"><PortalIcon name="location" className="h-4 w-4" /><span>{distanceLabel(route.distanceMeters)} · about {durationLabel(route.durationSeconds)} by road</span></div> : routeError ? <p className="mt-3 text-xs text-[#8a5a42]">{routeError} Use “Open navigation” for turn-by-turn directions.</p> : null}
      {route?.steps.length ? <ol className="mt-3 grid gap-2 sm:grid-cols-2">{route.steps.slice(0, 4).map((step, index) => <li key={`${step.name}-${index}`} className="flex min-w-0 items-center gap-2 rounded-lg bg-[#fafcfb] px-2.5 py-2 text-[11px] text-[#52665d]"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#dcece4] text-[10px] font-bold text-[#376f5c]">{index + 1}</span><span className="min-w-0 truncate"><strong className="font-semibold text-[#33473e]">{step.instruction}</strong> · {step.name}</span><span className="ml-auto shrink-0 text-[#7b8882]">{distanceLabel(step.distanceMeters)}</span></li>)}</ol> : null}
    </div>
  </section>;
}
