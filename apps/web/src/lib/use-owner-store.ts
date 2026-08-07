"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Store } from "@/lib/types";

const ACTIVE_STORE_KEY = "morni.owner.active-store-id";
const STORE_CHANGE_EVENT = "morni-owner-store-change";

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
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const refresh = useCallback(async (preferredStoreId?: string) => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("unauthenticated");
      setStore(null);
      setStores([]);
      setLoading(false);
      return;
    }

    setUserId(user.id);

    const { data: memberships, error: membershipError } = await supabase
      .from("store_members")
      .select("store_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (membershipError) {
      setError(membershipError.message);
      setStore(null);
      setStores([]);
      setLoading(false);
      return;
    }

    const storeIds = (memberships ?? []).map((membership) => membership.store_id);
    if (storeIds.length === 0) {
      setError(null);
      setStore(null);
      setStores([]);
      setLoading(false);
      return;
    }

    const { data: storeData, error: storeError } = await supabase
      .from("stores")
      .select("*")
      .in("id", storeIds)
      .order("created_at", { ascending: true });

    if (storeError) {
      setError(storeError.message);
      setStore(null);
      setStores([]);
      setLoading(false);
      return;
    }

    const ownerStores = (storeData as Store[]) ?? [];
    const persistedStoreId =
      preferredStoreId ??
      (typeof window === "undefined"
        ? null
        : window.localStorage.getItem(ACTIVE_STORE_KEY));
    const selectedStore =
      ownerStores.find((candidate) => candidate.id === persistedStoreId) ??
      ownerStores[0] ??
      null;

    if (selectedStore && typeof window !== "undefined") {
      window.localStorage.setItem(ACTIVE_STORE_KEY, selectedStore.id);
    }

    setError(null);
    setStores(ownerStores);
    setStore(selectedStore);
    setLoading(false);
  }, []);

  useEffect(() => {
    const start = () => {
      void refresh();
    };
    if (typeof queueMicrotask === "function") queueMicrotask(start);
    else window.setTimeout(start, 0);
  }, [refresh]);

  useEffect(() => {
    const handleStoreChange = () => {
      void refresh();
    };
    window.addEventListener(STORE_CHANGE_EVENT, handleStoreChange);
    return () => window.removeEventListener(STORE_CHANGE_EVENT, handleStoreChange);
  }, [refresh]);

  function selectStore(storeId: string) {
    const nextStore = stores.find((candidate) => candidate.id === storeId);
    if (!nextStore) return;
    window.localStorage.setItem(ACTIVE_STORE_KEY, storeId);
    setStore(nextStore);
    window.dispatchEvent(new Event(STORE_CHANGE_EVENT));
  }

  const onboardingComplete = isOnboardingComplete(store);
  const resumeStep = getResumeOnboardingStep(store);

  return {
    store,
    stores,
    loading,
    error,
    userId,
    refresh,
    selectStore,
    onboardingComplete,
    resumeStep,
  };
}
