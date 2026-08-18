-- Remove the leftover 13-argument checkout RPC so PostgREST cannot pick
-- an unpaid/legacy overload instead of the current server-only function.

drop function if exists public.place_order_with_items(
  uuid, public.payment_method, numeric, numeric, numeric, public.uae_emirate,
  text, text, text, text, text, integer, jsonb
);

notify pgrst, 'reload schema';
