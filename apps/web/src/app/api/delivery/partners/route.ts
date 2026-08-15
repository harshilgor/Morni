import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { name?: string; supportEmail?: string } | null;
  const name = body?.name?.trim() ?? "";
  const supportEmail = body?.supportEmail?.trim().toLowerCase() || null;
  if (name.length < 2 || name.length > 120) return NextResponse.json({ error: "Enter a delivery company name between 2 and 120 characters." }, { status: 400 });
  if (supportEmail && !/^\S+@\S+\.\S+$/.test(supportEmail)) return NextResponse.json({ error: "Enter a valid support email." }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase.rpc("create_delivery_partner", {
    p_name: name,
    p_support_email: supportEmail,
  });
  if (error) {
    const message = error.code === "23505"
      ? "That email is already linked to a delivery partner."
      : error.message;
    return NextResponse.json({ error: message }, { status: error.code === "42501" ? 403 : 400 });
  }

  const partner = data as { id: string; name: string; slug: string } | null;
  if (!partner?.id) return NextResponse.json({ error: "Unable to create delivery partner." }, { status: 500 });
  return NextResponse.json({ partner }, { status: 201 });
}
