import { NextResponse } from "next/server";
import { isAfsPaymentsEnabled } from "@/lib/afs/client";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { UaeEmirate } from "@/lib/types";
import {
  customizationConfigFromProduct,
  sanitizeCustomizationValues,
  validateCustomizationValues,
  type ProductCustomizationValues,
} from "@/lib/product-customization";

type CheckoutItem = {
  productId?: string;
  variantId?: string | null;
  quantity?: number;
  size?: string | null;
  customization?: ProductCustomizationValues | null;
};

type CheckoutAddress = {
  label?: string;
  phone?: string;
  emirate?: string;
  area?: string;
  street?: string;
  building?: string;
  apartment?: string;
  notes?: string;
};

type CheckoutBody = {
  items?: CheckoutItem[];
  address?: CheckoutAddress;
  saveAddress?: boolean;
  makeDefault?: boolean;
  paymentMethod?: "card";
};

type VerifiedProduct = {
  id: string;
  store_id: string;
  customization_enabled?: boolean | null;
  customization_instructions?: string | null;
  customization_fields?: unknown;
};

// Postgres accepts any 8-4-4-4-12 hex uuid; seed ids like
// c1000000-0000-0000-0000-000000000001 are valid but not RFC version/variant.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_PATTERN.test(value));
}

function trimTo(value: string | null | undefined, max: number) {
  return (value ?? "").trim().slice(0, max);
}

