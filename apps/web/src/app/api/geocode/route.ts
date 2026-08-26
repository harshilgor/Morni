import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const GOOGLE_GEOCODE = "https://geocode.googleapis.com/v4/geocode";
const LOOKUP_HEADERS = {
  "Cache-Control": "private, max-age=60",
};

function googleConfigurationError() {
  return NextResponse.json(
    { error: "Google Geocoding is unavailable. Enable the Geocoding API and billing for this Google Cloud project, then check the key restrictions." },
    { status: 503, headers: LOOKUP_HEADERS },
  );
}

type GoogleGeocodeResult = {
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: Array<{ longText?: string; types?: string[] }>;
};

function mapEmirate(state?: string): string | null {
  if (!state) return null;
  const s = state.toLowerCase();
  if (s.includes("dubai")) return "dubai";
  if (s.includes("abu dhabi") || s.includes("abū")) return "abu_dhabi";
  if (s.includes("sharjah")) return "sharjah";
  if (s.includes("ajman")) return "ajman";
  if (s.includes("umm al") || s.includes("uaq")) return "uaq";
  if (s.includes("ras al") || s.includes("khaimah")) return "rak";
  if (s.includes("fujairah")) return "fujairah";
  return null;
}

function component(hit: GoogleGeocodeResult, type: string) {
  return hit.addressComponents?.find((item) => item.types?.includes(type))?.longText ?? "";
}

function normalize(hit: GoogleGeocodeResult) {
  const area = component(hit, "sublocality_level_1") || component(hit, "locality") || component(hit, "administrative_area_level_2");
  const streetParts = [component(hit, "street_number"), component(hit, "route")].filter(Boolean);
  return {
    lat: Number(hit.location?.latitude),
    lng: Number(hit.location?.longitude),
    label: hit.formattedAddress ?? "",
    area,
    street: streetParts.join(" "),
    emirate: mapEmirate(component(hit, "administrative_area_level_1")),
  };
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`geocode:${user.id}:${clientIp(request)}`, 40, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q")?.trim().replace(/\s+/g, " ");
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const hasCoordinates = lat !== null || lng !== null;
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Google Maps is not configured." }, { status: 503, headers: LOOKUP_HEADERS });

  try {
    if (hasCoordinates) {
      const latitude = Number(lat);
      const longitude = Number(lng);
      if (
        !lat ||
        !lng ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        return NextResponse.json(
          { error: "Provide valid latitude and longitude." },
          { status: 400, headers: LOOKUP_HEADERS },
        );
      }
      const url = new URL(`${GOOGLE_GEOCODE}/location/${latitude},${longitude}`);

      const res = await fetch(url, {
        headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "results.formattedAddress,results.location,results.addressComponents", Accept: "application/json" },
        next: { revalidate: 0 },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) return googleConfigurationError();
        return NextResponse.json(
          { error: "Could not reverse-geocode location." },
          { status: 502, headers: LOOKUP_HEADERS },
        );
      }
      const data = (await res.json()) as { results?: GoogleGeocodeResult[] };
      if (!data.results?.[0]) return NextResponse.json({ error: "Could not reverse-geocode location." }, { status: 502, headers: LOOKUP_HEADERS });
      return NextResponse.json({ results: [normalize(data.results[0])] }, { headers: LOOKUP_HEADERS });
    }

    if (!q || q.length < 2 || q.length > 160) {
      return NextResponse.json(
        { error: "Provide a location search between 2 and 160 characters." },
        { status: 400, headers: LOOKUP_HEADERS },
      );
    }

    const url = new URL(`${GOOGLE_GEOCODE}/address/${encodeURIComponent(q)}`);

    const res = await fetch(url, {
      headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "results.formattedAddress,results.location,results.addressComponents", Accept: "application/json" },
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) return googleConfigurationError();
      return NextResponse.json(
        { error: "Could not search locations." },
        { status: 502, headers: LOOKUP_HEADERS },
      );
    }
    const data = (await res.json()) as { results?: GoogleGeocodeResult[] };
    return NextResponse.json({ results: (data.results ?? []).slice(0, 6).map(normalize) }, { headers: LOOKUP_HEADERS });
  } catch {
    return NextResponse.json(
      { error: "Location lookup failed." },
      { status: 500, headers: LOOKUP_HEADERS },
    );
  }
}
