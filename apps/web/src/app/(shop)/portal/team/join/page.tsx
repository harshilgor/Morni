"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function JoinStoreTeamPage() {
  const router = useRouter(); const params = useSearchParams(); const token = params.get("token");
  const [message, setMessage] = useState("Checking your invitation…");
  useEffect(() => { void (async () => {
    if (!token) { setMessage("This invitation link is invalid."); return; }
    const { data: { user } } = await createClient().auth.getUser();
    if (!user) { router.replace(`/auth?next=${encodeURIComponent(`/portal/team/join?token=${token}`)}`); return; }
    const response = await fetch("/api/portal/team/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "We could not accept this invitation."); return; }
    setMessage(`You now have access to ${data.storeName}. Opening the portal…`);
    window.setTimeout(() => router.replace("/portal"), 700);
  })(); }, [router, token]);
  return <div className="mx-auto max-w-lg px-4 py-20 text-center"><div className="rounded-2xl border border-line bg-surface p-8"><h1 className="font-display text-3xl text-ink">Store team access</h1><p className="mt-3 text-sm leading-6 text-muted">{message}</p></div></div>;
}
