import { NextResponse } from "next/server";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { UaeEmirate } from "@/lib/types";

type CheckoutItem = {
  productId?: string;
  variantId?: string | null;
  quantity?: number;
  size?: string | null;
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
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_PATTERN.test(value));
}

function trimTo(value: string | null | undefined, max: number) {
  return (value ?? "").trim().slice(0, max);
}

export async function POST(request: Request) {
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
    });
  }

  const admin = createAdminClient();
  const { data: productRows, error: productError } = await admin
    .from("products")
    .select("id, store_id")
    .in("id", rpcItems.map((item) => item.product_id));
  if (productError) {
    return NextResponse.json({ error: "Unable to verify your bag." }, { status: 500 });
  }

  const productsById = new Map((productRows ?? []).map((product) => [product.id, product]));
  let storeId: string | null = null;

  for (const item of rpcItems) {
    const product = productsById.get(item.product_id);
    if (!product) {
      return NextResponse.json({ error: "A product in your bag is no longer available." }, { status: 400 });
    }
    if (storeId && storeId !== product.store_id) {
      return NextResponse.json({ error: "Checkout is limited to one boutique per order." }, { status: 400 });
    }
    storeId = product.store_id;
  }

  if (!storeId) {
    return NextResponse.json({ error: "A product in your bag is no longer available." }, { status: 400 });
  }

  const { data, error } = await admin.rpc("place_order_with_items", {
    p_store_id: storeId,
    p_payment_method: "cod",
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

  try {
    await sendOrderConfirmationEmail(order.id);
  } catch (sendError) {
    console.error("Order placed but confirmation email failed", sendError);
  }

  return NextResponse.json(
    { order: { id: order.id, order_number: order.order_number ?? null } },
    { status: 201 },
  );
}
