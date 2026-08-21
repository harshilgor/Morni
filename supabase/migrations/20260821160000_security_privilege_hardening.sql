-- Tighten SECURITY DEFINER EXECUTE grants and trigger search_path.
-- RLS helpers used by public catalog policies keep authenticated (+ anon where required).
-- Internal pricing helpers and trigger funcs are service_role / owner only.

create or replace function public.touch_order_payments_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.touch_order_payments_updated_at() from public, anon, authenticated;

-- Pricing is computed only inside service_role checkout — never via PostgREST.
revoke all on function public.sale_price_for_product(uuid, numeric) from public, anon, authenticated;
grant execute on function public.sale_price_for_product(uuid, numeric) to service_role;

-- Delivery / admin helpers are not needed for anonymous storefront reads.
revoke execute on function public.is_morni_admin() from public, anon;
revoke execute on function public.is_delivery_partner_operator(uuid) from public, anon;
revoke execute on function public.current_delivery_driver_id() from public, anon;
grant execute on function public.is_morni_admin() to authenticated, service_role;
grant execute on function public.is_delivery_partner_operator(uuid) to authenticated, service_role;
grant execute on function public.current_delivery_driver_id() to authenticated, service_role;

-- Review helpers are only evaluated for signed-in writers / triggers.
revoke execute on function public.shopper_can_review_product(uuid, uuid) from public, anon;
revoke execute on function public.product_review_order_item_matches(uuid, uuid, uuid) from public, anon;
grant execute on function public.shopper_can_review_product(uuid, uuid) to authenticated, service_role;
grant execute on function public.product_review_order_item_matches(uuid, uuid, uuid) to authenticated, service_role;

-- Keep is_store_member executable by anon: public store/product RLS policies call it.
revoke all on function public.is_store_member(uuid) from public;
grant execute on function public.is_store_member(uuid) to anon, authenticated, service_role;

-- Intentional client RPCs: drop PUBLIC, keep authenticated (+ service_role).
revoke all on function public.accept_delivery_job(uuid) from public, anon;
revoke all on function public.advance_delivery_job(uuid, public.delivery_job_status, text) from public, anon;
revoke all on function public.claim_delivery_partner_owner_access() from public, anon;
revoke all on function public.create_delivery_partner(text, text) from public, anon;
revoke all on function public.create_delivery_partner_invite(uuid, text, public.delivery_invite_role) from public, anon;
revoke all on function public.create_owned_store(
  text, text, text, public.uae_emirate, text, text, double precision, double precision,
  integer, time without time zone, time without time zone
) from public, anon;
revoke all on function public.decline_delivery_job(uuid, text) from public, anon;
revoke all on function public.delete_delivery_partner(uuid) from public, anon;
revoke all on function public.delete_owned_store(uuid) from public, anon;
revoke all on function public.driver_delivery_workspace_data() from public, anon;
revoke all on function public.founder_delivery_workspace_data() from public, anon;
revoke all on function public.founder_workspace_data(integer) from public, anon;
revoke all on function public.launch_owned_store(uuid) from public, anon;
revoke all on function public.partner_delivery_workspace_data() from public, anon;
revoke all on function public.redeem_delivery_partner_invite(text) from public, anon;
revoke all on function public.save_product_sale(
  uuid, text, text, numeric, timestamptz, timestamptz, uuid[], uuid[]
) from public, anon;
revoke all on function public.set_delivery_driver_availability(
  public.delivery_driver_availability, double precision, double precision
) from public, anon;
revoke all on function public.update_delivery_partner(uuid, boolean, boolean) from public, anon;

grant execute on function public.accept_delivery_job(uuid) to authenticated, service_role;
grant execute on function public.advance_delivery_job(uuid, public.delivery_job_status, text) to authenticated, service_role;
grant execute on function public.claim_delivery_partner_owner_access() to authenticated, service_role;
grant execute on function public.create_delivery_partner(text, text) to authenticated, service_role;
grant execute on function public.create_delivery_partner_invite(uuid, text, public.delivery_invite_role) to authenticated, service_role;
grant execute on function public.create_owned_store(
  text, text, text, public.uae_emirate, text, text, double precision, double precision,
  integer, time without time zone, time without time zone
) to authenticated, service_role;
grant execute on function public.decline_delivery_job(uuid, text) to authenticated, service_role;
grant execute on function public.delete_delivery_partner(uuid) to authenticated, service_role;
grant execute on function public.delete_owned_store(uuid) to authenticated, service_role;
grant execute on function public.driver_delivery_workspace_data() to authenticated, service_role;
grant execute on function public.founder_delivery_workspace_data() to authenticated, service_role;
grant execute on function public.founder_workspace_data(integer) to authenticated, service_role;
grant execute on function public.launch_owned_store(uuid) to authenticated, service_role;
grant execute on function public.partner_delivery_workspace_data() to authenticated, service_role;
grant execute on function public.redeem_delivery_partner_invite(text) to authenticated, service_role;
grant execute on function public.save_product_sale(
  uuid, text, text, numeric, timestamptz, timestamptz, uuid[], uuid[]
) to authenticated, service_role;
grant execute on function public.set_delivery_driver_availability(
  public.delivery_driver_availability, double precision, double precision
) to authenticated, service_role;
grant execute on function public.update_delivery_partner(uuid, boolean, boolean) to authenticated, service_role;
