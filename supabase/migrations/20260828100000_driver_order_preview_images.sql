-- Include the immutable order-item image snapshots in rider offers so the
-- driver can see what the parcel should contain before accepting it.
create or replace function public.driver_delivery_workspace_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_driver public.delivery_drivers;
  v_partner public.delivery_partners;
begin
  select * into v_driver from public.delivery_drivers where user_id = auth.uid();
  if not found then raise exception 'Driver workspace access is restricted.'; end if;
  select * into v_partner from public.delivery_partners where id = v_driver.partner_id;

  return jsonb_build_object(
    'driver', jsonb_build_object(
      'id', v_driver.id, 'display_name', v_driver.display_name, 'availability', v_driver.availability,
      'is_active', v_driver.is_active, 'last_lat', v_driver.last_lat, 'last_lng', v_driver.last_lng,
      'last_location_at', v_driver.last_location_at
    ),
    'partner', jsonb_build_object('name', v_partner.name, 'support_email', v_partner.support_email),
    'jobs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', job.id, 'status', job.status, 'assignment_expires_at', job.assignment_expires_at,
        'order_number', order_row.order_number, 'store_name', store.name, 'store_address', store.address,
        'store_lat', store.lat, 'store_lng', store.lng, 'delivery_street', order_row.delivery_street,
        'delivery_building', order_row.delivery_building, 'delivery_apartment', order_row.delivery_apartment,
        'delivery_area', order_row.delivery_area, 'delivery_emirate', order_row.delivery_emirate,
        'delivery_notes', order_row.delivery_notes, 'delivery_phone', coalesce(order_row.delivery_phone, shopper.phone),
        'delivery_eta_minutes', order_row.delivery_eta_minutes,
        'item_count', coalesce((select sum(item.quantity)::int from public.order_items item where item.order_id = order_row.id), 0),
        'bag_summary', (select string_agg(item.title || ' ×' || item.quantity, ', ' order by item.title) from public.order_items item where item.order_id = order_row.id),
        'item_image_urls', coalesce((select jsonb_agg(item.image_url order by item.id) from public.order_items item where item.order_id = order_row.id and item.image_url is not null), '[]'::jsonb),
        'pickup_handoff_status', (select handoff.status from public.delivery_handoffs handoff where handoff.delivery_job_id = job.id and handoff.handoff_type = 'pickup'),
        'delivery_handoff_status', (select handoff.status from public.delivery_handoffs handoff where handoff.delivery_job_id = job.id and handoff.handoff_type = 'delivery'),
        'proof_count', (select count(*)::int from public.delivery_proofs proof where proof.delivery_job_id = job.id)
      ) order by (job.status = 'unassigned') desc, job.updated_at desc)
      from public.delivery_jobs job
      join public.orders order_row on order_row.id = job.order_id
      join public.stores store on store.id = order_row.store_id
      left join public.profiles shopper on shopper.id = order_row.shopper_id
      where (job.driver_id = v_driver.id and job.status in ('assigned', 'accepted', 'at_pickup', 'collected'))
         or (job.driver_id is null and job.status = 'unassigned')
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', history_job.id, 'status', history_job.status, 'order_number', order_row.order_number,
        'store_name', store.name, 'delivery_area', order_row.delivery_area, 'delivered_at', history_job.delivered_at,
        'failed_at', history_job.failed_at, 'failure_reason', history_job.failure_reason, 'updated_at', history_job.updated_at
      ) order by history_job.updated_at desc)
      from public.delivery_jobs history_job
      join public.orders order_row on order_row.id = history_job.order_id
      join public.stores store on store.id = order_row.store_id
      where history_job.driver_id = v_driver.id and history_job.status in ('delivered', 'failed', 'cancelled')
        and history_job.updated_at >= now() - interval '30 days'
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.driver_delivery_workspace_data() from public, anon;
grant execute on function public.driver_delivery_workspace_data() to authenticated, service_role;
