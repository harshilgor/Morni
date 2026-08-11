-- Keep one public checkout RPC signature after adding delivery_phone.
-- create or replace cannot change a function's input signature, so the first
-- phone migration left the old 13-argument function alongside the new one.
alter function public.place_order_with_items(
  uuid, public.payment_method, numeric, numeric, numeric, public.uae_emirate,
  text, text, text, text, text, integer, jsonb
) rename to place_order_with_items_without_phone;

drop function if exists public.place_order_with_items(
  uuid, public.payment_method, numeric, numeric, numeric, public.uae_emirate,
  text, text, text, text, text, text, integer, jsonb
);

create function public.place_order_with_items(
  p_store_id uuid,
  p_payment_method public.payment_method,
  p_subtotal_aed numeric,
  p_delivery_fee_aed numeric,
  p_total_aed numeric,
  p_delivery_emirate public.uae_emirate,
  p_delivery_area text,
  p_delivery_street text,
  p_delivery_building text,
  p_delivery_apartment text,
  p_delivery_notes text,
  p_delivery_phone text,
  p_delivery_eta_minutes integer,
  p_items jsonb
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
begin
  select * into v_order
  from public.place_order_with_items_without_phone(
    p_store_id,
    p_payment_method,
    p_subtotal_aed,
    p_delivery_fee_aed,
    p_total_aed,
    p_delivery_emirate,
    p_delivery_area,
    p_delivery_street,
    p_delivery_building,
    p_delivery_apartment,
    p_delivery_notes,
    p_delivery_eta_minutes,
    p_items
  );

  update public.orders
  set delivery_phone = nullif(trim(p_delivery_phone), '')
  where id = v_order.id
  returning * into v_order;

  return v_order;
end;
$$;

-- The helper is only callable by the security-definer wrapper above.
revoke all on function public.place_order_with_items_without_phone(
  uuid, public.payment_method, numeric, numeric, numeric, public.uae_emirate,
  text, text, text, text, text, integer, jsonb
) from public, anon, authenticated;

revoke all on function public.place_order_with_items(
  uuid, public.payment_method, numeric, numeric, numeric, public.uae_emirate,
  text, text, text, text, text, text, integer, jsonb
) from public;

grant execute on function public.place_order_with_items(
  uuid, public.payment_method, numeric, numeric, numeric, public.uae_emirate,
  text, text, text, text, text, text, integer, jsonb
) to authenticated;
