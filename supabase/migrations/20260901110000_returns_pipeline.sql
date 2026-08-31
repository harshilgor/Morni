-- End-to-end returns and reverse logistics.
-- A return is deliberately separate from delivery_jobs: it travels from the
-- shopper back to the store and must remain assigned to the original driver.

create table if not exists public.return_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  shopper_id uuid not null references public.profiles(id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  original_delivery_job_id uuid references public.delivery_jobs(id) on delete restrict,
  status text not null default 'pending_review' check (status in (
    'pending_review', 'approved', 'rejected', 'awaiting_pickup',
    'picked_up', 'at_store', 'received', 'refund_pending', 'refunded',
    'pickup_failed', 'cancelled'
  )),
  reason text not null,
  shopper_note text,
  refund_method text not null default 'wallet' check (refund_method in ('wallet', 'original_payment_method')),
  quoted_refund_aed numeric(10, 2) not null default 0 check (quoted_refund_aed >= 0),
  rejection_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.return_request_items (
  id uuid primary key default gen_random_uuid(),
  return_request_id uuid not null references public.return_requests(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null,
  title text not null,
  size text,
  quantity integer not null check (quantity > 0),
  unit_price_aed numeric(10, 2) not null check (unit_price_aed >= 0),
  created_at timestamptz not null default now(),
  unique (return_request_id, order_item_id)
);

create table if not exists public.return_jobs (
  id uuid primary key default gen_random_uuid(),
  return_request_id uuid not null unique references public.return_requests(id) on delete cascade,
  original_delivery_job_id uuid not null references public.delivery_jobs(id) on delete restrict,
  driver_id uuid not null references public.delivery_drivers(id) on delete restrict,
  status text not null default 'assigned' check (status in ('assigned', 'accepted', 'at_customer', 'collected', 'at_store', 'completed', 'failed', 'cancelled')),
  assigned_at timestamptz not null default now(),
  accepted_at timestamptz,
  at_customer_at timestamptz,
  collected_at timestamptz,
  at_store_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint return_jobs_original_driver_check check (driver_id is not null)
);

create table if not exists public.return_events (
  id uuid primary key default gen_random_uuid(),
  return_request_id uuid not null references public.return_requests(id) on delete cascade,
  return_job_id uuid references public.return_jobs(id) on delete cascade,
  event_type text not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.return_inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  return_request_id uuid not null references public.return_requests(id) on delete restrict,
  return_request_item_id uuid not null references public.return_request_items(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null,
  quantity integer not null check (quantity > 0),
  inventory_level text not null check (inventory_level in ('size', 'product', 'legacy_variant', 'unavailable')),
  created_at timestamptz not null default now(),
  unique (return_request_id, return_request_item_id)
);

create table if not exists public.return_refunds (
  id uuid primary key default gen_random_uuid(),
  return_request_id uuid not null unique references public.return_requests(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  shopper_id uuid not null references public.profiles(id) on delete restrict,
  amount_aed numeric(10, 2) not null check (amount_aed >= 0),
  method text not null check (method in ('wallet', 'original_payment_method')),
  status text not null default 'pending_processor' check (status in ('pending_processor', 'processed', 'failed')),
  processor_reference text,
  processor_note text,
  processed_at timestamptz,
  processed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists return_requests_store_status_idx on public.return_requests(store_id, status, created_at desc);
create index if not exists return_requests_shopper_idx on public.return_requests(shopper_id, created_at desc);
create index if not exists return_jobs_driver_status_idx on public.return_jobs(driver_id, status, updated_at desc);
create index if not exists return_events_request_idx on public.return_events(return_request_id, created_at desc);

drop trigger if exists return_requests_updated_at on public.return_requests;
create trigger return_requests_updated_at before update on public.return_requests for each row execute function public.set_updated_at();
drop trigger if exists return_jobs_updated_at on public.return_jobs;
create trigger return_jobs_updated_at before update on public.return_jobs for each row execute function public.set_updated_at();
drop trigger if exists return_refunds_updated_at on public.return_refunds;
create trigger return_refunds_updated_at before update on public.return_refunds for each row execute function public.set_updated_at();

alter table public.return_requests enable row level security;
alter table public.return_request_items enable row level security;
alter table public.return_jobs enable row level security;
alter table public.return_events enable row level security;
alter table public.return_inventory_adjustments enable row level security;
alter table public.return_refunds enable row level security;

drop policy if exists "return_requests_participant_read" on public.return_requests;
create policy "return_requests_participant_read" on public.return_requests for select using (
  shopper_id = auth.uid() or public.is_store_member(store_id)
);
drop policy if exists "return_request_items_participant_read" on public.return_request_items;
create policy "return_request_items_participant_read" on public.return_request_items for select using (
  exists (select 1 from public.return_requests request where request.id = return_request_id and (
    request.shopper_id = auth.uid() or public.is_store_member(request.store_id)
  ))
);
drop policy if exists "return_jobs_participant_read" on public.return_jobs;
create policy "return_jobs_participant_read" on public.return_jobs for select using (
  driver_id = public.current_delivery_driver_id()
  or exists (select 1 from public.return_requests request where request.id = return_request_id and (request.shopper_id = auth.uid() or public.is_store_member(request.store_id)))
);
drop policy if exists "return_events_participant_read" on public.return_events;
create policy "return_events_participant_read" on public.return_events for select using (
  exists (select 1 from public.return_requests request where request.id = return_request_id and (request.shopper_id = auth.uid() or public.is_store_member(request.store_id)))
  or exists (select 1 from public.return_jobs job where job.id = return_job_id and job.driver_id = public.current_delivery_driver_id())
);
drop policy if exists "return_inventory_adjustments_owner_read" on public.return_inventory_adjustments;
create policy "return_inventory_adjustments_owner_read" on public.return_inventory_adjustments for select using (
  exists (select 1 from public.return_requests request where request.id = return_request_id and (request.shopper_id = auth.uid() or public.is_store_member(request.store_id)))
);
drop policy if exists "return_refunds_participant_read" on public.return_refunds;
create policy "return_refunds_participant_read" on public.return_refunds for select using (
  shopper_id = auth.uid() or exists (select 1 from public.return_requests request where request.id = return_request_id and public.is_store_member(request.store_id))
);

create or replace function public.create_return_request(
  p_order_id uuid,
  p_return_items jsonb,
  p_reason text,
  p_shopper_note text default null,
  p_refund_method text default 'wallet'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_order public.orders;
  v_item jsonb;
  v_order_item public.order_items;
  v_request public.return_requests;
  v_existing integer;
  v_quantity integer;
  v_price numeric(10, 2) := 0;
  v_returned_quantity integer := 0;
  v_order_quantity integer;
  v_full_return boolean;
  v_refund numeric(10, 2);
begin
  if auth.uid() is null then raise exception 'Sign in to request a return.'; end if;
  if p_refund_method not in ('wallet', 'original_payment_method') then raise exception 'Choose a valid refund method.'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'Tell us why you are returning the item.'; end if;
  if p_return_items is null or jsonb_typeof(p_return_items) <> 'array' or jsonb_array_length(p_return_items) = 0 then raise exception 'Choose at least one item to return.'; end if;

  select * into v_order from public.orders where id = p_order_id and shopper_id = auth.uid() for update;
  if not found then raise exception 'Order not found.'; end if;
  if v_order.status <> 'delivered' then raise exception 'Returns are available after delivery.'; end if;
  if v_order.placed_at < now() - interval '14 days' then raise exception 'This order is outside the return window.'; end if;
  if exists (select 1 from public.return_requests where order_id = p_order_id and status in ('pending_review','approved','awaiting_pickup','picked_up','at_store','received','refund_pending')) then
    raise exception 'This order already has a return being processed.';
  end if;

  for v_item in select * from jsonb_array_elements(p_return_items)
  loop
    select * into v_order_item from public.order_items where id = (v_item->>'order_item_id')::uuid and order_id = p_order_id;
    if not found then raise exception 'A selected item does not belong to this order.'; end if;
    v_quantity := coalesce((v_item->>'quantity')::integer, 0);
    if v_quantity <= 0 then raise exception 'Return quantities must be greater than zero.'; end if;
    if v_quantity > v_order_item.quantity then raise exception 'You cannot return more than you purchased.'; end if;
    if exists (select 1 from public.return_request_items old_item join public.return_requests old_request on old_request.id = old_item.return_request_id where old_item.order_item_id = v_order_item.id and old_request.status not in ('rejected','cancelled','pickup_failed')) then
      select coalesce(sum(old_item.quantity), 0)::integer into v_existing from public.return_request_items old_item join public.return_requests old_request on old_request.id = old_item.return_request_id where old_item.order_item_id = v_order_item.id and old_request.status not in ('rejected','cancelled','pickup_failed');
      if v_existing + v_quantity > v_order_item.quantity then raise exception 'A return quantity was already requested for %.', v_order_item.title; end if;
    end if;
    v_returned_quantity := v_returned_quantity + v_quantity;
    v_price := v_price + v_order_item.unit_price_aed * v_quantity;
  end loop;

  select coalesce(sum(quantity), 0)::integer into v_order_quantity from public.order_items where order_id = p_order_id;
  v_full_return := v_returned_quantity = v_order_quantity;
  v_refund := greatest(0, v_price + case when v_full_return then v_order.small_order_fee_aed else 0 end - case when v_full_return then 10 else 0 end);

  insert into public.return_requests (order_id, shopper_id, store_id, status, reason, shopper_note, refund_method, quoted_refund_aed)
  values (v_order.id, v_order.shopper_id, v_order.store_id, 'pending_review', trim(p_reason), nullif(trim(p_shopper_note), ''), p_refund_method, v_refund)
  returning * into v_request;

  for v_item in select * from jsonb_array_elements(p_return_items)
  loop
    select * into v_order_item from public.order_items where id = (v_item->>'order_item_id')::uuid and order_id = p_order_id;
    insert into public.return_request_items (return_request_id, order_item_id, product_id, title, size, quantity, unit_price_aed)
    values (v_request.id, v_order_item.id, v_order_item.product_id, v_order_item.title, v_order_item.size, (v_item->>'quantity')::integer, v_order_item.unit_price_aed);
  end loop;
  insert into public.return_events (return_request_id, event_type, actor_user_id, note) values (v_request.id, 'requested', auth.uid(), 'The shopper submitted a return request.');
  return jsonb_build_object('id', v_request.id, 'status', v_request.status, 'quoted_refund_aed', v_refund);
end;
$$;

create or replace function public.review_return_request(p_return_request_id uuid, p_decision text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.return_requests;
  v_original public.delivery_jobs;
  v_return_job public.return_jobs;
begin
  if p_decision not in ('approve','reject') then raise exception 'Choose approve or reject.'; end if;
  select * into v_request from public.return_requests where id = p_return_request_id for update;
  if not found or not public.is_store_member(v_request.store_id) then raise exception 'Return access is restricted.'; end if;
  if v_request.status <> 'pending_review' then raise exception 'This return has already been reviewed.'; end if;

  if p_decision = 'reject' then
    update public.return_requests set status = 'rejected', rejection_note = nullif(trim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now() where id = v_request.id returning * into v_request;
    insert into public.return_events (return_request_id, event_type, actor_user_id, note) values (v_request.id, 'rejected', auth.uid(), coalesce(nullif(trim(p_note), ''), 'The store rejected this return request.'));
    return jsonb_build_object('id', v_request.id, 'status', v_request.status);
  end if;

  select * into v_original from public.delivery_jobs where order_id = v_request.order_id and status = 'delivered' order by delivered_at desc nulls last limit 1;
  if not found or v_original.driver_id is null then raise exception 'The original driver is not available for this return yet.'; end if;
  update public.return_requests set status = 'awaiting_pickup', original_delivery_job_id = v_original.id, reviewed_by = auth.uid(), reviewed_at = now() where id = v_request.id returning * into v_request;
  insert into public.return_jobs (return_request_id, original_delivery_job_id, driver_id) values (v_request.id, v_original.id, v_original.driver_id) returning * into v_return_job;
  insert into public.return_events (return_request_id, return_job_id, event_type, actor_user_id, note) values (v_request.id, v_return_job.id, 'approved', auth.uid(), 'Approved and assigned to the original delivery driver for pickup.');
  return jsonb_build_object('id', v_request.id, 'status', v_request.status, 'return_job_id', v_return_job.id, 'driver_id', v_original.driver_id);
end;
$$;

create or replace function public.advance_return_job(p_return_job_id uuid, p_status text, p_note text default null)
returns public.return_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_driver_id uuid := public.current_delivery_driver_id();
  v_job public.return_jobs;
  v_request public.return_requests;
begin
  if v_driver_id is null then raise exception 'No rider profile is linked to this account.'; end if;
  select * into v_job from public.return_jobs where id = p_return_job_id and driver_id = v_driver_id for update;
  if not found then raise exception 'This return is not assigned to you.'; end if;
  if not ((v_job.status = 'assigned' and p_status = 'accepted') or (v_job.status = 'accepted' and p_status = 'at_customer') or (v_job.status = 'at_customer' and p_status = 'collected') or (v_job.status = 'collected' and p_status = 'at_store') or (v_job.status = 'at_store' and p_status = 'failed')) then
    raise exception 'This return status transition is not available.';
  end if;
  update public.return_jobs set status = p_status,
    accepted_at = case when p_status = 'accepted' then now() else accepted_at end,
    at_customer_at = case when p_status = 'at_customer' then now() else at_customer_at end,
    collected_at = case when p_status = 'collected' then now() else collected_at end,
    at_store_at = case when p_status = 'at_store' then now() else at_store_at end,
    failed_at = case when p_status = 'failed' then now() else failed_at end,
    failure_reason = case when p_status = 'failed' then nullif(trim(p_note), '') else failure_reason end
  where id = v_job.id returning * into v_job;
  select * into v_request from public.return_requests where id = v_job.return_request_id;
  update public.return_requests set status = case when p_status = 'collected' then 'picked_up' when p_status = 'at_store' then 'at_store' when p_status = 'failed' then 'pickup_failed' else status end where id = v_request.id;
  insert into public.return_events (return_request_id, return_job_id, event_type, actor_user_id, note) values (v_request.id, v_job.id, p_status, auth.uid(), nullif(trim(p_note), ''));
  return v_job;
end;
$$;

create or replace function public.confirm_return_received(p_return_request_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_request public.return_requests;
  v_job public.return_jobs;
  v_item public.return_request_items;
  v_product public.products;
  v_stock integer;
  v_level text;
  v_refund public.return_refunds;
begin
  select * into v_request from public.return_requests where id = p_return_request_id for update;
  if not found or not public.is_store_member(v_request.store_id) then raise exception 'Return access is restricted.'; end if;
  if v_request.status <> 'at_store' then raise exception 'The driver must mark the return as at the store first.'; end if;
  select * into v_job from public.return_jobs where return_request_id = v_request.id for update;
  if not found then raise exception 'Return pickup job not found.'; end if;

  for v_item in select * from public.return_request_items where return_request_id = v_request.id order by id
  loop
    if exists (select 1 from public.return_inventory_adjustments where return_request_id = v_request.id and return_request_item_id = v_item.id) then continue; end if;
    if v_item.product_id is null then
      v_level := 'unavailable';
    else
      select * into v_product from public.products where id = v_item.product_id for update;
      if not found then v_level := 'unavailable';
      elsif coalesce(v_product.size_stock, '{}'::jsonb) <> '{}'::jsonb and nullif(trim(coalesce(v_item.size, '')), '') is not null then
        v_stock := greatest(0, coalesce((v_product.size_stock ->> v_item.size)::integer, 0)) + v_item.quantity;
        update public.products set size_stock = jsonb_set(coalesce(size_stock, '{}'::jsonb), array[v_item.size], to_jsonb(v_stock), true) where id = v_product.id;
        v_level := 'size';
      elsif v_item.size is not null and exists (select 1 from public.product_variants variant where variant.id = (select oi.variant_id from public.order_items oi where oi.id = v_item.order_item_id)) then
        update public.product_variants set stock = stock + v_item.quantity where id = (select oi.variant_id from public.order_items oi where oi.id = v_item.order_item_id);
        v_level := 'legacy_variant';
      else
        update public.products set stock = stock + v_item.quantity where id = v_product.id;
        v_level := 'product';
      end if;
    end if;
    insert into public.return_inventory_adjustments (return_request_id, return_request_item_id, product_id, quantity, inventory_level) values (v_request.id, v_item.id, v_item.product_id, v_item.quantity, v_level);
    if v_level = 'unavailable' or (v_level = 'product' and cardinality(coalesce(v_product.sizes, '{}'::text[])) > 0 and coalesce(v_product.size_stock, '{}'::jsonb) = '{}'::jsonb) then
      insert into public.store_inventory_notifications (store_id, product_id, kind, title, detail, status)
      select v_request.store_id, v_item.product_id, 'restored_inventory', 'Return inventory needs a size review',
        'Returned ' || v_item.quantity || ' × ' || v_item.title || ' was restored to product stock. Assign it to the correct size if needed.', 'pending'
      where v_item.product_id is not null;
    end if;
  end loop;

  insert into public.return_refunds (return_request_id, order_id, shopper_id, amount_aed, method)
  values (v_request.id, v_request.order_id, v_request.shopper_id, v_request.quoted_refund_aed, v_request.refund_method)
  on conflict (return_request_id) do nothing returning * into v_refund;
  update public.return_jobs set status = 'completed', completed_at = now() where id = v_job.id;
  update public.return_requests set status = 'refund_pending', received_at = now() where id = v_request.id returning * into v_request;
  insert into public.return_events (return_request_id, return_job_id, event_type, actor_user_id, note) values (v_request.id, v_job.id, 'received', auth.uid(), coalesce(nullif(trim(p_note), ''), 'The store confirmed receipt of the returned items. Inventory was restored and the refund is ready for processing.'));
  return jsonb_build_object('id', v_request.id, 'status', v_request.status, 'refund_id', coalesce(v_refund.id, (select id from public.return_refunds where return_request_id = v_request.id)), 'refund_amount_aed', v_request.quoted_refund_aed);
end;
$$;

create or replace function public.mark_return_refund_processed(p_return_request_id uuid, p_processor_reference text default null, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.return_requests;
  v_refund public.return_refunds;
begin
  select * into v_request from public.return_requests where id = p_return_request_id for update;
  if not found or not public.is_store_member(v_request.store_id) then raise exception 'Return access is restricted.'; end if;
  select * into v_refund from public.return_refunds where return_request_id = v_request.id for update;
  if not found then raise exception 'The return has not been received yet.'; end if;
  if v_refund.status = 'processed' then return jsonb_build_object('status', 'refunded'); end if;
  update public.return_refunds set status = 'processed', processor_reference = nullif(trim(p_processor_reference), ''), processor_note = nullif(trim(p_note), ''), processed_at = now(), processed_by = auth.uid() where id = v_refund.id;
  update public.return_requests set status = 'refunded' where id = v_request.id;
  insert into public.return_events (return_request_id, event_type, actor_user_id, note) values (v_request.id, 'refunded', auth.uid(), coalesce(nullif(trim(p_note), ''), 'The refund was marked as processed.'));
  return jsonb_build_object('status', 'refunded', 'amount_aed', v_refund.amount_aed);
end;
$$;

-- Extend the driver payload without changing the delivery job contract.
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
    'driver', jsonb_build_object('id', v_driver.id, 'display_name', v_driver.display_name, 'availability', v_driver.availability, 'is_active', v_driver.is_active, 'last_lat', v_driver.last_lat, 'last_lng', v_driver.last_lng, 'last_location_at', v_driver.last_location_at),
    'partner', jsonb_build_object('name', v_partner.name, 'support_email', v_partner.support_email),
    'jobs', coalesce((select jsonb_agg(jsonb_build_object(
      'id', job.id, 'status', job.status, 'assignment_expires_at', job.assignment_expires_at, 'order_number', order_row.order_number, 'store_name', store.name,
      'store_address', coalesce(nullif(trim(pickup.address), ''), store.address), 'store_lat', coalesce(pickup.lat, store.lat), 'store_lng', coalesce(pickup.lng, store.lng),
      'delivery_street', order_row.delivery_street, 'delivery_building', order_row.delivery_building, 'delivery_apartment', order_row.delivery_apartment, 'delivery_area', order_row.delivery_area, 'delivery_emirate', order_row.delivery_emirate,
      'delivery_notes', order_row.delivery_notes, 'delivery_phone', coalesce(order_row.delivery_phone, shopper.phone), 'delivery_eta_minutes', order_row.delivery_eta_minutes,
      'item_count', coalesce((select sum(item.quantity)::int from public.order_items item where item.order_id = order_row.id), 0),
      'bag_summary', (select string_agg(item.title || case when item.size is not null then ' · ' || item.size else '' end || ' ×' || item.quantity, ', ' order by item.title) from public.order_items item where item.order_id = order_row.id),
      'item_image_urls', coalesce((select jsonb_agg(item.image_url order by item.id) from public.order_items item where item.order_id = order_row.id and item.image_url is not null), '[]'::jsonb),
      'pickup_handoff_status', (select handoff.status from public.delivery_handoffs handoff where handoff.delivery_job_id = job.id and handoff.handoff_type = 'pickup'), 'delivery_handoff_status', (select handoff.status from public.delivery_handoffs handoff where handoff.delivery_job_id = job.id and handoff.handoff_type = 'delivery'), 'proof_count', (select count(*)::int from public.delivery_proofs proof where proof.delivery_job_id = job.id)
    ) order by (job.status = 'unassigned') desc, job.updated_at desc) from public.delivery_jobs job join public.orders order_row on order_row.id = job.order_id join public.stores store on store.id = order_row.store_id left join public.store_pickup_locations pickup on pickup.store_id = store.id left join public.profiles shopper on shopper.id = order_row.shopper_id where (job.driver_id = v_driver.id and job.status in ('assigned','accepted','at_pickup','collected')) or (job.driver_id is null and job.status = 'unassigned')), '[]'::jsonb),
    'return_jobs', coalesce((select jsonb_agg(jsonb_build_object(
      'id', rjob.id, 'status', rjob.status, 'order_number', order_row.order_number, 'store_name', store.name, 'store_address', coalesce(nullif(trim(pickup.address), ''), store.address), 'store_lat', coalesce(pickup.lat, store.lat), 'store_lng', coalesce(pickup.lng, store.lng),
      'delivery_street', order_row.delivery_street, 'delivery_building', order_row.delivery_building, 'delivery_apartment', order_row.delivery_apartment, 'delivery_area', order_row.delivery_area, 'delivery_emirate', order_row.delivery_emirate, 'delivery_phone', coalesce(order_row.delivery_phone, shopper.phone), 'reason', request.reason, 'shopper_note', request.shopper_note,
      'items', coalesce((select jsonb_agg(jsonb_build_object('title', item.title, 'size', item.size, 'quantity', item.quantity) order by item.title) from public.return_request_items item where item.return_request_id = request.id), '[]'::jsonb)
    ) order by rjob.updated_at desc) from public.return_jobs rjob join public.return_requests request on request.id = rjob.return_request_id join public.orders order_row on order_row.id = request.order_id join public.stores store on store.id = request.store_id left join public.store_pickup_locations pickup on pickup.store_id = store.id left join public.profiles shopper on shopper.id = request.shopper_id where rjob.driver_id = v_driver.id and rjob.status in ('assigned','accepted','at_customer','collected','at_store')), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object('id', history_job.id, 'status', history_job.status, 'order_number', order_row.order_number, 'store_name', store.name, 'delivery_area', order_row.delivery_area, 'delivered_at', history_job.delivered_at, 'failed_at', history_job.failed_at, 'failure_reason', history_job.failure_reason, 'updated_at', history_job.updated_at) order by history_job.updated_at desc) from public.delivery_jobs history_job join public.orders order_row on order_row.id = history_job.order_id join public.stores store on store.id = order_row.store_id where history_job.driver_id = v_driver.id and history_job.status in ('delivered','failed','cancelled') and history_job.updated_at >= now() - interval '30 days'), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.create_return_request(uuid, jsonb, text, text, text) from public, anon;
revoke all on function public.review_return_request(uuid, text, text) from public, anon;
revoke all on function public.advance_return_job(uuid, text, text) from public, anon;
revoke all on function public.confirm_return_received(uuid, text) from public, anon;
revoke all on function public.mark_return_refund_processed(uuid, text, text) from public, anon;
grant execute on function public.create_return_request(uuid, jsonb, text, text, text) to authenticated;
grant execute on function public.review_return_request(uuid, text, text) to authenticated;
grant execute on function public.advance_return_job(uuid, text, text) to authenticated;
grant execute on function public.confirm_return_received(uuid, text) to authenticated;
grant execute on function public.mark_return_refund_processed(uuid, text, text) to authenticated;
revoke all on function public.driver_delivery_workspace_data() from public, anon;
grant execute on function public.driver_delivery_workspace_data() to authenticated, service_role;
