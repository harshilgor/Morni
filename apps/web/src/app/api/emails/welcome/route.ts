import { NextResponse } from "next/server";
import { sendWelcomeEmail } from "@/lib/email";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const limited = rateLimit(`welcome-email:${clientIp(request)}`, 5, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendWelcomeEmail(user.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Unable to send welcome email", error);
    return NextResponse.json({ error: "Unable to send welcome email" }, { status: 500 });
  }
}
