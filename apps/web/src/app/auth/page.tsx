"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const authError = searchParams.get("error");
  const roleParam = searchParams.get("role");
  const initialRole: UserRole =
    roleParam === "store_owner" || roleParam === "admin" ? roleParam : "shopper";
  const [mode, setMode] = useState<"signin" | "signup">(
    initialRole === "store_owner" ? "signup" : "signin",
  );
  const [role, setRole] = useState<UserRole>(initialRole);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState<string | null>(
    authError ? "Google sign-in failed. Please try again." : null,
  );
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

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
      router.push(next.startsWith("/") ? next : "/");
      router.refresh();
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
      },
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setMessage("Account created. You can sign in now.");
    setMode("signin");
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
      <h1 className="font-display text-4xl text-ink">{title}</h1>
      <p className="mt-2 text-sm text-muted">
        Sign in with Google, or use email and password.
      </p>

      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={googleLoading}
        className="mt-6 flex w-full items-center justify-center gap-3 rounded-full border border-line bg-surface px-4 py-3 text-sm font-medium text-ink transition hover:border-accent disabled:opacity-50"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-[#4285F4]">
          G
        </span>
        {googleLoading ? "Redirecting to Google…" : "Continue with Google"}
      </button>

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
          <>
            <label className="block space-y-1.5 text-sm">
              <span className="text-muted">Full name</span>
              <input
                className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-muted">I am a</span>
              <select
                className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
              >
                <option value="shopper">Shopper</option>
                <option value="store_owner">Store owner</option>
              </select>
            </label>
          </>
        ) : null}

        <label className="block space-y-1.5 text-sm">
          <span className="text-muted">Email</span>
          <input
            type="email"
            className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="text-muted">Password</span>
          <input
            type="password"
            className="w-full rounded-xl border border-line bg-background px-3 py-2.5"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </label>

        {message ? <p className="text-sm text-accent-deep">{message}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-ink py-3 text-sm text-white disabled:opacity-50"
        >
          {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>
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
