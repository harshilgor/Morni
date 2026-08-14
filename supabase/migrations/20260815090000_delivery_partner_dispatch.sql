-- Delivery partner dispatch: automated rider assignment, partner isolation,
-- and a complete operational audit trail for the Morni founder workspace.

create type public.delivery_driver_availability as enum ('offline', 'available', 'assigned', 'paused');
create type public.delivery_job_status as enum ('unassigned', 'assigned', 'accepted', 'at_pickup', 'collected', 'delivered', 'failed', 'cancelled');
create type public.delivery_partner_member_role as enum ('owner', 'dispatcher');
create type public.delivery_invite_role as enum ('dispatcher', 'driver');

create table public.delivery_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  support_email text,
  is_active boolean not null default true,
  auto_dispatch_enabled boolean not null default true,
  service_emirates public.uae_emirate[] not null default array['dubai'::public.uae_emirate],
  dispatch_priority integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_partners_name_check check (char_length(trim(name)) between 2 and 120),
  constraint delivery_partners_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table public.delivery_partner_members (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.delivery_partners(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.delivery_partner_member_role not null default 'dispatcher',
  created_at timestamptz not null default now(),
  unique (partner_id, user_id)
);

create table public.delivery_drivers (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.delivery_partners(id) on delete cascade,
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  display_name text not null,
  phone text,
  is_active boolean not null default true,
  availability public.delivery_driver_availability not null default 'offline',
  capacity integer not null default 1 check (capacity between 1 and 4),
  last_lat double precision,
  last_lng double precision,
  last_location_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_drivers_coordinates_check check (
    (last_lat is null and last_lng is null) or
    (last_lat between -90 and 90 and last_lng between -180 and 180)
  )
);

create table public.delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  partner_id uuid references public.delivery_partners(id) on delete set null,
  driver_id uuid references public.delivery_drivers(id) on delete set null,
  status public.delivery_job_status not null default 'unassigned',
  dispatch_attempts integer not null default 0,
  ready_for_pickup_at timestamptz not null default now(),
  assigned_at timestamptz,
  assignment_expires_at timestamptz,
  accepted_at timestamptz,
  at_pickup_at timestamptz,
  collected_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_jobs_assignment_check check (
    (status = 'unassigned' and driver_id is null) or status <> 'unassigned'
  )
);

