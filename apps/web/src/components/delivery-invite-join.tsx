"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PortalIcon } from "@/components/portal-icons";
import { createClient } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/use-auth-user";

export function DeliveryInviteJoin({ target }: { target: "partner" | "driver" }) {
  const { auth, loading } = useAuthUser();
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const [message, setMessage] = useState<string | null>(null);
  const redeemedToken = useRef<string | null>(null);

  useEffect(() => {
    if (!auth || !token || redeemedToken.current === token) return;
    redeemedToken.current = token;
    let active = true;
    const supabase = createClient();
    const workspace = target === "driver" ? "/driver" : "/partner";
    void supabase.rpc("redeem_delivery_partner_invite", { p_token: token }).then(async ({ data, error }) => {
      if (!active) return;
      if (!error) {
        router.replace((data as { role?: string } | null)?.role === "driver" ? "/driver" : "/partner");
        return;
      }
      // A one-time invite reports as invalid once redeemed, so confirm whether
      // this account already has workspace access before showing the failure.
      const { error: accessError } = await supabase.rpc(
        target === "driver" ? "driver_delivery_workspace_data" : "partner_delivery_workspace_data",
      );
      if (!active) return;
      if (accessError) setMessage(error.message);
      else router.replace(workspace);
    });
    return () => { active = false; };
  }, [auth, router, target, token]);

  const next = `${target === "driver" ? "/driver/join" : "/partner/join"}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
  return <main className="grid min-h-screen place-items-center bg-[#f6f7f5] px-5 text-center"><section className="max-w-md rounded-2xl border border-[#dce5e0] bg-white p-8 shadow-[0_24px_70px_-40px_rgba(25,42,35,0.45)]"><span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#e8f4ee] text-[#367762]"><PortalIcon name="package" className="h-5 w-5" /></span><h1 className="mt-5 text-2xl font-semibold text-[#19342b]">Join Morni delivery</h1>{!token ? <p className="mt-3 text-sm leading-6 text-[#65756d]">This invite link is incomplete. Ask your delivery company for a fresh invite.</p> : loading ? <p className="mt-3 text-sm leading-6 text-[#65756d]">Checking your invite…</p> : !auth ? <><p className="mt-3 text-sm leading-6 text-[#65756d]">Sign in or create an account using the same email address that received this invite.</p><Link href={`/auth?next=${encodeURIComponent(next)}`} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#213d33] px-4 py-2.5 text-sm font-semibold text-white">Continue to sign in <PortalIcon name="arrow" className="h-4 w-4" /></Link></> : message ? <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2.5 text-sm leading-6 text-rose-700">{message}</p> : <p className="mt-3 text-sm leading-6 text-[#65756d]">Connecting your delivery account…</p>}</section></main>;
}
