import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { name?: string; supportEmail?: string } | null;
  const name = body?.name?.trim() ?? "";
  const supportEmail = body?.supportEmail?.trim().toLowerCase() || null;
  if (name.length < 2 || name.length > 120) return NextResponse.json({ error: "Enter a delivery company name between 2 and 120 characters." }, { status: 400 });
  if (supportEmail && !/^\S+@\S+\.\S+$/.test(supportEmail)) return NextResponse.json({ error: "Enter a valid support email." }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Founder access is required." }, { status: 403 });

  const baseSlug = slugify(name);
  if (!baseSlug) return NextResponse.json({ error: "Enter a valid delivery company name." }, { status: 400 });
  const slug = `${baseSlug}-${randomUUID().slice(0, 8)}`;
  const { data: partner, error } = await admin
    .from("delivery_partners")
    .insert({ name, slug, support_email: supportEmail })
    .select("id, name, slug")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ partner }, { status: 201 });
}
