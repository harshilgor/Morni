"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Store } from "@/lib/types";

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
    refresh();
  }, []);

  return { store, loading, error, userId, refresh };
}
