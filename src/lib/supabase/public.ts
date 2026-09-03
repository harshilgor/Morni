import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cookie-free Supabase client for public catalog reads inside `use cache`.
 * Do not use for authenticated shopper/owner actions.
 */
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase public credentials are not configured.");
  }

  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
