-- Broadcast ready delivery jobs to every active rider. The first rider to
-- accept claims the row under a lock; no location-based pre-allocation.

create or replace function public.assign_delivery_job(p_delivery_job_id uuid)
returns public.delivery_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.delivery_jobs;
begin
  select * into v_job from public.delivery_jobs where id = p_delivery_job_id for update;
  if not found then raise exception 'Delivery job not found.'; end if;

  -- Open offers remain visible to every rider. This function only cleans up
  -- legacy timed assignments so old jobs can safely enter the open queue.
  if v_job.status = 'assigned' and v_job.assignment_expires_at is not null and v_job.assignment_expires_at <= now() then
    update public.delivery_drivers
    set availability = 'available'
    where id = v_job.driver_id and availability = 'assigned';
    update public.delivery_assignments
    set outcome = 'expired', responded_at = now()
    where delivery_job_id = v_job.id and driver_id = v_job.driver_id and outcome = 'assigned';
    update public.delivery_jobs
    set partner_id = null, driver_id = null, status = 'unassigned', assignment_expires_at = null
    where id = v_job.id
    returning * into v_job;
    insert into public.delivery_events (delivery_job_id, event_type, note)
    values (v_job.id, 'assignment_expired', 'The delivery returned to the open rider offer queue.');
  end if;
  return v_job;
end;
$$;

create or replace function public.queue_order_for_delivery(p_order_id uuid)
returns public.delivery_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_job public.delivery_jobs;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if v_order.status <> 'picking' then
    raise exception 'Only an order being prepared can be marked ready for pickup.';
  end if;

  select * into v_job from public.delivery_jobs where order_id = p_order_id;
  if found then return v_job; end if;

  insert into public.delivery_jobs (order_id)
  values (p_order_id)
  returning * into v_job;
  insert into public.delivery_events (delivery_job_id, event_type, note)
  values (v_job.id, 'ready_for_pickup', 'The order is open to every active rider.');
  return v_job;
end;
$$;

create or replace function public.accept_delivery_job(p_delivery_job_id uuid)
returns public.delivery_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_driver_id uuid := public.current_delivery_driver_id();
  v_partner_id uuid;
  v_job public.delivery_jobs;
begin
  if v_driver_id is null then raise exception 'No rider profile is linked to this account.'; end if;
  if not exists (select 1 from public.delivery_drivers where id = v_driver_id and is_active) then
    raise exception 'This rider account is inactive.';
  end if;

  select * into v_job from public.delivery_jobs where id = p_delivery_job_id for update;
  if not found or v_job.status in ('accepted', 'at_pickup', 'collected', 'delivered', 'failed', 'cancelled') then
    raise exception 'This delivery is no longer available to accept.';
  end if;
  if exists (
    select 1 from public.delivery_jobs current_job
    where current_job.driver_id = v_driver_id
      and current_job.status in ('assigned', 'accepted', 'at_pickup', 'collected')
      and current_job.id <> v_job.id
  ) then
    raise exception 'Finish the current delivery before accepting another one.';
  end if;

  -- Legacy assigned jobs remain claimable only by their intended rider.
  if v_job.status = 'assigned' and v_job.driver_id <> v_driver_id then
    raise exception 'This delivery is no longer available to accept.';
  end if;

  select partner_id into v_partner_id from public.delivery_drivers where id = v_driver_id;
  update public.delivery_drivers set availability = 'assigned' where id = v_driver_id;
  update public.delivery_jobs
  set partner_id = v_partner_id,
      driver_id = v_driver_id,
      status = 'accepted',
      dispatch_attempts = dispatch_attempts + 1,
      assigned_at = coalesce(assigned_at, now()),
      accepted_at = now(),
      assignment_expires_at = null,
      failure_reason = null
  where id = v_job.id
  returning * into v_job;

  insert into public.delivery_assignments (delivery_job_id, driver_id, outcome, responded_at)
  values (v_job.id, v_driver_id, 'accepted', now());
  insert into public.delivery_events (delivery_job_id, event_type, actor_user_id, note)
  values (v_job.id, 'driver_accepted', auth.uid(), 'The first rider to accept claimed this delivery.');
  return v_job;
end;
$$;

-- Every authenticated rider receives open offers in the workspace payload.
create or replace function public.driver_delivery_workspace_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
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

revoke all on function public.assign_delivery_job(uuid) from public, anon, authenticated;
revoke all on function public.queue_order_for_delivery(uuid) from public, anon, authenticated;
revoke all on function public.accept_delivery_job(uuid) from public, anon;
revoke all on function public.driver_delivery_workspace_data() from public, anon;
grant execute on function public.accept_delivery_job(uuid) to authenticated, service_role;
grant execute on function public.driver_delivery_workspace_data() to authenticated, service_role;
