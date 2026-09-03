import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ storeId: z.string().trim().min(1).max(200), urls: z.array(z.string().url()).min(1).max(500) });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid cleanup request." }, { status: 400 });
  const admin = createAdminClient();
  const [{ data: member }, { data: profile }] = await Promise.all([
    admin.from("store_members").select("store_id").eq("store_id", parsed.data.storeId).eq("user_id", user.id).maybeSingle(),
    admin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);
  if (!member && profile?.role !== "admin") return NextResponse.json({ error: "You do not have access to this store." }, { status: 403 });
  const marker = "/storage/v1/object/public/product-images/";
  const paths = parsed.data.urls.flatMap((url) => {
    const index = url.indexOf(marker);
    return index === -1 ? [] : [decodeURIComponent(url.slice(index + marker.length))];
  });
  if (paths.length) await admin.storage.from("product-images").remove(paths);
  return NextResponse.json({ removed: paths.length });
}