export async function POST(request: Request) {
  const limited = rateLimit(`orders:${clientIp(request)}`, 20, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const body = (await request.json().catch(() => null)) as CheckoutBody | null;
  const items = Array.isArray(body?.items) ? body.items : [];
  const address = body?.address;

  if (items.length < 1 || items.length > 30) {
    return NextResponse.json({ error: "Cart must contain between 1 and 30 items." }, { status: 400 });
  }

  const area = trimTo(address?.area, 120);
  const street = trimTo(address?.street, 240);
  const phone = trimTo(address?.phone, 40);
  const emirate = (address?.emirate ?? "").trim() as UaeEmirate;
  if (!area || !street) {
    return NextResponse.json({ error: "Add a delivery area and street before placing this order." }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ error: "Add a contact number so the boutique and driver can reach you." }, { status: 400 });
  }
  if (emirate !== "dubai") {
    return NextResponse.json({ error: "Morni currently delivers in Dubai only." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rpcItems: Array<{
    product_id: string;
    variant_id: string | null;
    quantity: number;
    size: string | null;
    customization?: ProductCustomizationValues;
  }> = [];

  for (const item of items) {
    if (!isUuid(item.productId)) {
      return NextResponse.json({ error: "A product in your bag is invalid." }, { status: 400 });
    }
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 25) {
      return NextResponse.json({ error: "Invalid quantity." }, { status: 400 });
    }
    rpcItems.push({
      product_id: item.productId,
      variant_id: isUuid(item.variantId) ? item.variantId : null,
      quantity,
      size: trimTo(item.size, 40) || null,
      customization: sanitizeCustomizationValues(item.customization),
    });
  }

  const admin = createAdminClient();
  const { data: baseProductRows, error: productError } = await admin
    .from("products")
    // Keep this verification query on the stable product columns. Optional
    // customization fields may not exist until their migration is applied;
    // checkout should still work for standard products in that interim.
    .select("id, store_id")
    .in("id", rpcItems.map((item) => item.product_id));
  if (productError) {
    return NextResponse.json({ error: "Unable to verify your bag." }, { status: 500 });
  }

  let productRows = (baseProductRows ?? []) as VerifiedProduct[];
  const { data: customizationRows, error: customizationQueryError } = await admin
    .from("products")
    .select("id, customization_enabled, customization_instructions, customization_fields")
    .in("id", rpcItems.map((item) => item.product_id));
  if (!customizationQueryError && customizationRows) {
    const customizationById = new Map(
      customizationRows.map((product) => [product.id, product]),
    );
    productRows = productRows.map((product) => ({
      ...product,
      ...(customizationById.get(product.id) ?? {}),
    }));
  } else if (customizationQueryError) {
    console.warn("Optional product customization fields unavailable during checkout", customizationQueryError.message);
  }

  const productsById = new Map((productRows ?? []).map((product) => [product.id, product]));
  let storeId: string | null = null;

  for (const item of rpcItems) {
    const product = productsById.get(item.product_id);
    if (!product) {
      return NextResponse.json({ error: "A product in your bag is no longer available." }, { status: 400 });
    }
    const customization = item.customization ?? {};
    const config = customizationConfigFromProduct(product);
    const customizationError = Object.keys(customization).length
      ? validateCustomizationValues(config, customization)
      : null;
    if (customizationError) {
      return NextResponse.json({ error: customizationError }, { status: 400 });
    }
    if (Object.keys(customization).length && !config.enabled) {
      return NextResponse.json({ error: "Custom measurements are not available for this product." }, { status: 400 });
    }
    if (storeId && storeId !== product.store_id) {
      return NextResponse.json({ error: "Checkout is limited to one boutique per order." }, { status: 400 });
    }
    storeId = product.store_id;
  }

  if (!storeId) {
    return NextResponse.json({ error: "A product in your bag is no longer available." }, { status: 400 });
  }

  const requestedMethod = body?.paymentMethod === "card" ? "card" : null;
  if (!requestedMethod) {
    return NextResponse.json(
      { error: "Card payment is required to place an order." },
      { status: 400 },
    );
  }
  if (!isAfsPaymentsEnabled()) {
    return NextResponse.json(
      { error: "Card payments are not available right now. Please try again later." },
      { status: 503 },
    );
  }
  const paymentMethod = requestedMethod;

  const { data, error } = await admin.rpc("place_order_with_items", {
    p_store_id: storeId,
    p_payment_method: paymentMethod,
    p_subtotal_aed: 0,
    p_delivery_fee_aed: 0,
    p_total_aed: 0,
    p_delivery_emirate: emirate,
    p_delivery_area: area,
    p_delivery_street: street,
    p_delivery_building: trimTo(address?.building, 120),
    p_delivery_apartment: trimTo(address?.apartment, 80),
    p_delivery_notes: trimTo(address?.notes, 1000),
    p_delivery_phone: phone,
    p_delivery_eta_minutes: 0,
    p_items: rpcItems,
    p_shopper_id: user.id,
  });

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Unable to place this order." },
      { status: 400 },
    );
  }

  const order = (Array.isArray(data) ? data[0] : data) as {
    id?: string;
    order_number?: string;
  } | null;
  if (!order?.id) {
    return NextResponse.json({ error: "Unable to place this order." }, { status: 500 });
  }

  // The checkout RPC owns pricing and stock. Attach the already-validated
  // measurements immediately afterwards so the same order item context is
  // available to the boutique team and shopper order history.
  if (rpcItems.some((item) => Object.keys(item.customization ?? {}).length > 0)) {
    const { data: createdItems } = await admin
      .from("order_items")
      .select("id, product_id, variant_id, size")
      .eq("order_id", order.id)
      .order("id", { ascending: true });
    const remaining = [...rpcItems];
    for (const createdItem of createdItems ?? []) {
      const matchIndex = remaining.findIndex(
        (item) =>
          item.product_id === createdItem.product_id &&
          item.variant_id === createdItem.variant_id &&
          item.size === createdItem.size,
      );
      if (matchIndex < 0) continue;
      const [match] = remaining.splice(matchIndex, 1);
      if (Object.keys(match.customization ?? {}).length > 0) {
        const { error: customizationError } = await admin
          .from("order_items")
          .update({ customization: match.customization })
          .eq("id", createdItem.id);
        if (customizationError) console.error("Order placed but customization was not saved", customizationError);
      }
    }
  }

  if (body?.saveAddress) {
    const label = trimTo(address?.label, 80) || "Delivery";
    const { error: addressError } = await supabase.from("addresses").insert({
      user_id: user.id,
      label,
      phone,
      emirate,
      area,
      street,
      building: trimTo(address?.building, 120) || null,
      apartment: trimTo(address?.apartment, 80) || null,
      notes: trimTo(address?.notes, 1000) || null,
      is_default: Boolean(body.makeDefault),
    });
    if (addressError) {
      console.error("Order placed but address was not saved", addressError);
    }
  }

  return NextResponse.json(
    {
      order: { id: order.id, order_number: order.order_number ?? null },
      next: "pay",
    },
    { status: 201 },
  );
}
