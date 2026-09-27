import { NextResponse } from "next/server";
import { processAbandonedCartReminders } from "@/lib/email";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await processAbandonedCartReminders());
  } catch (error) {
    console.error("Abandoned cart reminder processing failed", error);
    return NextResponse.json({ error: "Unable to process abandoned cart reminders." }, { status: 500 });
  }
}
