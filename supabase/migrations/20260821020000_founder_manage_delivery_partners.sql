-- Founder admin controls for delivery partners: pause, toggle dispatch, delete.

create or replace function public.update_delivery_partner(
  p_partner_id uuid,
  p_is_active boolean default null,
  p_auto_dispatch_enabled boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_partner public.delivery_partners;
begin
  if not public.is_morni_admin() then
    raise exception 'Founder access is required.';
  end if;

  select * into v_partner
  from public.delivery_partners
  where id = p_partner_id
  for update;
  if not found then
    raise exception 'Delivery partner not found.';
  end if;

  update public.delivery_partners
  set
    is_active = coalesce(p_is_active, is_active),
    auto_dispatch_enabled = coalesce(p_auto_dispatch_enabled, auto_dispatch_enabled)
  where id = p_partner_id
  returning * into v_partner;

  -- Free waiting jobs so another partner can pick them up.
  if not v_partner.is_active or not v_partner.auto_dispatch_enabled then
    update public.delivery_jobs
    set partner_id = null
    where partner_id = p_partner_id
      and status = 'unassigned';

    update public.delivery_drivers
    set availability = 'offline'
    where partner_id = p_partner_id
      and availability in ('available', 'paused');
  end if;

  return jsonb_build_object(
    'id', v_partner.id,
    'name', v_partner.name,
    'is_active', v_partner.is_active,
    'auto_dispatch_enabled', v_partner.auto_dispatch_enabled
  );
end;
$$;

create or replace function public.delete_delivery_partner(p_partner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_partner public.delivery_partners;
  v_active_jobs integer;
begin
  if not public.is_morni_admin() then
    raise exception 'Founder access is required.';
  end if;

  select * into v_partner
  from public.delivery_partners
  where id = p_partner_id
  for update;
  if not found then
    raise exception 'Delivery partner not found.';
  end if;

  select count(*) into v_active_jobs
  from public.delivery_jobs
  where partner_id = p_partner_id
    and status in ('assigned', 'accepted', 'at_pickup', 'collected');

  if v_active_jobs > 0 then
    raise exception 'Finish or reassign active deliveries before deleting this partner.';
  end if;

  -- Release queued jobs before removing the company.
  update public.delivery_jobs
  set partner_id = null
  where partner_id = p_partner_id
    and status = 'unassigned';

  -- Assignment history blocks driver deletes (ON DELETE RESTRICT).
  delete from public.delivery_assignments
  where driver_id in (
    select id from public.delivery_drivers where partner_id = p_partner_id
  );

  delete from public.delivery_partners where id = p_partner_id;

  return jsonb_build_object('id', v_partner.id, 'name', v_partner.name, 'deleted', true);
end;
$$;

revoke all on function public.update_delivery_partner(uuid, boolean, boolean) from public, anon;
revoke all on function public.delete_delivery_partner(uuid) from public, anon;
grant execute on function public.update_delivery_partner(uuid, boolean, boolean) to authenticated;
grant execute on function public.delete_delivery_partner(uuid) to authenticated;
