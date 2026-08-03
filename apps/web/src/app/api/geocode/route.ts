import { NextRequest, NextResponse } from "next/server";

const NOMINATIM = "https://nominatim.openstreetmap.org";
const UA = "MorniMarketplace/1.0 (store-location; https://morni-eosin.vercel.app)";

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    suburb?: string;
    neighbourhood?: string;
    city_district?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    road?: string;
    house_number?: string;
    building?: string;
  };
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

function normalize(hit: NominatimResult) {
  const a = hit.address ?? {};
  const area =
    a.suburb || a.neighbourhood || a.city_district || a.town || a.village || "";
  const streetParts = [a.house_number, a.road, a.building].filter(Boolean);
  return {
    lat: Number(hit.lat),
    lng: Number(hit.lon),
    label: hit.display_name,
    area,
    street: streetParts.join(" "),
    emirate: mapEmirate(a.state),
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q")?.trim();
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  try {
    if (lat && lng) {
      const url = new URL(`${NOMINATIM}/reverse`);
      url.searchParams.set("lat", lat);
      url.searchParams.set("lon", lng);
      url.searchParams.set("format", "json");
      url.searchParams.set("addressdetails", "1");

      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        next: { revalidate: 0 },
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: "Could not reverse-geocode location." },
          { status: 502 },
        );
      }
      const data = (await res.json()) as NominatimResult;
      return NextResponse.json({ results: [normalize(data)] });
    }

    if (!q) {
      return NextResponse.json(
        { error: "Provide q or lat/lng." },
        { status: 400 },
      );
    }

    const url = new URL(`${NOMINATIM}/search`);
    url.searchParams.set("q", q);
    url.searchParams.set("countrycodes", "ae");
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "6");

    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Could not search locations." },
        { status: 502 },
      );
    }
    const data = (await res.json()) as NominatimResult[];
    return NextResponse.json({ results: data.map(normalize) });
  } catch {
    return NextResponse.json(
      { error: "Location lookup failed." },
      { status: 500 },
    );
  }
}
