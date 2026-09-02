import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { sendStoreTeamInviteEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const roleSchema = z.enum(["manager", "staff"]);
const inviteSchema = z.object({
  storeId: z.string().uuid(),
  email: z.string().trim().email().max(320),
  role: roleSchema,
});
const changeRoleSchema = z.object({
  storeId: z.string().uuid(),
  memberId: z.string().uuid(),
  role: roleSchema,
});
const removeSchema = z.object({
  storeId: z.string().uuid(),
  memberId: z.string().uuid().optional(),
  inviteId: z.string().uuid().optional(),
}).refine((value) => Boolean(value.memberId) !== Boolean(value.inviteId), {
  message: "Provide exactly one member or invitation.",
});

async function currentOwner(storeId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Sign in to manage your store team." }, { status: 401 }) };

  const admin = createAdminClient();
  const [{ data: membership }, { data: profile }] = await Promise.all([
    admin.from("store_members").select("id, role").eq("store_id", storeId).eq("user_id", user.id).maybeSingle(),
    admin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);
  if (membership?.role !== "owner" && profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Only the store owner can manage team access." }, { status: 403 }) };
  }
  return { admin, user };
}

async function memberDetails(admin: ReturnType<typeof createAdminClient>, storeId: string) {
  const { data: members, error } = await admin
    .from("store_members")
    .select("id, user_id, role, created_at, profiles(full_name)")
    .eq("store_id", storeId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  return Promise.all((members ?? []).map(async (member) => {
    const { data } = await admin.auth.admin.getUserById(member.user_id);
    const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
    return {
      id: member.id,
      userId: member.user_id,
      role: member.role,
      createdAt: member.created_at,
      name: profile?.full_name ?? null,
      email: data.user?.email ?? "Unavailable",
    };
  }));
}

export async function GET(request: Request) {
  const storeId = new URL(request.url).searchParams.get("storeId");
  if (!storeId || !z.string().uuid().safeParse(storeId).success) {
    return NextResponse.json({ error: "A valid store is required." }, { status: 400 });
  }
  try {
    const context = await currentOwner(storeId);
    if ("error" in context) return context.error;
    const [members, { data: invites, error: inviteError }] = await Promise.all([
      memberDetails(context.admin, storeId),
      context.admin.from("store_team_invites").select("id, email, role, expires_at, created_at").eq("store_id", storeId).is("accepted_at", null).is("revoked_at", null).order("created_at", { ascending: false }),
    ]);
    if (inviteError) throw new Error(inviteError.message);
    return NextResponse.json({ members, invites: invites ?? [] });
  } catch (error) {
    console.error("[portal/team] unable to load team", error);
    return NextResponse.json({ error: "Could not load the store team." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const parsed = inviteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address and role." }, { status: 400 });
  try {
    const context = await currentOwner(parsed.data.storeId);
    if ("error" in context) return context.error;
    const email = parsed.data.email.toLowerCase();
    const { data: existingUser } = await context.admin.auth.admin.listUsers({ perPage: 1000 });
    const existingAccount = existingUser.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (existingAccount) {
      const { data: existingMembership } = await context.admin.from("store_members").select("id").eq("store_id", parsed.data.storeId).eq("user_id", existingAccount.id).maybeSingle();
      if (existingMembership) return NextResponse.json({ error: "This person already has access to the store." }, { status: 409 });
    }
    const { data: store, error: storeError } = await context.admin.from("stores").select("name").eq("id", parsed.data.storeId).single();
    if (storeError || !store) throw new Error(storeError?.message ?? "Store not found.");

    await context.admin.from("store_team_invites").update({ revoked_at: new Date().toISOString() }).eq("store_id", parsed.data.storeId).eq("email", email).is("accepted_at", null).is("revoked_at", null);
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const { data: invite, error: inviteError } = await context.admin.from("store_team_invites").insert({
      store_id: parsed.data.storeId, email, role: parsed.data.role, token_hash: tokenHash, invited_by: context.user.id,
    }).select("id").single();
    if (inviteError || !invite) throw new Error(inviteError?.message ?? "Could not create invitation.");

    const accessUrl = `${new URL(request.url).origin}/portal/team/join?token=${encodeURIComponent(rawToken)}`;
    let emailSent = true;
    try {
      await sendStoreTeamInviteEmail({ email, storeName: store.name, role: parsed.data.role, accessUrl, inviteId: invite.id });
    } catch (emailError) {
      emailSent = false;
      console.error("[portal/team] invite email failed", { inviteId: invite.id, emailError });
    }
    return NextResponse.json({ inviteId: invite.id, emailSent, accessUrl });
  } catch (error) {
    console.error("[portal/team] unable to create invite", error);
    return NextResponse.json({ error: "Could not create the invitation." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const parsed = changeRoleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid team role." }, { status: 400 });
  try {
    const context = await currentOwner(parsed.data.storeId);
    if ("error" in context) return context.error;
    const { data: member } = await context.admin.from("store_members").select("role").eq("id", parsed.data.memberId).eq("store_id", parsed.data.storeId).maybeSingle();
    if (!member) return NextResponse.json({ error: "Team member not found." }, { status: 404 });
    if (member.role === "owner") return NextResponse.json({ error: "The store owner role cannot be changed here." }, { status: 400 });
    const { error } = await context.admin.from("store_members").update({ role: parsed.data.role }).eq("id", parsed.data.memberId).eq("store_id", parsed.data.storeId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[portal/team] unable to change role", error);
    return NextResponse.json({ error: "Could not update this team member." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const parsed = removeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a team member or invitation." }, { status: 400 });
  try {
    const context = await currentOwner(parsed.data.storeId);
    if ("error" in context) return context.error;
    if (parsed.data.memberId) {
      const { data: member } = await context.admin.from("store_members").select("role").eq("id", parsed.data.memberId).eq("store_id", parsed.data.storeId).maybeSingle();
      if (!member) return NextResponse.json({ error: "Team member not found." }, { status: 404 });
      if (member.role === "owner") return NextResponse.json({ error: "The store owner cannot be removed." }, { status: 400 });
      const { error } = await context.admin.from("store_members").delete().eq("id", parsed.data.memberId).eq("store_id", parsed.data.storeId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.admin.from("store_team_invites").update({ revoked_at: new Date().toISOString() }).eq("id", parsed.data.inviteId!).eq("store_id", parsed.data.storeId).is("accepted_at", null);
      if (error) throw new Error(error.message);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[portal/team] unable to remove access", error);
    return NextResponse.json({ error: "Could not remove this access." }, { status: 500 });
  }
}
