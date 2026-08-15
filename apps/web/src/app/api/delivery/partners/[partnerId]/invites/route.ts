import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type InviteRole = "dispatcher" | "driver";

export async function POST(
  request: Request,
  context: RouteContext<"/api/delivery/partners/[partnerId]/invites">,
) {
  const { partnerId } = await context.params;
  const body = (await request.json().catch(() => null)) as { email?: string; role?: InviteRole } | null;
  const email = body?.email?.trim().toLowerCase() ?? "";
  const role = body?.role;
  if (!/^\S+@\S+\.\S+$/.test(email) || (role !== "dispatcher" && role !== "driver")) {
    return NextResponse.json({ error: "A valid email and delivery role are required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase.rpc("create_delivery_partner_invite", {
    p_partner_id: partnerId,
    p_email: email,
    p_role: role,
  });
  if (error) {
    const status = error.message.includes("not found") ? 404 : error.code === "42501" ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  const invite = data as { token: string; partner_name: string } | null;
  if (!invite?.token) return NextResponse.json({ error: "Unable to create delivery invite." }, { status: 500 });

  const joinPath = role === "driver" ? "/driver/join" : "/partner/join";
  const inviteUrl = new URL(joinPath, request.url);
  inviteUrl.searchParams.set("token", invite.token);
  return NextResponse.json({ inviteUrl: inviteUrl.toString(), partnerName: invite.partner_name });
}
