import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ token: z.string().min(32).max(200) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "This invitation link is invalid." }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Sign in with the invited email address first." }, { status: 401 });
  try {
    const admin = createAdminClient();
    const hash = createHash("sha256").update(parsed.data.token).digest("hex");
    const { data: invite, error: inviteError } = await admin.from("store_team_invites").select("id, store_id, email, role, expires_at, accepted_at, revoked_at, stores(name)").eq("token_hash", hash).maybeSingle();
    if (inviteError || !invite || invite.accepted_at || invite.revoked_at || new Date(invite.expires_at) <= new Date()) return NextResponse.json({ error: "This invitation has expired or is no longer available." }, { status: 410 });
    if (invite.email.toLowerCase() !== user.email.toLowerCase()) return NextResponse.json({ error: `Sign in with ${invite.email} to accept this invitation.` }, { status: 403 });
    const { data: claimed, error: claimError } = await admin.from("store_team_invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id).is("accepted_at", null).is("revoked_at", null).select("id").maybeSingle();
    if (claimError) throw new Error(claimError.message);
    if (!claimed) return NextResponse.json({ error: "This invitation is no longer available." }, { status: 410 });
    const { data: existing } = await admin.from("store_members").select("id").eq("store_id", invite.store_id).eq("user_id", user.id).maybeSingle();
    if (!existing) {
      const { error: membershipError } = await admin.from("store_members").insert({ store_id: invite.store_id, user_id: user.id, role: invite.role });
      if (membershipError) throw new Error(membershipError.message);
    }
    const store = Array.isArray(invite.stores) ? invite.stores[0] : invite.stores;
    return NextResponse.json({ ok: true, storeName: store?.name ?? "the store" });
  } catch (error) {
    console.error("[portal/team/accept] unable to accept invite", error);
    return NextResponse.json({ error: "Could not accept the invitation. Please try again." }, { status: 500 });
  }
}