create table public.delivery_assignments (
  id uuid primary key default gen_random_uuid(),
  delivery_job_id uuid not null references public.delivery_jobs(id) on delete cascade,
  driver_id uuid not null references public.delivery_drivers(id) on delete restrict,
  outcome text not null default 'assigned' check (outcome in ('assigned', 'accepted', 'declined', 'expired', 'completed')),
  decline_reason text,
  assigned_at timestamptz not null default now(),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.delivery_events (
  id uuid primary key default gen_random_uuid(),
  delivery_job_id uuid not null references public.delivery_jobs(id) on delete cascade,
  event_type text not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table public.delivery_partner_invites (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.delivery_partners(id) on delete cascade,
  email text not null,
  role public.delivery_invite_role not null,
  token_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index delivery_partner_members_user_idx on public.delivery_partner_members (user_id, partner_id);
create index delivery_drivers_partner_availability_idx on public.delivery_drivers (partner_id, availability) where is_active;
create index delivery_jobs_status_idx on public.delivery_jobs (status, created_at desc);
create index delivery_jobs_partner_status_idx on public.delivery_jobs (partner_id, status, updated_at desc);
create index delivery_jobs_driver_status_idx on public.delivery_jobs (driver_id, status, updated_at desc);
create index delivery_assignments_job_idx on public.delivery_assignments (delivery_job_id, assigned_at desc);
create index delivery_events_job_idx on public.delivery_events (delivery_job_id, created_at desc);

create trigger delivery_partners_updated_at before update on public.delivery_partners
for each row execute function public.set_updated_at();
create trigger delivery_drivers_updated_at before update on public.delivery_drivers
for each row execute function public.set_updated_at();
create trigger delivery_jobs_updated_at before update on public.delivery_jobs
for each row execute function public.set_updated_at();

create or replace function public.is_morni_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_delivery_partner_operator(p_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_morni_admin() or exists (
    select 1 from public.delivery_partner_members
    where partner_id = p_partner_id and user_id = auth.uid()
  );
$$;

create or replace function public.current_delivery_driver_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.delivery_drivers where user_id = auth.uid();
$$;

alter table public.delivery_partners enable row level security;
alter table public.delivery_partner_members enable row level security;
alter table public.delivery_drivers enable row level security;
alter table public.delivery_jobs enable row level security;
alter table public.delivery_assignments enable row level security;
alter table public.delivery_events enable row level security;
alter table public.delivery_partner_invites enable row level security;

create policy "delivery_partners_read" on public.delivery_partners for select using (public.is_delivery_partner_operator(id));
create policy "delivery_partner_members_read" on public.delivery_partner_members for select using (user_id = auth.uid() or public.is_delivery_partner_operator(partner_id));
create policy "delivery_drivers_read" on public.delivery_drivers for select using (user_id = auth.uid() or public.is_delivery_partner_operator(partner_id));
create policy "delivery_jobs_read" on public.delivery_jobs for select using (
  public.is_morni_admin()
  or public.is_delivery_partner_operator(partner_id)
  or driver_id = public.current_delivery_driver_id()
  or exists (
    select 1 from public.orders order_row
    where order_row.id = order_id and (
      order_row.shopper_id = auth.uid()
      or public.is_store_member(order_row.store_id)
    )
  )
);
create policy "delivery_assignments_read" on public.delivery_assignments for select using (
  public.is_morni_admin()
  or driver_id = public.current_delivery_driver_id()
  or exists (
    select 1 from public.delivery_jobs job
    where job.id = delivery_job_id and public.is_delivery_partner_operator(job.partner_id)
  )
);
create policy "delivery_events_read" on public.delivery_events for select using (
  public.is_morni_admin()
  or exists (
    select 1 from public.delivery_jobs job
    where job.id = delivery_job_id and (
      public.is_delivery_partner_operator(job.partner_id)
      or job.driver_id = public.current_delivery_driver_id()
    )
  )
);

create or replace function public.assign_delivery_job(p_delivery_job_id uuid)
returns public.delivery_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.delivery_jobs;
  v_order public.orders;
  v_store public.stores;
  v_partner_id uuid;
  v_driver_id uuid;
begin
  select * into v_job from public.delivery_jobs where id = p_delivery_job_id for update;
  if not found then
    raise exception 'Delivery job not found.';
  end if;
  if v_job.status in ('accepted', 'at_pickup', 'collected', 'delivered', 'failed', 'cancelled') then
    return v_job;
  end if;

  if v_job.status = 'assigned' and v_job.assignment_expires_at is not null and v_job.assignment_expires_at > now() then
    return v_job;
  end if;

  if v_job.driver_id is not null then
    update public.delivery_assignments
    set outcome = 'expired', responded_at = now()
    where delivery_job_id = v_job.id and driver_id = v_job.driver_id and outcome = 'assigned';
    update public.delivery_drivers
    set availability = 'available'
    where id = v_job.driver_id and availability = 'assigned';
    insert into public.delivery_events (delivery_job_id, event_type, note)
    values (v_job.id, 'assignment_expired', 'The rider did not accept before the assignment window closed.');
  end if;

  select * into v_order from public.orders where id = v_job.order_id;
  select * into v_store from public.stores where id = v_order.store_id;

  select partner.id into v_partner_id
  from public.delivery_partners partner
  where partner.is_active
    and partner.auto_dispatch_enabled
    and v_order.delivery_emirate = any(partner.service_emirates)
  order by partner.dispatch_priority asc, partner.created_at asc
  limit 1;

  if v_partner_id is null then
    update public.delivery_jobs
    set partner_id = null, driver_id = null, status = 'unassigned', assignment_expires_at = null
    where id = v_job.id
    returning * into v_job;
    insert into public.delivery_events (delivery_job_id, event_type, note)
    values (v_job.id, 'waiting_for_partner', 'No active delivery partner covers this order area.');
    return v_job;
  end if;

  select driver.id into v_driver_id
  from public.delivery_drivers driver
  where driver.partner_id = v_partner_id
    and driver.is_active
    and driver.availability = 'available'
  order by
    case when driver.last_lat is not null and v_store.lat is not null
      then power(driver.last_lat - v_store.lat, 2) + power(driver.last_lng - v_store.lng, 2)
      else 999999
    end asc,
    driver.last_location_at desc nulls last,
    driver.created_at asc
  limit 1
  for update skip locked;

  if v_driver_id is null then
    update public.delivery_jobs
    set partner_id = v_partner_id, driver_id = null, status = 'unassigned', assignment_expires_at = null
    where id = v_job.id
    returning * into v_job;
    insert into public.delivery_events (delivery_job_id, event_type, note)
    values (v_job.id, 'waiting_for_driver', 'No available rider was found. The job remains in the automatic dispatch queue.');
    return v_job;
  end if;

  update public.delivery_drivers set availability = 'assigned' where id = v_driver_id;
  update public.delivery_jobs
  set partner_id = v_partner_id,
      driver_id = v_driver_id,
      status = 'assigned',
      dispatch_attempts = dispatch_attempts + 1,
      assigned_at = now(),
      assignment_expires_at = now() + interval '90 seconds',
      failure_reason = null
  where id = v_job.id
  returning * into v_job;
  insert into public.delivery_assignments (delivery_job_id, driver_id)
  values (v_job.id, v_driver_id);
  insert into public.delivery_events (delivery_job_id, event_type, note)
  values (v_job.id, 'driver_assigned', 'Automatically assigned to the nearest available rider.');
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
  if not found then
    raise exception 'Order not found.';
  end if;
  if v_order.status <> 'picking' then
    raise exception 'Only an order being prepared can be marked ready for pickup.';
  end if;

  select * into v_job from public.delivery_jobs where order_id = p_order_id;
  if found then
    return v_job;
  end if;

  insert into public.delivery_jobs (order_id)
  values (p_order_id)
  returning * into v_job;
  insert into public.delivery_events (delivery_job_id, event_type, note)
  values (v_job.id, 'ready_for_pickup', 'The store marked this order ready for collection.');
  return public.assign_delivery_job(v_job.id);
end;
$$;

create or replace function public.set_delivery_driver_availability(
  p_availability public.delivery_driver_availability,
  p_lat double precision default null,
  p_lng double precision default null
)
returns public.delivery_drivers
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_driver public.delivery_drivers;
begin
  select * into v_driver from public.delivery_drivers where user_id = auth.uid() for update;
  if not found then
    raise exception 'No rider profile is linked to this account.';
  end if;
  if not v_driver.is_active then
    raise exception 'This rider account is inactive.';
  end if;
  if p_availability = 'available' and exists (
    select 1 from public.delivery_jobs
    where driver_id = v_driver.id and status in ('assigned', 'accepted', 'at_pickup', 'collected')
  ) then
    raise exception 'Finish the current delivery before becoming available.';
  end if;
  if (p_lat is null) <> (p_lng is null) or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'A valid rider location is required.';
  end if;
  update public.delivery_drivers
  set availability = p_availability,
      last_lat = coalesce(p_lat, last_lat),
      last_lng = coalesce(p_lng, last_lng),
      last_location_at = case when p_lat is null then last_location_at else now() end
  where id = v_driver.id
  returning * into v_driver;
  if p_availability = 'available' then
    perform public.assign_delivery_job(job.id)
    from public.delivery_jobs job
    where job.status = 'unassigned'
      and (job.partner_id is null or job.partner_id = v_driver.partner_id);
  end if;
  return v_driver;
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
  v_job public.delivery_jobs;
begin
  if v_driver_id is null then
    raise exception 'No rider profile is linked to this account.';
  end if;
  select * into v_job from public.delivery_jobs where id = p_delivery_job_id for update;
  if not found or v_job.driver_id <> v_driver_id or v_job.status <> 'assigned' then
    raise exception 'This delivery is no longer available to accept.';
  end if;
  if v_job.assignment_expires_at is not null and v_job.assignment_expires_at < now() then
    perform public.assign_delivery_job(v_job.id);
    raise exception 'This delivery assignment has expired.';
  end if;
  update public.delivery_jobs
  set status = 'accepted', accepted_at = now(), assignment_expires_at = null
  where id = v_job.id returning * into v_job;
  update public.delivery_assignments
  set outcome = 'accepted', responded_at = now()
  where delivery_job_id = v_job.id and driver_id = v_driver_id and outcome = 'assigned';
  insert into public.delivery_events (delivery_job_id, event_type, actor_user_id, note)
  values (v_job.id, 'driver_accepted', auth.uid(), 'The assigned rider accepted the delivery.');
  return v_job;
end;
$$;

create or replace function public.decline_delivery_job(
  p_delivery_job_id uuid,
  p_reason text default null
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
  if not found or v_job.driver_id <> v_driver_id or v_job.status <> 'assigned' then
    raise exception 'This delivery is no longer available to decline.';
  end if;
  update public.delivery_assignments
  set outcome = 'declined', decline_reason = nullif(trim(p_reason), ''), responded_at = now()
  where delivery_job_id = v_job.id and driver_id = v_driver_id and outcome = 'assigned';
  update public.delivery_drivers set availability = 'available' where id = v_driver_id;
  update public.delivery_jobs
  set driver_id = null, status = 'unassigned', assignment_expires_at = null
  where id = v_job.id;
  insert into public.delivery_events (delivery_job_id, event_type, actor_user_id, note)
  values (v_job.id, 'driver_declined', auth.uid(), coalesce(nullif(trim(p_reason), ''), 'The rider declined this job.'));
  return public.assign_delivery_job(v_job.id);
end;
$$;

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
  if not (
    (v_job.status = 'accepted' and p_status = 'at_pickup') or
    (v_job.status = 'at_pickup' and p_status = 'collected') or
    (v_job.status = 'collected' and p_status in ('delivered', 'failed'))
  ) then
    raise exception 'This delivery status transition is not available.';
  end if;

  update public.delivery_jobs
  set status = p_status,
      at_pickup_at = case when p_status = 'at_pickup' then now() else at_pickup_at end,
      collected_at = case when p_status = 'collected' then now() else collected_at end,
      delivered_at = case when p_status = 'delivered' then now() else delivered_at end,
      failed_at = case when p_status = 'failed' then now() else failed_at end,
      failure_reason = case when p_status = 'failed' then nullif(trim(p_note), '') else failure_reason end
  where id = v_job.id
  returning * into v_job;

  if p_status = 'collected' then
    update public.orders set status = 'out_for_delivery' where id = v_job.order_id and status = 'picking';
  elsif p_status = 'delivered' then
    update public.orders set status = 'delivered' where id = v_job.order_id and status = 'out_for_delivery';
    update public.delivery_drivers set availability = 'available' where id = v_driver_id;
    update public.delivery_assignments set outcome = 'completed', responded_at = now()
    where delivery_job_id = v_job.id and driver_id = v_driver_id and outcome = 'accepted';
  elsif p_status = 'failed' then
    update public.delivery_drivers set availability = 'available' where id = v_driver_id;
  end if;

  insert into public.delivery_events (delivery_job_id, event_type, actor_user_id, note)
  values (v_job.id, p_status::text, auth.uid(), nullif(trim(p_note), ''));
  return v_job;
end;
$$;

create or replace function public.requeue_expired_delivery_assignments()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job record;
  v_requeued integer := 0;
begin
  for v_job in
    select id from public.delivery_jobs
    where status = 'unassigned'
       or (status = 'assigned' and assignment_expires_at < now())
  loop
    perform public.assign_delivery_job(v_job.id);
    v_requeued := v_requeued + 1;
  end loop;
  return v_requeued;
end;
$$;

create or replace function public.redeem_delivery_partner_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_invite public.delivery_partner_invites;
  v_profile public.profiles;
begin
  if auth.uid() is null then raise exception 'Sign in before joining a delivery partner.'; end if;
  select * into v_invite
  from public.delivery_partner_invites
  where token_hash = encode(digest(trim(p_token), 'sha256'), 'hex')
    and used_at is null
    and expires_at > now()
  for update;
  if not found then raise exception 'This delivery invite is invalid or has expired.'; end if;
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> lower(v_invite.email) then
    raise exception 'Sign in with the email address that received this invite.';
  end if;
  select * into v_profile from public.profiles where id = auth.uid();
  if v_invite.role = 'dispatcher' then
    insert into public.delivery_partner_members (partner_id, user_id, role)
    values (v_invite.partner_id, auth.uid(), 'dispatcher')
    on conflict (partner_id, user_id) do nothing;
  else
    insert into public.delivery_drivers (partner_id, user_id, display_name, phone)
    values (v_invite.partner_id, auth.uid(), coalesce(v_profile.full_name, 'Rider'), v_profile.phone)
    on conflict (user_id) do update set partner_id = excluded.partner_id, is_active = true;
  end if;
  update public.delivery_partner_invites set used_at = now() where id = v_invite.id;
  return jsonb_build_object('partner_id', v_invite.partner_id, 'role', v_invite.role);
end;
$$;

create or replace function public.partner_delivery_workspace_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_partner_id uuid;
begin
  select partner_id into v_partner_id
  from public.delivery_partner_members
  where user_id = auth.uid()
  order by created_at asc
  limit 1;
  if v_partner_id is null then raise exception 'Partner workspace access is restricted.'; end if;
  return jsonb_build_object(
    'partner', (select jsonb_build_object('id', id, 'name', name, 'is_active', is_active, 'auto_dispatch_enabled', auto_dispatch_enabled) from public.delivery_partners where id = v_partner_id),
    'drivers', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'display_name', display_name, 'availability', availability, 'last_location_at', last_location_at) order by display_name) from public.delivery_drivers where partner_id = v_partner_id), '[]'::jsonb),
    'jobs', coalesce((select jsonb_agg(jsonb_build_object(
      'id', job.id, 'status', job.status, 'assigned_at', job.assigned_at, 'assignment_expires_at', job.assignment_expires_at,
      'failure_reason', job.failure_reason, 'order_number', order_row.order_number, 'store_name', store.name,
      'pickup_area', store.area, 'delivery_area', order_row.delivery_area, 'driver_name', driver.display_name
    ) order by job.updated_at desc limit 80)
      from public.delivery_jobs job
      join public.orders order_row on order_row.id = job.order_id
      join public.stores store on store.id = order_row.store_id
      left join public.delivery_drivers driver on driver.id = job.driver_id
      where job.partner_id = v_partner_id), '[]'::jsonb)
  );
end;
$$;

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
      'delivery_notes', order_row.delivery_notes, 'delivery_phone', order_row.delivery_phone
    ) order by job.updated_at desc)
      from public.delivery_jobs job
      join public.orders order_row on order_row.id = job.order_id
      join public.stores store on store.id = order_row.store_id
      where job.driver_id = v_driver.id and job.status in ('assigned', 'accepted', 'at_pickup', 'collected')), '[]'::jsonb)
  );
