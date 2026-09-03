import { NextResponse } from "next/server";
import { processEmailOutbox } from "@/lib/email";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await processEmailOutbox());
  } catch (error) {
    console.error("Email outbox processing failed", error);
    return NextResponse.json({ error: "Unable to process email outbox." }, { status: 500 });
  }
}
