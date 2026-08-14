import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
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

  const admin = createAdminClient();
  const [{ data: profile }, { data: membership }, { data: partner }] = await Promise.all([
    admin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    admin.from("delivery_partner_members").select("id").eq("partner_id", partnerId).eq("user_id", user.id).maybeSingle(),
    admin.from("delivery_partners").select("id, name").eq("id", partnerId).maybeSingle(),
  ]);
  if (!partner) return NextResponse.json({ error: "Delivery partner not found." }, { status: 404 });
  if (profile?.role !== "admin" && !membership) return NextResponse.json({ error: "Partner dispatcher access is required." }, { status: 403 });

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { error } = await admin.from("delivery_partner_invites").insert({
    partner_id: partnerId,
    email,
    role,
    token_hash: tokenHash,
    created_by: user.id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const joinPath = role === "driver" ? "/driver/join" : "/partner/join";
  const inviteUrl = new URL(joinPath, request.url);
  inviteUrl.searchParams.set("token", token);
  return NextResponse.json({ inviteUrl: inviteUrl.toString(), partnerName: partner.name });
}
