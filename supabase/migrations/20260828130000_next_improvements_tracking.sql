-- Customer-safe delivery tracking payload. The shopper can see only their own
-- order's dispatch state and the assigned driver's latest location.
create or replace function public.shopper_order_delivery_tracking(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_job public.delivery_jobs;
  v_driver public.delivery_drivers;
begin
  select * into v_order
  from public.orders
  where id = p_order_id and shopper_id = auth.uid();
  if not found then
    raise exception 'Order not found.';
  end if;

  select * into v_job
  from public.delivery_jobs
  where order_id = p_order_id;

  if v_job.id is null then
    return jsonb_build_object('status', null, 'driver_name', null, 'last_lat', null, 'last_lng', null, 'last_location_at', null, 'eta_minutes', v_order.delivery_eta_minutes);
  end if;

  if v_job.driver_id is not null then
    select * into v_driver from public.delivery_drivers where id = v_job.driver_id;
  end if;

  return jsonb_build_object(
    'status', v_job.status,
    'driver_name', v_driver.display_name,
    'last_lat', v_driver.last_lat,
    'last_lng', v_driver.last_lng,
    'last_location_at', v_driver.last_location_at,
    'eta_minutes', v_order.delivery_eta_minutes,
    'accepted_at', v_job.accepted_at,
    'updated_at', v_job.updated_at
  );
end;
$$;

revoke all on function public.shopper_order_delivery_tracking(uuid) from public, anon;
grant execute on function public.shopper_order_delivery_tracking(uuid) to authenticated;
