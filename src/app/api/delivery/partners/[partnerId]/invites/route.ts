import { NextResponse } from "next/server";
import { sendDeliveryInviteEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
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

  // Generate the Supabase link without using its mailer. Resend then delivers
  // the same secure, one-click access link alongside the delivery invitation.
  const callbackUrl = new URL("/auth/callback", request.url);
  callbackUrl.searchParams.set("flow", role === "driver" ? "driver" : "partner");
  callbackUrl.searchParams.set("next", `${joinPath}?token=${encodeURIComponent(invite.token)}`);
  const { data: authLink, error: authLinkError } = await createAdminClient().auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: callbackUrl.toString() },
  });
  if (authLinkError || !authLink.properties?.action_link) {
    console.error("Unable to generate delivery access link", { partnerId, email, error: authLinkError });
    return NextResponse.json(
      { error: "Invite created, but the secure access link could not be generated. Please try again." },
      { status: 500 },
    );
  }

  try {
    await sendDeliveryInviteEmail({
      email,
      partnerName: invite.partner_name,
      role,
      accessUrl: authLink.properties.action_link,
      inviteToken: invite.token,
    });
    return NextResponse.json({
      inviteUrl: inviteUrl.toString(),
      partnerName: invite.partner_name,
      emailSent: true,
    });
  } catch (error) {
    console.error("Unable to send delivery invite email", {
      partnerId,
      email,
      error,
    });
    return NextResponse.json({
      inviteUrl: inviteUrl.toString(),
      partnerName: invite.partner_name,
      emailSent: false,
      error: "Invite created, but the welcome email could not be sent. Copy the join link and share it manually.",
    });
  }
}
