-- Supply coordinate and destination detail to the founder delivery control tower.
-- Access remains guarded by the existing security-definer admin RPC.
create or replace function public.founder_delivery_workspace_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_morni_admin() then
    raise exception 'Founder workspace access is restricted to Morni administrators.';
  end if;

  return jsonb_build_object(
    'metrics', jsonb_build_object(
      'active_jobs', (select count(*) from public.delivery_jobs where status in ('assigned', 'accepted', 'at_pickup', 'collected')),
      'waiting_jobs', (select count(*) from public.delivery_jobs where status = 'unassigned'),
      'exceptions', (select count(*) from public.delivery_jobs where status = 'failed' or (status = 'assigned' and assignment_expires_at < now())),
      'available_drivers', (select count(*) from public.delivery_drivers where is_active and availability = 'available')
    ),
    'partners', coalesce((select jsonb_agg(jsonb_build_object(
      'id', partner.id, 'name', partner.name, 'is_active', partner.is_active, 'auto_dispatch_enabled', partner.auto_dispatch_enabled,
      'total_drivers', (select count(*) from public.delivery_drivers driver where driver.partner_id = partner.id and driver.is_active),
      'available_drivers', (select count(*) from public.delivery_drivers driver where driver.partner_id = partner.id and driver.is_active and driver.availability = 'available'),
      'active_jobs', (select count(*) from public.delivery_jobs job where job.partner_id = partner.id and job.status in ('assigned', 'accepted', 'at_pickup', 'collected'))
    ) order by partner.dispatch_priority, partner.name) from public.delivery_partners partner), '[]'::jsonb),
    'drivers', coalesce((select jsonb_agg(jsonb_build_object(
      'id', driver.id, 'display_name', driver.display_name, 'partner_name', partner.name, 'availability', driver.availability,
      'is_active', driver.is_active, 'last_location_at', driver.last_location_at, 'last_lat', driver.last_lat, 'last_lng', driver.last_lng
    ) order by driver.updated_at desc) from public.delivery_drivers driver join public.delivery_partners partner on partner.id = driver.partner_id), '[]'::jsonb),
    'jobs', coalesce((select jsonb_agg(jsonb_build_object(
      'id', job.id, 'status', job.status, 'attempts', job.dispatch_attempts, 'ready_at', job.ready_for_pickup_at,
      'assigned_at', job.assigned_at, 'failure_reason', job.failure_reason, 'order_number', order_row.order_number,
      'store_name', store.name, 'store_lat', store.lat, 'store_lng', store.lng, 'pickup_area', store.area,
      'delivery_area', order_row.delivery_area, 'delivery_street', order_row.delivery_street,
      'delivery_building', order_row.delivery_building, 'delivery_apartment', order_row.delivery_apartment,
      'delivery_emirate', order_row.delivery_emirate, 'partner_name', partner.name, 'driver_name', driver.display_name
    ) order by job.updated_at desc)
      from public.delivery_jobs job
      join public.orders order_row on order_row.id = job.order_id
      join public.stores store on store.id = order_row.store_id
      left join public.delivery_partners partner on partner.id = job.partner_id
      left join public.delivery_drivers driver on driver.id = job.driver_id), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.founder_delivery_workspace_data() from public, anon;
grant execute on function public.founder_delivery_workspace_data() to authenticated, service_role;
