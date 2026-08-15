import { HomeStores } from "@/components/home-stores";
import { createClient } from "@/lib/supabase/server";
import type { Store } from "@/lib/types";

export default async function StoresPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("stores")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  return <HomeStores stores={(data ?? []) as Store[]} layout="grid" />;
}
