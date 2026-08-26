-- Remove all seeded/fake historical orders before the RMT operation goes live.
-- The RMT guard intentionally aborts if the live database does not have exactly
-- one recognizable RMT store, so this cannot accidentally delete the wrong data.
do $$
declare
  v_rmt_count integer;
begin
  select count(*)::integer into v_rmt_count
  from public.stores
  where lower(trim(slug)) = 'rmt'
     or lower(regexp_replace(trim(name), '[^a-z0-9]+', '', 'g')) in ('rmt', 'realmagictrading', 'realmagictradingllc');

  if v_rmt_count <> 1 then
    raise exception 'RMT cleanup stopped: expected exactly one RMT store, found %.', v_rmt_count;
  end if;

  delete from public.orders;
end;
$$;

-- Prevent future delivery jobs from being created for another storefront.
create or replace function public.enforce_rmt_delivery_job()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.orders o
    join public.stores s on s.id = o.store_id
    where o.id = new.order_id and (
      lower(trim(s.slug)) = 'rmt'
      or lower(regexp_replace(trim(s.name), '[^a-z0-9]+', '', 'g')) in ('rmt', 'realmagictrading', 'realmagictradingllc')
    )
  ) then
    raise exception 'Delivery jobs are currently limited to RMT orders.';
  end if;
  return new;
end;
$$;

drop trigger if exists delivery_jobs_rmt_only on public.delivery_jobs;
create trigger delivery_jobs_rmt_only before insert on public.delivery_jobs
for each row execute function public.enforce_rmt_delivery_job();

-- Drivers should only receive current RMT delivery work and RMT delivery history.
create or replace function public.driver_delivery_workspace_data()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_driver public.delivery_drivers;
begin
  select * into v_driver from public.delivery_drivers where user_id = auth.uid();
  if not found then raise exception 'Driver workspace access is restricted.'; end if;
  return jsonb_build_object(
    'driver', jsonb_build_object('id', v_driver.id, 'display_name', v_driver.display_name, 'availability', v_driver.availability, 'is_active', v_driver.is_active),
    'jobs', coalesce((select jsonb_agg(jsonb_build_object(
      'id', job.id, 'status', job.status, 'assignment_expires_at', job.assignment_expires_at,
      'order_number', order_row.order_number, 'store_name', store.name, 'store_address', store.address,
      'delivery_street', order_row.delivery_street, 'delivery_building', order_row.delivery_building,
      'delivery_apartment', order_row.delivery_apartment, 'delivery_area', order_row.delivery_area,
      'delivery_notes', order_row.delivery_notes, 'delivery_phone', order_row.delivery_phone
    ) order by job.updated_at desc)
      from public.delivery_jobs job
      join public.orders order_row on order_row.id = job.order_id
      join public.stores store on store.id = order_row.store_id
      where job.driver_id = v_driver.id
        and job.status in ('assigned', 'accepted', 'at_pickup', 'collected')
        and (lower(trim(store.slug)) = 'rmt' or lower(regexp_replace(trim(store.name), '[^a-z0-9]+', '', 'g')) in ('rmt', 'realmagictrading', 'realmagictradingllc'))
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.driver_delivery_workspace_data() from public, anon;
grant execute on function public.driver_delivery_workspace_data() to authenticated;
