import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { sendWelcomeEmail } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null, fallback = "/") {
  return value && /^\/(?!\/)/.test(value) ? value : fallback;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const flow = searchParams.get("flow");
  // Recovery links can arrive with either our explicit flow marker or
  // Supabase's standard `type=recovery` marker. Never let either form fall
  // through to the normal homepage/sign-in destination.
  const isPasswordRecovery = flow === "password-reset" || type === "recovery";
  const next = isPasswordRecovery
    ? "/auth/reset-password"
    : safeNextPath(searchParams.get("next"), flow === "driver" ? "/driver" : "/");

  if (code || (tokenHash && type)) {
    const supabase = await createClient();
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type! });
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && !isPasswordRecovery) {
        try {
          await sendWelcomeEmail(user.id);
        } catch (emailError) {
          console.error("Unable to send welcome email", emailError);
        }
      }
      return NextResponse.redirect(new URL(next, origin));
    }

    console.error("[auth/callback] session exchange failed", {
      flow: flow ?? "customer",
      method: code ? "code" : "email_otp",
      error: error.message,
    });
  }

  const failureDestination = flow === "driver"
    ? "/driver/sign-in"
    : next === "/founder" || next.startsWith("/founder/")
      ? "/founder/auth"
      : "/auth";
  const failureUrl = new URL(failureDestination, origin);
  failureUrl.searchParams.set("error", "auth_callback_failed");
  if (flow === "driver" || failureDestination === "/founder/auth") failureUrl.searchParams.set("next", next);
  return NextResponse.redirect(failureUrl);
}
