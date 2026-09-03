"use client";

import { useEffect, useState } from "react";
import { createClient, createRealtimeChannelName } from "@/lib/supabase/client";

/** Keeps order-navigation badges in sync with orders awaiting acceptance. */
export function useNewOrderCount(storeId?: string, channelScope = "portal") {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (!storeId) {
        setCount(0);
        return;
      }
      void createClient()
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId)
        .eq("status", "placed")
        .then(({ count: nextCount }) => {
          if (active) setCount(nextCount ?? 0);
        });
    };
    window.queueMicrotask(refresh);
    if (!storeId) return () => { active = false; };

    const supabase = createClient();
    const channel = supabase
      .channel(createRealtimeChannelName(`portal-new-order-count-${channelScope}`, storeId))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
        () => window.queueMicrotask(refresh),
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [channelScope, storeId]);

  return count;
}
