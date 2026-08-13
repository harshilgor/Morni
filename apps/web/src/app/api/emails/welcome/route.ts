import { NextResponse } from "next/server";
import { sendWelcomeEmail } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
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
