import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await createAdminClient().rpc("requeue_expired_delivery_assignments");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requeued: data ?? 0 });
}
