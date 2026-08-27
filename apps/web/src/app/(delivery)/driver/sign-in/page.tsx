"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/brand-logo";
import { PortalIcon } from "@/components/portal-icons";
import { createClient } from "@/lib/supabase/client";

function safeNextPath(value: string | null) {
  return value && /^\/(?!\/)/.test(value) ? value : "/driver";
}

function DriverSignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const authError = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(
    authError ? "This sign-in link is invalid or has expired. Please request a new one." : null,
  );
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);

  async function signInWithGoogle() {
    setGoogleLoading(true);
    setMessage(null);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?flow=driver&next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) {
      setMessage(error.message);
      setGoogleLoading(false);
    }
  }

  async function sendSignInLink() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setMessage("Enter a valid email address first.");
      return;
    }
    setLinkLoading(true);
    setMessage(null);
    const supabase = createClient();
    const emailRedirectTo = `${window.location.origin}/auth/callback?flow=driver&next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: { emailRedirectTo },
    });
    setMessage(error ? error.message : "Check your email for a secure rider sign-in link.");
    setLinkLoading(false);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <main className="driver-sign-in mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="rounded-2xl border border-[#dce5e0] bg-white p-6 shadow-[0_24px_70px_-40px_rgba(25,42,35,0.45)]">
        <span className="grid h-12 w-12 place-items-center rounded-xl border border-[#dce5e0] bg-[#f6f7f5] p-2">
          <BrandMark className="h-full w-full object-contain" />
        </span>
        <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#4e8875]">Morni rider</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#19342b]">Sign in to deliver</h1>
        <p className="mt-2 text-sm leading-6 text-[#65756d]">
          Use the same email that received your delivery invite.
        </p>

        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          disabled={googleLoading}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-[#d6e1db] bg-white px-4 py-3 text-sm font-semibold text-[#19342b] disabled:opacity-50"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-[#4285F4]">
            G
          </span>
          {googleLoading ? "Redirecting…" : "Continue with Google"}
        </button>

        <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wide text-[#8a9790]">
          <span className="h-px flex-1 bg-[#dce5e0]" />
          or email
          <span className="h-px flex-1 bg-[#dce5e0]" />
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block space-y-1.5 text-sm">
            <span className="text-[#65756d]">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-[#d6e1db] bg-[#fbfdfc] px-3 py-2.5 outline-none focus:border-[#4e8875]"
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="text-[#65756d]">Password</span>
            <span className="relative block">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                className="w-full rounded-xl border border-[#d6e1db] bg-[#fbfdfc] px-3 py-2.5 pr-11 outline-none focus:border-[#4e8875]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-[#8a9790] transition hover:text-[#19342b]"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                <PortalIcon name={showPassword ? "eyeOff" : "eye"} className="h-4 w-4" />
              </button>
            </span>
          </label>
          {message ? <p className="text-sm leading-6 text-[#b14a3f]">{message}</p> : null}
          <button
            type="submit"
            disabled={loading || linkLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#213d33] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
            <PortalIcon name="arrow" className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void sendSignInLink()}
            disabled={loading || linkLoading}
            className="w-full rounded-xl border border-[#d6e1db] bg-white px-4 py-3 text-sm font-semibold text-[#33473e] disabled:opacity-50"
          >
            {linkLoading ? "Sending link…" : "Email me a sign-in link"}
          </button>
        </form>
      </div>
      <p className="mt-6 text-center text-xs text-[#718079]">
        Shopping on Morni?{" "}
        <Link href="/auth" className="font-semibold text-[#367762]">
          Customer sign in
        </Link>
      </p>
    </main>
  );
}

export default function DriverSignInPage() {
  return (
    <Suspense fallback={<main className="grid min-h-dvh place-items-center text-sm text-[#65756d]">Loading…</main>}>
      <DriverSignInForm />
    </Suspense>
  );
}