end;
$$;

create or replace function public.founder_delivery_workspace_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_morni_admin() then raise exception 'Founder workspace access is restricted to Morni administrators.'; end if;
  return jsonb_build_object(
    'metrics', jsonb_build_object(
      'active_jobs', (select count(*) from public.delivery_jobs where status in ('assigned', 'accepted', 'at_pickup', 'collected')),
      'waiting_jobs', (select count(*) from public.delivery_jobs where status = 'unassigned'),
      'exceptions', (select count(*) from public.delivery_jobs where status = 'failed' or (status = 'assigned' and assignment_expires_at < now())),
      'available_drivers', (select count(*) from public.delivery_drivers where is_active and availability = 'available'),
      'total_drivers', (select count(*) from public.delivery_drivers where is_active)
    ),
    'partners', coalesce((select jsonb_agg(jsonb_build_object(
      'id', partner.id, 'name', partner.name, 'is_active', partner.is_active, 'auto_dispatch_enabled', partner.auto_dispatch_enabled,
      'total_drivers', (select count(*) from public.delivery_drivers driver where driver.partner_id = partner.id and driver.is_active),
      'available_drivers', (select count(*) from public.delivery_drivers driver where driver.partner_id = partner.id and driver.is_active and driver.availability = 'available'),
      'active_jobs', (select count(*) from public.delivery_jobs job where job.partner_id = partner.id and job.status in ('assigned', 'accepted', 'at_pickup', 'collected'))
    ) order by partner.dispatch_priority, partner.name) from public.delivery_partners partner), '[]'::jsonb),
    'drivers', coalesce((select jsonb_agg(jsonb_build_object(
      'id', driver.id, 'display_name', driver.display_name, 'partner_name', partner.name, 'availability', driver.availability, 'is_active', driver.is_active,
      'last_location_at', driver.last_location_at
    ) order by driver.updated_at desc limit 80) from public.delivery_drivers driver join public.delivery_partners partner on partner.id = driver.partner_id), '[]'::jsonb),
    'jobs', coalesce((select jsonb_agg(jsonb_build_object(
      'id', job.id, 'status', job.status, 'attempts', job.dispatch_attempts, 'ready_at', job.ready_for_pickup_at,
      'assigned_at', job.assigned_at, 'failure_reason', job.failure_reason, 'order_number', order_row.order_number,
      'store_name', store.name, 'pickup_area', store.area, 'delivery_area', order_row.delivery_area, 'partner_name', partner.name, 'driver_name', driver.display_name
    ) order by job.updated_at desc limit 120)
      from public.delivery_jobs job
      join public.orders order_row on order_row.id = job.order_id
      join public.stores store on store.id = order_row.store_id
      left join public.delivery_partners partner on partner.id = job.partner_id
      left join public.delivery_drivers driver on driver.id = job.driver_id), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.assign_delivery_job(uuid) from public, anon, authenticated;
revoke all on function public.queue_order_for_delivery(uuid) from public, anon, authenticated;
revoke all on function public.requeue_expired_delivery_assignments() from public, anon, authenticated;
revoke all on function public.founder_delivery_workspace_data() from public, anon;
revoke all on function public.partner_delivery_workspace_data() from public, anon;
revoke all on function public.driver_delivery_workspace_data() from public, anon;
revoke all on function public.redeem_delivery_partner_invite(text) from public, anon;
revoke all on function public.set_delivery_driver_availability(public.delivery_driver_availability, double precision, double precision) from public, anon;
revoke all on function public.accept_delivery_job(uuid) from public, anon;
revoke all on function public.decline_delivery_job(uuid, text) from public, anon;
revoke all on function public.advance_delivery_job(uuid, public.delivery_job_status, text) from public, anon;
grant execute on function public.founder_delivery_workspace_data() to authenticated;
grant execute on function public.partner_delivery_workspace_data() to authenticated;
grant execute on function public.driver_delivery_workspace_data() to authenticated;
grant execute on function public.redeem_delivery_partner_invite(text) to authenticated;
grant execute on function public.set_delivery_driver_availability(public.delivery_driver_availability, double precision, double precision) to authenticated;
grant execute on function public.accept_delivery_job(uuid) to authenticated;
grant execute on function public.decline_delivery_job(uuid, text) to authenticated;
grant execute on function public.advance_delivery_job(uuid, public.delivery_job_status, text) to authenticated;
