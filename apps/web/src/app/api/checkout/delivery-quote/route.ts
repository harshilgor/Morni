import { NextResponse } from "next/server";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { calculateDrivingDistance, DeliveryLocationError, type DeliveryDestination } from "@/lib/server/delivery-pricing";
import { deliveryFeeForDistanceMeters } from "@/lib/fees";

type QuoteBody = { productIds?: unknown; address?: DeliveryDestination };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = rateLimit(`delivery-quote:${user.id}:${clientIp(request)}`, 24, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const body = await request.json().catch(() => null) as QuoteBody | null;
  const productIds = Array.isArray(body?.productIds) ? [...new Set(body.productIds)] : [];
  const address = body?.address;
  if (productIds.length < 1 || productIds.length > 30 || productIds.some((id) => typeof id !== "string" || !UUID.test(id))) {
    return NextResponse.json({ error: "We could not verify the products in your bag." }, { status: 400 });
  }
  if (!address?.area?.trim() || !address.street?.trim() || address.emirate !== "dubai"
    || address.area.length > 120 || address.street.length > 240
    || (address.building?.length ?? 0) > 120 || (address.apartment?.length ?? 0) > 80) {
    return NextResponse.json({ error: "Add a Dubai delivery area and street to calculate delivery." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: products, error } = await admin.from("products").select("id,store_id").in("id", productIds as string[]);
  if (error || !products || products.length !== productIds.length) {
    return NextResponse.json({ error: "A product in your bag is no longer available." }, { status: 400 });
  }
  const storeIds = new Set(products.map((product) => product.store_id));
  if (storeIds.size !== 1) return NextResponse.json({ error: "Checkout is limited to one boutique per order." }, { status: 400 });

  try {
    const distance = await calculateDrivingDistance([...storeIds][0], address);
    const deliveryFeeAed = deliveryFeeForDistanceMeters(distance.distanceMeters);
    return NextResponse.json({
      distanceMeters: distance.distanceMeters,
      distanceKm: Number((distance.distanceMeters / 1000).toFixed(3)),
      deliveryFeeAed,
      destination: { lat: distance.destinationLat, lng: distance.destinationLng, label: distance.confirmedLabel ?? null },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof DeliveryLocationError
      ? error.message
      : "We couldn’t calculate the driving distance. Confirm your delivery location to continue.";
    return NextResponse.json({ error: message, requiresLocationConfirmation: true }, { status: 422 });
  }
}
