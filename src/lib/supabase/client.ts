import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/**
 * Realtime channels are cached by topic on the browser client. A component
 * can briefly mount twice during responsive layout changes or React cleanup,
 * so each effect instance needs its own topic to avoid reusing a subscribed
 * channel while the previous one is being removed.
 */
export function createRealtimeChannelName(prefix: string, scope: string) {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${scope}-${suffix}`;
}
