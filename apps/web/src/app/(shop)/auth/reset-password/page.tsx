"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setMessage("Use at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("The passwords do not match.");
      return;
    }

    setLoading(true);
    setMessage(null);
    const { error } = await createClient().auth.updateUser({ password });
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    await createClient().auth.signOut();
    router.replace("/auth?reset=success");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
      <h1 className="font-display text-4xl text-ink">Choose a new password</h1>
      <p className="mt-2 text-sm text-muted">Set a new password for your Morni account.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-[1.5rem] border border-line bg-surface p-6">
        <label className="block space-y-1.5 text-sm">
          <span className="text-muted">New password</span>
          <input type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" className="w-full rounded-xl border border-line bg-background px-3 py-2.5" />
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="text-muted">Confirm new password</span>
          <input type="password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" className="w-full rounded-xl border border-line bg-background px-3 py-2.5" />
        </label>
        {message ? <p className="text-sm text-accent-deep">{message}</p> : null}
        <button type="submit" disabled={loading} className="w-full rounded-full bg-ink py-3 text-sm text-white disabled:opacity-50">
          {loading ? "Updating password…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
