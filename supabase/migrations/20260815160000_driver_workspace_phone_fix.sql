-- The rider workspace query referenced orders.delivery_phone, which does not
-- exist. The contact number lives on the shopper profile.
create or replace function public.driver_delivery_workspace_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
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
      'delivery_notes', order_row.delivery_notes, 'delivery_phone', shopper.phone
    ) order by job.updated_at desc)
      from public.delivery_jobs job
      join public.orders order_row on order_row.id = job.order_id
      join public.stores store on store.id = order_row.store_id
      left join public.profiles shopper on shopper.id = order_row.shopper_id
      where job.driver_id = v_driver.id and job.status in ('assigned', 'accepted', 'at_pickup', 'collected')), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.driver_delivery_workspace_data() from public, anon;
grant execute on function public.driver_delivery_workspace_data() to authenticated;
