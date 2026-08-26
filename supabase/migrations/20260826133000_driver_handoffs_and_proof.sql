-- Driver handoffs and proof of delivery.
-- The rider starts each handoff; the store owner/customer supplies the code.

create table public.delivery_handoffs (
  id uuid primary key default gen_random_uuid(),
  delivery_job_id uuid not null references public.delivery_jobs(id) on delete cascade,
  handoff_type text not null check (handoff_type in ('pickup', 'delivery')),
  otp_code text not null check (otp_code ~ '^[0-9]{6}$'),
  otp_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'verified', 'expired')),
  requested_at timestamptz not null default now(),
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (delivery_job_id, handoff_type)
);

create table public.delivery_proofs (
  id uuid primary key default gen_random_uuid(),
  delivery_job_id uuid not null references public.delivery_jobs(id) on delete cascade,
  storage_path text not null unique,
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  captured_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index delivery_handoffs_job_type_idx on public.delivery_handoffs (delivery_job_id, handoff_type, status);
create index delivery_proofs_job_idx on public.delivery_proofs (delivery_job_id, created_at desc);

alter table public.delivery_handoffs enable row level security;
alter table public.delivery_proofs enable row level security;

create policy "delivery_proofs_read" on public.delivery_proofs for select using (
  captured_by = auth.uid()
  or exists (
    select 1
    from public.delivery_jobs job
    join public.orders order_row on order_row.id = job.order_id
    where job.id = delivery_proofs.delivery_job_id
      and (
        job.driver_id = public.current_delivery_driver_id()
        or public.is_store_member(order_row.store_id)
        or order_row.shopper_id = auth.uid()
      )
  )
);

create policy "delivery_proofs_driver_insert" on public.delivery_proofs for insert with check (
  captured_by = auth.uid()
  and exists (
    select 1 from public.delivery_jobs job
    where job.id = delivery_proofs.delivery_job_id
      and job.driver_id = public.current_delivery_driver_id()
      and job.status = 'collected'
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('delivery-proofs', 'delivery-proofs', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 8388608, allowed_mime_types = excluded.allowed_mime_types;

create policy "delivery_proofs_storage_read" on storage.objects for select using (
  bucket_id = 'delivery-proofs'
  and exists (
    select 1
    from public.delivery_proofs proof
    join public.delivery_jobs job on job.id = proof.delivery_job_id
    join public.orders order_row on order_row.id = job.order_id
    where proof.storage_path = storage.objects.name
      and (
        job.driver_id = public.current_delivery_driver_id()
        or public.is_store_member(order_row.store_id)
        or order_row.shopper_id = auth.uid()
      )
  )
);

create policy "delivery_proofs_storage_driver_upload" on storage.objects for insert with check (
  bucket_id = 'delivery-proofs'
  and auth.role() = 'authenticated'
  and exists (
    select 1 from public.delivery_jobs job
    where job.id = (storage.foldername(storage.objects.name))[1]::uuid
      and job.driver_id = public.current_delivery_driver_id()
      and job.status = 'collected'
  )
);

create or replace function public.request_delivery_handoff(
  p_delivery_job_id uuid,
  p_handoff_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_driver_id uuid := public.current_delivery_driver_id();
  v_job public.delivery_jobs;
  v_handoff public.delivery_handoffs;
  v_code text;
begin
  if v_driver_id is null then raise exception 'No rider profile is linked to this account.'; end if;
  if p_handoff_type not in ('pickup', 'delivery') then raise exception 'Invalid delivery handoff.'; end if;

  select * into v_job from public.delivery_jobs where id = p_delivery_job_id and driver_id = v_driver_id for update;
  if not found then raise exception 'This delivery is not assigned to you.'; end if;
  if (p_handoff_type = 'pickup' and v_job.status <> 'at_pickup')
     or (p_handoff_type = 'delivery' and v_job.status <> 'collected') then
    raise exception 'This handoff is not available at the current delivery step.';
  end if;

  select * into v_handoff
  from public.delivery_handoffs
  where delivery_job_id = p_delivery_job_id and handoff_type = p_handoff_type
  for update;
  if found and v_handoff.status = 'pending' then
    return jsonb_build_object('id', v_handoff.id, 'handoff_type', v_handoff.handoff_type, 'status', v_handoff.status);
  end if;

  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  insert into public.delivery_handoffs (delivery_job_id, handoff_type, otp_code, otp_hash)
  values (p_delivery_job_id, p_handoff_type, v_code, encode(digest(v_code, 'sha256'), 'hex'))
  on conflict (delivery_job_id, handoff_type) do update
    set otp_code = excluded.otp_code, otp_hash = excluded.otp_hash, status = 'pending', requested_at = now(), verified_at = null, verified_by = null
  returning * into v_handoff;

  insert into public.delivery_events (delivery_job_id, event_type, actor_user_id, note)
  values (p_delivery_job_id, p_handoff_type || '_handoff_requested', auth.uid(), 'A verification code was requested for this handoff.');
  return jsonb_build_object('id', v_handoff.id, 'handoff_type', v_handoff.handoff_type, 'status', v_handoff.status);
end;
$$;

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

  update public.delivery_handoffs set status = 'verified', verified_at = now(), verified_by = auth.uid() where id = v_handoff.id;
  if p_handoff_type = 'pickup' then
    if v_job.status <> 'at_pickup' then raise exception 'The pickup handoff is no longer available.'; end if;
    update public.delivery_jobs set status = 'collected', collected_at = now() where id = v_job.id returning * into v_job;
    update public.orders set status = 'out_for_delivery' where id = v_job.order_id and status = 'picking';
  elsif p_handoff_type = 'delivery' then
    if v_job.status <> 'collected' then raise exception 'The delivery handoff is no longer available.'; end if;
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

create or replace function public.store_delivery_handoff(p_delivery_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_handoff public.delivery_handoffs;
  v_store_id uuid;
begin
  select order_row.store_id into v_store_id
  from public.delivery_jobs job
  join public.orders order_row on order_row.id = job.order_id
  where job.id = p_delivery_job_id;
  if v_store_id is null or not public.is_store_member(v_store_id) then raise exception 'Store access is restricted.'; end if;
  select * into v_handoff from public.delivery_handoffs where delivery_job_id = p_delivery_job_id and handoff_type = 'pickup';
  if not found then return jsonb_build_object('status', 'not_requested'); end if;
  return jsonb_build_object('id', v_handoff.id, 'status', v_handoff.status, 'otp_code', v_handoff.otp_code, 'requested_at', v_handoff.requested_at, 'verified_at', v_handoff.verified_at);
end;
$$;

create or replace function public.shopper_delivery_handoff_code(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_handoff public.delivery_handoffs;
begin
  select handoff.* into v_handoff
  from public.delivery_jobs job
  join public.orders order_row on order_row.id = job.order_id
  join public.delivery_handoffs handoff on handoff.delivery_job_id = job.id
  where order_row.id = p_order_id and order_row.shopper_id = auth.uid() and handoff.handoff_type = 'delivery' and handoff.status = 'pending';
  if not found then return jsonb_build_object('status', 'not_requested'); end if;
  return jsonb_build_object('id', v_handoff.id, 'status', v_handoff.status, 'otp_code', v_handoff.otp_code, 'requested_at', v_handoff.requested_at);
end;
$$;

-- Enforce proof + verified delivery handoff when the rider attempts the final step.
create or replace function public.advance_delivery_job(
  p_delivery_job_id uuid,
  p_status public.delivery_job_status,
  p_note text default null
)
returns public.delivery_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_driver_id uuid := public.current_delivery_driver_id();
  v_job public.delivery_jobs;
begin
  if v_driver_id is null then raise exception 'No rider profile is linked to this account.'; end if;
  select * into v_job from public.delivery_jobs where id = p_delivery_job_id for update;
  if not found or v_job.driver_id <> v_driver_id then raise exception 'This delivery is not assigned to you.'; end if;
  if not ((v_job.status = 'accepted' and p_status = 'at_pickup') or (v_job.status = 'at_pickup' and p_status = 'collected') or (v_job.status = 'collected' and p_status in ('delivered', 'failed'))) then
    raise exception 'This delivery status transition is not available.';
  end if;
  if p_status = 'collected' then raise exception 'Verify the pickup handoff before collecting this order.'; end if;
  if p_status = 'delivered' then raise exception 'Verify the delivery handoff before completing this order.'; end if;

  update public.delivery_jobs
  set status = p_status,
      at_pickup_at = case when p_status = 'at_pickup' then now() else at_pickup_at end,
      failed_at = case when p_status = 'failed' then now() else failed_at end,
      failure_reason = case when p_status = 'failed' then nullif(trim(p_note), '') else failure_reason end
  where id = v_job.id returning * into v_job;
  if p_status = 'failed' then update public.delivery_drivers set availability = 'available' where id = v_driver_id; end if;
  insert into public.delivery_events (delivery_job_id, event_type, actor_user_id, note)
  values (v_job.id, p_status::text, auth.uid(), nullif(trim(p_note), ''));
  return v_job;
end;
$$;

revoke all on function public.request_delivery_handoff(uuid, text) from public, anon;
revoke all on function public.verify_delivery_handoff(uuid, text, text) from public, anon;
revoke all on function public.store_delivery_handoff(uuid) from public, anon;
revoke all on function public.shopper_delivery_handoff_code(uuid) from public, anon;
grant execute on function public.request_delivery_handoff(uuid, text) to authenticated;
grant execute on function public.verify_delivery_handoff(uuid, text, text) to authenticated;
grant execute on function public.store_delivery_handoff(uuid) to authenticated;
grant execute on function public.shopper_delivery_handoff_code(uuid) to authenticated;
grant execute on function public.advance_delivery_job(uuid, public.delivery_job_status, text) to authenticated;
