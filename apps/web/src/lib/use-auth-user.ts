"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export type AuthUser = {
  user: User;
  profile: Profile | null;
  hasStore: boolean;
  firstName: string;
  displayName: string;
};

function firstNameFrom(value: string | null | undefined) {
  if (!value) return "";
  return value.trim().split(/\s+/)[0] ?? "";
}

export function useAuthUser() {
  const [auth, setAuth] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user ?? null;

      if (!active) return;

      if (!user) {
        setAuth(null);
        setLoading(false);
        return;
      }

      const [{ data: profile }, { data: membership }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase
          .from("store_members")
          .select("store_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle(),
      ]);

      if (!active) return;

      const metaName =
        (user.user_metadata?.full_name as string | undefined) ||
        (user.user_metadata?.name as string | undefined) ||
        null;
      const displayName =
        (profile as Profile | null)?.full_name ||
        metaName ||
        user.email?.split("@")[0] ||
        "there";
      const firstName = firstNameFrom(displayName) || "there";

      setAuth({
        user,
        profile: (profile as Profile | null) ?? null,
        hasStore: !!membership,
        firstName,
        displayName,
      });
      setLoading(false);
    }

    load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return { auth, loading };
}
