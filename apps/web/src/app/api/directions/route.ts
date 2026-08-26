import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const OSRM = "https://router.project-osrm.org/route/v1/driving";

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

  const url = `${OSRM}/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&steps=true&annotations=false`;
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(7000), next: { revalidate: 0 } });
    if (!response.ok) return NextResponse.json({ error: "Directions are temporarily unavailable." }, { status: 502 });
    const payload = await response.json() as {
      code?: string;
      routes?: Array<{
        distance: number;
        duration: number;
        geometry?: { coordinates?: Array<[number, number]> };
        legs?: Array<{ steps?: Array<{ distance: number; duration: number; name?: string; maneuver?: { type?: string; modifier?: string } }> }>;
      }>;
    };
    const route = payload.routes?.[0];
    if (payload.code !== "Ok" || !route) return NextResponse.json({ error: "No drivable route was found." }, { status: 404 });
    const steps = (route.legs ?? []).flatMap((leg) => leg.steps ?? []).filter((step) => step.distance > 5).slice(0, 8).map((step) => ({
      name: step.name || "Unnamed road",
      distanceMeters: Math.round(step.distance),
      durationSeconds: Math.round(step.duration),
      instruction: [step.maneuver?.type, step.maneuver?.modifier].filter(Boolean).join(" ") || "Continue",
    }));
    return NextResponse.json({ distanceMeters: Math.round(route.distance), durationSeconds: Math.round(route.duration), geometry: route.geometry?.coordinates ?? [], steps }, { headers: { "Cache-Control": "private, max-age=30" } });
  } catch {
    return NextResponse.json({ error: "Directions lookup failed." }, { status: 500 });
  }
}
