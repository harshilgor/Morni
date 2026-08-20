import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type PartnerUpdateBody = {
  isActive?: boolean;
  autoDispatchEnabled?: boolean;
};

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/delivery/partners/[partnerId]">,
) {
  const { partnerId } = await context.params;
  const body = (await request.json().catch(() => null)) as PartnerUpdateBody | null;
  if (!body || (body.isActive === undefined && body.autoDispatchEnabled === undefined)) {
    return NextResponse.json(
      { error: "Provide isActive and/or autoDispatchEnabled." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase.rpc("update_delivery_partner", {
    p_partner_id: partnerId,
    p_is_active: body.isActive ?? null,
    p_auto_dispatch_enabled: body.autoDispatchEnabled ?? null,
  });
  if (error) {
    const status = error.message.includes("not found")
      ? 404
      : error.message.includes("Founder")
        ? 403
        : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ partner: data });
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/delivery/partners/[partnerId]">,
) {
  const { partnerId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase.rpc("delete_delivery_partner", {
    p_partner_id: partnerId,
  });
  if (error) {
    const status = error.message.includes("not found")
      ? 404
      : error.message.includes("Founder")
        ? 403
        : error.message.includes("active deliveries")
          ? 409
          : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ partner: data });
}
