import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("bulk_imports")
    .update({ status: "failed", completed_at: new Date().toISOString() })
    .in("status", ["uploading", "analyzing", "publishing"])
    .lt("created_at", cutoff)
    .select("id");
  if (error) {
    console.error("Bulk import cleanup failed", error);
    return NextResponse.json({ error: "Unable to clean up abandoned imports." }, { status: 500 });
  }
  return NextResponse.json({ expiredImports: data?.length ?? 0 });
}
