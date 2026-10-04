import { createAdminClient } from "@/lib/supabase/admin";

const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const GEOCODE_URL = "https://geocode.googleapis.com/v4/geocode";

async function geocodeAddress(query: string, apiKey: string) {
  const geocode = new URL(`${GEOCODE_URL}/address/${encodeURIComponent(query)}`);
  const response = await fetch(geocode, {
    headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "results.formattedAddress,results.location", Accept: "application/json" },
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) return null;
  const data = await response.json() as { results?: Array<{ formattedAddress?: string; location?: { latitude?: number; longitude?: number } }> };
  const location = data.results?.[0]?.location;
  if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) return null;
  return { lat: location.latitude!, lng: location.longitude!, label: data.results?.[0]?.formattedAddress };
}

export type DeliveryDestination = {
  area: string;
  street: string;
  building?: string;
  apartment?: string;
  emirate: string;
  lat?: number;
  lng?: number;
};

export type DeliveryDistanceResult = {
  distanceMeters: number;
  destinationLat: number;
  destinationLng: number;
  confirmedLabel?: string;
};

export class DeliveryLocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeliveryLocationError";
  }
}

/** Resolves the active pickup point and customer address through Google Maps
 * and returns the driving distance. Coordinates are only accepted when the
 * customer explicitly confirms their location in checkout. */
export async function calculateDrivingDistance(
  storeId: string,
  destination: DeliveryDestination,
): Promise<DeliveryDistanceResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new DeliveryLocationError("Delivery distance is temporarily unavailable. Please try again later.");

  const admin = createAdminClient();
  const [{ data: store, error: storeError }, { data: pickup }] = await Promise.all([
    admin.from("stores").select("lat,lng,address,area").eq("id", storeId).maybeSingle(),
    admin.from("store_pickup_locations").select("lat,lng,address,area").eq("store_id", storeId).maybeSingle(),
  ]);
  if (storeError || !store) throw new DeliveryLocationError("We could not verify the boutique pickup location.");
  let rawOriginLat: number | null = pickup?.lat != null && pickup?.lng != null ? pickup.lat : store.lat;
  let rawOriginLng: number | null = pickup?.lat != null && pickup?.lng != null ? pickup.lng : store.lng;
  if (rawOriginLat == null || rawOriginLng == null) {
    const pickupAddress = [pickup?.address ?? store.address, pickup?.area ?? store.area, "Dubai, UAE"].filter(Boolean).join(", ");
    const geocodedPickup = await geocodeAddress(pickupAddress, apiKey);
    if (geocodedPickup) {
      rawOriginLat = geocodedPickup.lat;
      rawOriginLng = geocodedPickup.lng;
    }
  }
  const originLat = Number(rawOriginLat);
  const originLng = Number(rawOriginLng);
  if (rawOriginLat == null || rawOriginLng == null || !Number.isFinite(originLat) || !Number.isFinite(originLng)) {
    throw new DeliveryLocationError("This boutique has not set a pickup location yet. Please contact us to arrange delivery.");
  }

  let destinationLat = destination.lat;
  let destinationLng = destination.lng;
  let confirmedLabel: string | undefined;
  if (destinationLat === undefined || destinationLng === undefined) {
    const query = [destination.building, destination.apartment, destination.street, destination.area, destination.emirate, "UAE"]
      .filter(Boolean).join(", ");
    const result = await geocodeAddress(query, apiKey);
    if (!result) {
      throw new DeliveryLocationError("We couldn’t locate this address. Confirm your delivery location to continue.");
    }
    destinationLat = result.lat;
    destinationLng = result.lng;
    confirmedLabel = result.label;
  }

  if (!Number.isFinite(destinationLat) || !Number.isFinite(destinationLng) || destinationLat! < 22 || destinationLat! > 27 || destinationLng! < 51 || destinationLng! > 57) {
    throw new DeliveryLocationError("Confirm a delivery location in the UAE to calculate the road distance.");
  }

  const response = await fetch(ROUTES_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "routes.distanceMeters" },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: originLat, longitude: originLng } } },
      destination: { location: { latLng: { latitude: destinationLat, longitude: destinationLng } } },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      units: "METRIC",
    }),
    signal: AbortSignal.timeout(7000),
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) throw new DeliveryLocationError("We couldn’t calculate the driving distance. Confirm your delivery location and try again.");
  const routeData = await response.json() as { routes?: Array<{ distanceMeters?: number }> };
  const distanceMeters = routeData.routes?.[0]?.distanceMeters;
  if (!Number.isInteger(distanceMeters) || distanceMeters! < 0) {
    throw new DeliveryLocationError("We couldn’t calculate the driving distance. Confirm your delivery location and try again.");
  }
  return { distanceMeters: distanceMeters!, destinationLat: destinationLat!, destinationLng: destinationLng!, confirmedLabel };
}
