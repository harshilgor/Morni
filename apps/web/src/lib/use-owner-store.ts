"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Store } from "@/lib/types";

export function isOnboardingComplete(store: Store | null | undefined) {
  if (!store) return false;
  return Boolean(store.onboarding_completed_at);
}

export function getResumeOnboardingStep(store: Store | null | undefined) {
  if (!store) return 1;
  if (isOnboardingComplete(store)) return 5;
  return Math.min(5, Math.max(1, store.onboarding_step || 1));
}

export function useOwnerStore() {
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("unauthenticated");
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const { data: membership } = await supabase
      .from("store_members")
      .select("store_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!membership) {
      setStore(null);
      setLoading(false);
      return;
    }

    const { data: storeData } = await supabase
      .from("stores")
      .select("*")
      .eq("id", membership.store_id)
      .single();

    setStore((storeData as Store) ?? null);
    setLoading(false);
  }

  useEffect(() => {
    const run = () => {
      void refresh();
    };
    if (typeof queueMicrotask === "function") queueMicrotask(run);
    else window.setTimeout(run, 0);
  }, []);

  const onboardingComplete = isOnboardingComplete(store);
  const resumeStep = getResumeOnboardingStep(store);

  return {
    store,
    loading,
    error,
    userId,
    refresh,
    onboardingComplete,
    resumeStep,
  };
}
