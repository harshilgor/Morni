import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const GOOGLE_ROUTES = "https://routes.googleapis.com/directions/v2:computeRoutes";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = rateLimit(`directions:${user.id}:${clientIp(request)}`, 30, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const fromLat = Number(request.nextUrl.searchParams.get("fromLat"));
  const fromLng = Number(request.nextUrl.searchParams.get("fromLng"));
  const toLat = Number(request.nextUrl.searchParams.get("toLat"));
  const toLng = Number(request.nextUrl.searchParams.get("toLng"));
  const coordinates = [fromLat, fromLng, toLat, toLng];
  if (coordinates.some((value) => !Number.isFinite(value)) || fromLat < -90 || fromLat > 90 || toLat < -90 || toLat > 90 || fromLng < -180 || fromLng > 180 || toLng < -180 || toLng > 180) {
    return NextResponse.json({ error: "Provide valid start and destination coordinates." }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Google Maps is not configured." }, { status: 503 });

  try {
    const response = await fetch(GOOGLE_ROUTES, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.geoJsonLinestring,routes.legs.steps.distanceMeters,routes.legs.steps.navigationInstruction.instructions",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: fromLat, longitude: fromLng } } },
        destination: { location: { latLng: { latitude: toLat, longitude: toLng } } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        polylineEncoding: "GEO_JSON_LINESTRING",
        languageCode: "en",
        units: "METRIC",
      }),
      signal: AbortSignal.timeout(7000),
      next: { revalidate: 0 },
    });
    if (!response.ok) return NextResponse.json({ error: "Directions are temporarily unavailable." }, { status: 502 });
    const payload = await response.json() as {
      routes?: Array<{
        distanceMeters?: number;
        duration?: string;
        polyline?: { geoJsonLinestring?: { coordinates?: Array<[number, number]> } };
        legs?: Array<{ steps?: Array<{ distanceMeters?: number; navigationInstruction?: { instructions?: string } }> }>;
      }>;
    };
    const route = payload.routes?.[0];
    if (!route) return NextResponse.json({ error: "No drivable route was found." }, { status: 404 });
    const durationSeconds = Number.parseInt(route.duration?.replace(/s$/, "") ?? "0", 10);
    const steps = (route.legs ?? []).flatMap((leg) => leg.steps ?? []).filter((step) => (step.distanceMeters ?? 0) > 5).slice(0, 8).map((step) => ({
      name: "Google Maps route",
      distanceMeters: Math.round(step.distanceMeters ?? 0),
      durationSeconds: 0,
      instruction: step.navigationInstruction?.instructions || "Continue",
    }));
    return NextResponse.json({ distanceMeters: Math.round(route.distanceMeters ?? 0), durationSeconds, geometry: route.polyline?.geoJsonLinestring?.coordinates ?? [], steps }, { headers: { "Cache-Control": "private, max-age=30" } });
  } catch {
    return NextResponse.json({ error: "Directions lookup failed." }, { status: 500 });
  }
}
