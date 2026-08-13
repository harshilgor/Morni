-- Close the remaining legacy checkout RPC signature and make trigger function
-- resolution deterministic for the Supabase security advisor.

do $$
begin
  if to_regprocedure(
    'public.place_order_with_items(uuid, public.payment_method, numeric, numeric, numeric, public.uae_emirate, text, text, text, text, text, integer, jsonb)'
  ) is not null then
    revoke all on function public.place_order_with_items(
      uuid, public.payment_method, numeric, numeric, numeric, public.uae_emirate,
      text, text, text, text, text, integer, jsonb
    ) from public, anon, authenticated;
  end if;
end;
$$;

alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.generate_order_number() set search_path = public, pg_temp;
alter function public.product_reviews_owner_reply_timestamp() set search_path = public, pg_temp;
