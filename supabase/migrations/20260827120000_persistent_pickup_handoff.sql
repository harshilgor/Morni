-- A pickup code belongs to a delivery job from the moment a store marks the
-- order ready.  This keeps the store's handoff screen stable across refreshes
-- and means the rider can enter the code as soon as they reach the store.

create or replace function public.queue_order_for_delivery(p_order_id uuid)
returns public.delivery_jobs
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_order public.orders;
  v_job public.delivery_jobs;
  v_code text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;

  -- This makes a retry after a slow/lost response safe: the existing ready
  -- job is returned rather than sending the store owner back a workflow step.
  select * into v_job from public.delivery_jobs where order_id = p_order_id for update;
  if found then
    if not exists (
      select 1 from public.delivery_handoffs
      where delivery_job_id = v_job.id and handoff_type = 'pickup'
    ) then
      v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
      insert into public.delivery_handoffs (delivery_job_id, handoff_type, otp_code, otp_hash)
      values (v_job.id, 'pickup', v_code, encode(digest(v_code, 'sha256'), 'hex'));
    end if;
    return v_job;
  end if;

  if v_order.status <> 'picking' then
    raise exception 'Only an order being prepared can be marked ready for pickup.';
  end if;

  insert into public.delivery_jobs (order_id) values (p_order_id) returning * into v_job;
  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  insert into public.delivery_handoffs (delivery_job_id, handoff_type, otp_code, otp_hash)
  values (v_job.id, 'pickup', v_code, encode(digest(v_code, 'sha256'), 'hex'));
  insert into public.delivery_events (delivery_job_id, event_type, note)
  values (v_job.id, 'ready_for_pickup', 'The store marked this order ready and a pickup code was generated.');
  return v_job;
end;
$$;

-- The rider photographs the parcel at collection, before the pickup handoff
-- is verified. Both the object upload and proof record policies must allow it.
drop policy if exists "delivery_proofs_driver_insert" on public.delivery_proofs;
create policy "delivery_proofs_driver_insert" on public.delivery_proofs for insert with check (
  captured_by = auth.uid()
  and exists (
    select 1 from public.delivery_jobs job
    where job.id = delivery_proofs.delivery_job_id
      and job.driver_id = public.current_delivery_driver_id()
      and job.status in ('at_pickup', 'collected')
  )
);

drop policy if exists "delivery_proofs_storage_driver_upload" on storage.objects;
create policy "delivery_proofs_storage_driver_upload" on storage.objects for insert with check (
  bucket_id = 'delivery-proofs'
  and auth.role() = 'authenticated'
  and exists (
    select 1 from public.delivery_jobs job
    where job.id = (storage.foldername(storage.objects.name))[1]::uuid
      and job.driver_id = public.current_delivery_driver_id()
      and job.status in ('at_pickup', 'collected')
  )
);

-- Pickup cannot be completed until a parcel photo exists. This turns the UI
-- requirement into an end-to-end invariant rather than a best-effort prompt.
create or replace function public.verify_delivery_handoff(
  p_delivery_job_id uuid,
  p_handoff_type text,
  p_code text
)
returns public.delivery_jobs
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_driver_id uuid := public.current_delivery_driver_id();
  v_job public.delivery_jobs;
  v_handoff public.delivery_handoffs;
begin
  if v_driver_id is null then raise exception 'No rider profile is linked to this account.'; end if;
  select * into v_job from public.delivery_jobs where id = p_delivery_job_id and driver_id = v_driver_id for update;
  if not found then raise exception 'This delivery is not assigned to you.'; end if;
  select * into v_handoff from public.delivery_handoffs
  where delivery_job_id = p_delivery_job_id and handoff_type = p_handoff_type and status = 'pending'
  for update;
  if not found then raise exception 'Request a fresh handoff code first.'; end if;
  if encode(digest(trim(coalesce(p_code, '')), 'sha256'), 'hex') <> v_handoff.otp_hash then
    raise exception 'That verification code is not correct.';
  end if;

  if p_handoff_type = 'pickup' then
    if v_job.status <> 'at_pickup' then raise exception 'The pickup handoff is no longer available.'; end if;
    if not exists (select 1 from public.delivery_proofs where delivery_job_id = v_job.id) then
      raise exception 'Take a parcel photo before completing pickup.';
    end if;
    update public.delivery_handoffs set status = 'verified', verified_at = now(), verified_by = auth.uid() where id = v_handoff.id;
    update public.delivery_jobs set status = 'collected', collected_at = now() where id = v_job.id returning * into v_job;
    update public.orders set status = 'out_for_delivery' where id = v_job.order_id and status = 'picking';
  elsif p_handoff_type = 'delivery' then
    if v_job.status <> 'collected' then raise exception 'The delivery handoff is no longer available.'; end if;
    update public.delivery_handoffs set status = 'verified', verified_at = now(), verified_by = auth.uid() where id = v_handoff.id;
    update public.delivery_jobs set status = 'delivered', delivered_at = now() where id = v_job.id returning * into v_job;
    update public.orders set status = 'delivered' where id = v_job.order_id and status = 'out_for_delivery';
    update public.delivery_drivers set availability = 'available' where id = v_driver_id;
    update public.delivery_assignments set outcome = 'completed', responded_at = now()
    where delivery_job_id = v_job.id and driver_id = v_driver_id and outcome = 'accepted';
  else
    raise exception 'Invalid delivery handoff.';
  end if;

  insert into public.delivery_events (delivery_job_id, event_type, actor_user_id, note)
  values (v_job.id, p_handoff_type || '_handoff_verified', auth.uid(), 'The handoff verification code was accepted.');
  return v_job;
end;
$$;

revoke all on function public.queue_order_for_delivery(uuid) from public, anon, authenticated;
grant execute on function public.queue_order_for_delivery(uuid) to service_role;
revoke all on function public.verify_delivery_handoff(uuid, text, text) from public, anon;
grant execute on function public.verify_delivery_handoff(uuid, text, text) to authenticated;
