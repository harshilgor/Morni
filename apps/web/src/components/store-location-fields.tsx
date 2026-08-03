"use client";

import { useEffect, useId, useState } from "react";
import { EMIRATES } from "@/lib/format";
import { UAE_AREAS } from "@/lib/location";
import type { UaeEmirate } from "@/lib/types";

export type StoreLocationValue = {
  emirate: UaeEmirate;
  area: string;
  address: string;
  lat: number | null;
  lng: number | null;
};

type GeocodeHit = {
  lat: number;
  lng: number;
  label: string;
  area: string;
  street: string;
  emirate: UaeEmirate | null;
};

export function StoreLocationFields({
  value,
  onChange,
}: {
  value: StoreLocationValue;
  onChange: (next: StoreLocationValue) => void;
}) {
  const listId = useId();
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [error, setError] = useState<string | null>(null);

  const suggestions = UAE_AREAS[value.emirate] ?? [];

  useEffect(() => {
    setHits([]);
  }, [value.emirate]);

  function patch(partial: Partial<StoreLocationValue>) {
    onChange({ ...value, ...partial });
  }

  async function searchAddress() {
    const query = [value.address, value.area, EMIRATES.find((e) => e.value === value.emirate)?.label, "UAE"]
      .filter(Boolean)
      .join(", ");
    if (!value.address.trim() && !value.area.trim()) {
      setError("Enter an area or street address first.");
      return;
    }
    setSearching(true);
    setError(null);
    setHits([]);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Search failed.");
        return;
      }
      const results = (data.results ?? []) as GeocodeHit[];
      setHits(results);
      if (results.length === 0) {
        setError("No matches found. Try a more specific street or landmark.");
      } else if (results.length === 1) {
        applyHit(results[0]);
      }
    } catch {
      setError("Could not reach location search.");
    } finally {
      setSearching(false);
    }
  }

  function applyHit(hit: GeocodeHit) {
    patch({
      lat: hit.lat,
      lng: hit.lng,
      area: value.area.trim() || hit.area || value.area,
      address: value.address.trim() || hit.street || value.address,
      emirate: hit.emirate ?? value.emirate,
    });
    setHits([]);
    setError(null);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `/api/geocode?lat=${latitude}&lng=${longitude}`,
          );
          const data = await res.json();
          if (!res.ok || !data.results?.[0]) {
            patch({ lat: latitude, lng: longitude });
            setError("Pinned your coordinates. Fill in area and address manually.");
            return;
          }
          const hit = data.results[0] as GeocodeHit;
          patch({
            lat: hit.lat,
            lng: hit.lng,
            area: hit.area || value.area,
            address: hit.street || value.address,
            emirate: hit.emirate ?? value.emirate,
          });
        } catch {
          setError("Could not reverse-geocode your position.");
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setError("Location permission denied.");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  const mapSrc =
    value.lat != null && value.lng != null
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${value.lng - 0.012}%2C${value.lat - 0.008}%2C${value.lng + 0.012}%2C${value.lat + 0.008}&layer=mapnik&marker=${value.lat}%2C${value.lng}`
      : null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-background/60 px-3 py-2.5 text-xs text-muted">
        Enter your exact store location — any neighborhood and full street address in the UAE.
        Pin it on the map so shoppers know where you’re based.
      </div>

      <label className="block space-y-1.5 text-sm">
        <span className="text-muted">Emirate</span>
        <select
          className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
          value={value.emirate}
          onChange={(e) =>
            patch({ emirate: e.target.value as UaeEmirate, lat: null, lng: null })
          }
        >
          {EMIRATES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1.5 text-sm">
        <span className="text-muted">Area / neighborhood</span>
        <input
          list={listId}
          className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
          value={value.area}
          onChange={(e) => patch({ area: e.target.value, lat: null, lng: null })}
          placeholder="e.g. Al Quoz Industrial Area 3, Dubai Hills, Khalifa City A"
          required
        />
        <datalist id={listId}>
          {suggestions.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
        <span className="block text-xs text-muted">
          Type any area — suggestions appear for common neighborhoods.
        </span>
      </label>

      <label className="block space-y-1.5 text-sm">
        <span className="text-muted">Exact street address</span>
        <textarea
          className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
          rows={2}
          value={value.address}
          onChange={(e) =>
            patch({ address: e.target.value, lat: null, lng: null })
          }
          placeholder="Building name / number, street, unit or shop number"
          required
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={searchAddress}
          disabled={searching}
          className="rounded-full bg-ink px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {searching ? "Finding…" : "Find on map"}
        </button>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink disabled:opacity-50"
        >
          {locating ? "Locating…" : "Use my current location"}
        </button>
        {value.lat != null && value.lng != null ? (
          <button
            type="button"
            onClick={() => patch({ lat: null, lng: null })}
            className="rounded-full border border-line px-4 py-2 text-sm text-muted"
          >
            Clear pin
          </button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-accent-deep">{error}</p> : null}

      {hits.length > 1 ? (
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-line bg-background p-2">
          {hits.map((hit) => (
            <button
              key={`${hit.lat}-${hit.lng}-${hit.label}`}
              type="button"
              onClick={() => applyHit(hit)}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-surface"
            >
              {hit.label}
            </button>
          ))}
        </div>
      ) : null}

      {mapSrc ? (
        <div className="overflow-hidden rounded-xl border border-line">
          <iframe
            title="Store location map"
            src={mapSrc}
            className="h-52 w-full border-0"
            loading="lazy"
          />
          <p className="border-t border-line bg-background px-3 py-2 text-xs text-muted">
            Pinned at {value.lat!.toFixed(5)}, {value.lng!.toFixed(5)}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted">
          No map pin yet — use “Find on map” or “Use my current location” after entering your address.
        </p>
      )}
    </div>
  );
}
