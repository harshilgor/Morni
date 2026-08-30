"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PortalIcon } from "@/components/portal-icons";
import { createClient } from "@/lib/supabase/client";

function safeNextPath(value: string | null) {
  return value && /^\/(?!\/)/.test(value) ? value : "/";
}

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const authError = searchParams.get("error");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [resetMode, setResetMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState<string | null>(
    authError
      ? "This sign-in link is invalid or has expired. Please request a new one."
      : searchParams.get("reset") === "success"
        ? "Your password has been updated. You can sign in now."
        : null,
  );
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);

  const title = useMemo(
    () => (mode === "signin" ? "Welcome back" : "Create your Morni account"),
    [mode],
  );

  async function signInWithGoogle() {
    setGoogleLoading(true);
    setMessage(null);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
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
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: { emailRedirectTo },
    });

    setMessage(error ? error.message : "Check your email for a secure sign-in link.");
    setLinkLoading(false);
  }

  async function sendPasswordReset() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setMessage("Enter a valid email address first.");
      return;
    }

    setLinkLoading(true);
    setMessage(null);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?flow=password-reset&next=${encodeURIComponent("/auth/reset-password")}`;
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });

    setMessage(error ? error.message : "If an account exists for that email, you’ll receive a password reset link.");
    setLinkLoading(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const supabase = createClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }
      void fetch("/api/emails/welcome", { method: "POST" });
      router.push(next);
      router.refresh();
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();
    if (!/^[-+0-9() ]{7,}$/.test(normalizedPhone)) {
      setMessage("Enter a valid phone number so your store and rider can contact you.");
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { full_name: fullName, phone: normalizedPhone },
      },
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    // With email confirmations enabled, Supabase intentionally returns a
    // successful-looking response for an existing account. An empty identity
    // list is its documented signal that no new user was created.
    if (data.user?.identities?.length === 0) {
      setMessage("An account has already been created with this email. Please sign in instead.");
      setMode("signin");
      setLoading(false);
      return;
    }

    void fetch("/api/emails/welcome", { method: "POST" });
    setMessage("Account created. You can sign in now.");
    setMode("signin");
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
      <h1 className="font-display text-4xl text-ink">{resetMode ? "Reset your password" : title}</h1>
      <p className="mt-2 text-sm text-muted">
        {resetMode ? "Enter your email and we’ll send you a secure reset link." : mode === "signin" ? "Sign in with Google, or use email and password." : "Create your account with email, password, and a phone number."}
      </p>

      {resetMode ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void sendPasswordReset();
          }}
          className="mt-6 space-y-4 rounded-[1.5rem] border border-line bg-surface p-6"
        >
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted">Email</span>
            <input
              type="email"
              className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          {message ? <p className="text-sm text-accent-deep">{message}</p> : null}
          <button type="submit" disabled={linkLoading} className="w-full rounded-full bg-ink py-3 text-sm text-white disabled:opacity-50">
            {linkLoading ? "Sending link…" : "Send reset link"}
          </button>
          <button type="button" onClick={() => { setResetMode(false); setMessage(null); }} className="w-full rounded-full border border-line bg-surface py-3 text-sm text-ink">
            Back to sign in
          </button>
        </form>
      ) : <>

      {mode === "signin" ? <button
        type="button"
        onClick={signInWithGoogle}
        disabled={googleLoading}
        className="mt-6 flex w-full items-center justify-center gap-3 rounded-full border border-line bg-surface px-4 py-3 text-sm font-medium text-ink transition hover:border-accent disabled:opacity-50"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-[#4285F4]">
          G
        </span>
        {googleLoading ? "Redirecting to Google…" : "Continue with Google"}
      </button> : <p className="mt-6 rounded-xl bg-sand/60 px-4 py-3 text-xs leading-5 text-muted">Phone numbers are required for delivery updates and driver contact.</p>}

      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-muted">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`rounded-full px-4 py-2 text-sm ${mode === "signin" ? "bg-ink text-white" : "border border-line bg-surface"}`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`rounded-full px-4 py-2 text-sm ${mode === "signup" ? "bg-ink text-white" : "border border-line bg-surface"}`}
        >
          Sign up
        </button>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-[1.5rem] border border-line bg-surface p-6">
        {mode === "signup" ? (
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted">Full name</span>
            <input
              className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </label>
        ) : null}

        {mode === "signup" ? (
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted">Phone number</span>
            <input
              type="tel"
              inputMode="tel"
              className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+971 50 123 4567"
              pattern="[-+0-9() ]{7,}"
              title="Enter a valid phone number"
              required
              autoComplete="tel"
            />
          </label>
        ) : null}

        <label className="block space-y-1.5 text-sm">
          <span className="text-muted">Email</span>
          <input
              type="email"
              className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
          />
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="text-muted">Password</span>
          <span className="relative block">
            <input
              type={showPassword ? "text" : "password"}
              className="w-full rounded-xl border border-line bg-background px-3 py-2.5 pr-11"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-muted transition hover:text-ink"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              <PortalIcon name={showPassword ? "eyeOff" : "eye"} className="h-4 w-4" />
            </button>
          </span>
        </label>

        {message ? <p className="text-sm text-accent-deep">{message}</p> : null}

        <button
          type="submit"
          disabled={loading || linkLoading}
          className="w-full rounded-full bg-ink py-3 text-sm text-white disabled:opacity-50"
        >
          {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
        {mode === "signin" ? (
          <>
            <button type="button" onClick={() => void sendSignInLink()} disabled={loading || linkLoading} className="w-full rounded-full border border-line bg-surface py-3 text-sm text-ink disabled:opacity-50">
              {linkLoading ? "Sending link…" : "Email me a sign-in link"}
            </button>
            <button type="button" onClick={() => { setResetMode(true); setMessage(null); }} disabled={loading || linkLoading} className="w-full text-sm text-muted underline underline-offset-4 hover:text-ink">
              Forgot password?
            </button>
          </>
        ) : null}
      </form>
      </>}
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="p-10 text-muted">Loading…</div>}>
      <AuthForm />
    </Suspense>
  );
}
