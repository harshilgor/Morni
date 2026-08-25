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

type AuthListener = (auth: AuthUser | null) => void;

// SiteHeader and account-level components are mounted together during client
// navigation. Share the result so opening Account does not repeat the same
// session, profile, and membership requests.
let cachedAuth: AuthUser | null | undefined;
let authLoad: Promise<AuthUser | null> | null = null;
let supabaseClient: ReturnType<typeof createClient> | null = null;
let authListenerStarted = false;
const authListeners = new Set<AuthListener>();

function getSupabaseClient() {
  if (!supabaseClient) supabaseClient = createClient();
  return supabaseClient;
}

function firstNameFrom(value: string | null | undefined) {
  if (!value) return "";
  return value.trim().split(/\s+/)[0] ?? "";
}

export function useAuthUser() {
  const [auth, setAuth] = useState<AuthUser | null>(() => cachedAuth ?? null);
  const [loading, setLoading] = useState(() => cachedAuth === undefined);

  useEffect(() => {
    let active = true;

    const listener: AuthListener = (nextAuth) => {
      if (!active) return;
      setAuth(nextAuth);
      setLoading(false);
    };
    authListeners.add(listener);
    startAuthListener();

    loadAuth().then(listener);

    return () => {
      active = false;
      authListeners.delete(listener);
    };
  }, []);

  return { auth, loading };
}

function startAuthListener() {
  if (authListenerStarted) return;
  authListenerStarted = true;

  getSupabaseClient().auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      publishAuth(null);
      return;
    }
    if (event === "SIGNED_IN" || event === "USER_UPDATED") {
      void loadAuth(true);
    }
  });
}

function publishAuth(nextAuth: AuthUser | null) {
  cachedAuth = nextAuth;
  authListeners.forEach((listener) => listener(nextAuth));
}

function loadAuth(force = false) {
  if (authLoad) return authLoad;
  if (!force && cachedAuth !== undefined) return Promise.resolve(cachedAuth);

  const supabase = getSupabaseClient();
  authLoad = (async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (!user) return null;

    const [{ data: profile }, { data: membership }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase
        .from("store_members")
        .select("store_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle(),
    ]);

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

    return {
      user,
      profile: (profile as Profile | null) ?? null,
      hasStore: !!membership,
      firstName,
      displayName,
    } satisfies AuthUser;
  })()
    .then((nextAuth) => {
      publishAuth(nextAuth);
      return nextAuth;
    })
    .finally(() => {
      authLoad = null;
    });

  return authLoad;
}
