-- Release hardening for legacy size inventory, checkout atomicity, and returns.

-- Keep one owner notification per legacy product and keep it alive until the
-- owner supplies real per-size quantities. Legacy products remain purchasable
-- against products.stock while this notification is pending.
delete from public.store_inventory_notifications older
using public.store_inventory_notifications newer
where older.kind = 'legacy_size_inventory'
  and newer.kind = 'legacy_size_inventory'
  and older.product_id = newer.product_id
  and older.id < newer.id;

create unique index if not exists store_inventory_legacy_product_uidx
  on public.store_inventory_notifications(product_id)
  where kind = 'legacy_size_inventory' and product_id is not null;

drop policy if exists "store_inventory_notifications_owner_update"
  on public.store_inventory_notifications;
create policy "store_inventory_notifications_owner_update"
  on public.store_inventory_notifications
  for update
  to authenticated
  using (public.is_store_member(store_id))
  with check (public.is_store_member(store_id));

create or replace function public.sync_legacy_size_inventory_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if cardinality(coalesce(new.sizes, '{}'::text[])) > 0
     and coalesce(new.size_stock, '{}'::jsonb) = '{}'::jsonb then
    insert into public.store_inventory_notifications(
      store_id, product_id, kind, title, detail, payload, status
    )
    values (
      new.store_id,
      new.id,
      'legacy_size_inventory',
      'Add size quantities',
      format('%s needs quantities for %s.', new.title, array_to_string(new.sizes, ', ')),
      jsonb_build_object('sizes', new.sizes, 'legacy_stock', new.stock),
      'pending'
    )
    on conflict (product_id) where kind = 'legacy_size_inventory' and product_id is not null
    do update set
      detail = excluded.detail,
      payload = excluded.payload,
      status = case when public.store_inventory_notifications.status = 'rejected' then 'pending' else public.store_inventory_notifications.status end;
  elsif coalesce(new.size_stock, '{}'::jsonb) <> '{}'::jsonb then
    update public.store_inventory_notifications
    set status = 'accepted', resolved_at = coalesce(resolved_at, now()), resolved_by = coalesce(resolved_by, auth.uid())
    where product_id = new.id
      and kind = 'legacy_size_inventory'
      and status = 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists products_legacy_size_inventory_notification on public.products;
create trigger products_legacy_size_inventory_notification
after insert or update of sizes, size_stock on public.products
for each row execute function public.sync_legacy_size_inventory_notification();

-- Idempotent cancellation/failure restoration. A unique adjustment row is the
-- guard against double-restoring stock when two failure signals race.
create table if not exists public.order_inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  size text,
  quantity integer not null check (quantity > 0),
  reason text not null check (reason in ('cancelled', 'failed_delivery')),
  created_at timestamptz not null default now(),
  unique (order_id, order_item_id, reason)
);
create index if not exists order_inventory_adjustments_order_idx
  on public.order_inventory_adjustments(order_id, reason);
alter table public.order_inventory_adjustments enable row level security;
revoke all on public.order_inventory_adjustments from anon, authenticated;

create or replace function public.cancel_order_and_restore_inventory(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  item record;
  current_qty integer;
  adjustment_id uuid;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if v_order.status = 'cancelled' then return v_order; end if;
  if v_order.status not in ('placed', 'accepted', 'picking', 'out_for_delivery') then
    raise exception 'Order cannot be cancelled.';
  end if;

  for item in select * from public.order_items where order_id = p_order_id order by id loop
    adjustment_id := null;
    insert into public.order_inventory_adjustments(
      order_id, order_item_id, product_id, variant_id, size, quantity, reason
    )
    values (p_order_id, item.id, item.product_id, item.variant_id, item.size, item.quantity, 'cancelled')
    on conflict (order_id, order_item_id, reason) do nothing
    returning id into adjustment_id;

    if adjustment_id is null then continue; end if;
    if item.variant_id is not null then
      update public.product_variants set stock = stock + item.quantity where id = item.variant_id;
    elsif item.size is not null and exists (
      select 1 from public.products where id = item.product_id and size_stock <> '{}'::jsonb
    ) then
      select coalesce((size_stock->>item.size)::integer, 0) into current_qty
      from public.products where id = item.product_id for update;
      update public.products
      set size_stock = jsonb_set(size_stock, array[item.size], to_jsonb(current_qty + item.quantity), true)
      where id = item.product_id;
    else
      update public.products set stock = stock + item.quantity where id = item.product_id;
    end if;
    insert into public.store_inventory_notifications(
      store_id, product_id, order_id, kind, title, detail, payload
    ) values (
      v_order.store_id, item.product_id, p_order_id, 'restored_inventory',
      'Inventory restored after cancellation',
      format('%s × %s returned to inventory.', item.quantity, coalesce(item.size, 'standard')),
      jsonb_build_object('product_id', item.product_id, 'size', item.size, 'quantity', item.quantity, 'variant_id', item.variant_id)
    );
  end loop;
  update public.orders set status = 'cancelled' where id = p_order_id returning * into v_order;
  return v_order;
end;
$$;

create or replace function public.restore_inventory_after_failed_delivery()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  order_status text;
begin
  if new.status = 'failed' and old.status is distinct from new.status then
    select status into order_status from public.orders where id = new.order_id for update;
    if order_status in ('placed', 'accepted', 'picking', 'out_for_delivery') then
      perform public.cancel_order_and_restore_inventory(new.order_id);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists delivery_failed_restore_inventory on public.delivery_jobs;
create trigger delivery_failed_restore_inventory
after update of status on public.delivery_jobs
for each row execute function public.restore_inventory_after_failed_delivery();

revoke all on function public.cancel_order_and_restore_inventory(uuid) from public, anon, authenticated;
grant execute on function public.cancel_order_and_restore_inventory(uuid) to service_role;

-- Checkout owns the order-item write, including the complete validated
-- customization object. This removes the old second update that could lose
-- customization after an otherwise successful order.
create or replace function public.place_order_with_items(
  p_store_id uuid,
  p_payment_method public.payment_method,
  p_subtotal_aed numeric,
  p_delivery_fee_aed numeric,
  p_total_aed numeric,
  p_delivery_emirate public.uae_emirate,
  p_delivery_area text,
  p_delivery_street text,
  p_delivery_building text,
  p_delivery_apartment text,
  p_delivery_notes text,
  p_delivery_phone text,
  p_delivery_eta_minutes integer,
  p_items jsonb,
  p_shopper_id uuid default null,
  p_delivery_slot_start timestamptz default null,
  p_delivery_slot_end timestamptz default null
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.orders;
  v_item jsonb;
  v_product public.products;
  v_variant public.product_variants;
  v_product_id uuid;
  v_variant_id uuid;
  v_qty integer;
  v_size text;
  v_color_name text;
  v_subtotal numeric := 0;
  v_small_order_fee numeric := 0;
  v_delivery_fee numeric := 7;
  v_service_fee numeric := 3;
  v_delivery_eta integer;
  v_slot_start timestamptz := p_delivery_slot_start;
  v_slot_end timestamptz := p_delivery_slot_end;
  v_local_start timestamp;
  v_local_end timestamp;
  v_start_minutes integer;
  v_end_minutes integer;
  v_now_dubai timestamp := timezone('Asia/Dubai', now());
  v_eta_from_slot integer;
begin
  if v_user_id is null then v_user_id := p_shopper_id;
  elsif p_shopper_id is not null and p_shopper_id is distinct from v_user_id then
    raise exception 'You must be signed in to place an order.';
  end if;
  if v_user_id is null then raise exception 'You must be signed in to place an order.'; end if;
  if p_payment_method is null or p_payment_method not in ('cod', 'card', 'apple_pay', 'tabby', 'tamara') then
    raise exception 'Choose a supported payment method.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    raise exception 'Cart must contain between 1 and 30 items.';
  end if;
  if nullif(trim(p_delivery_area), '') is null or nullif(trim(p_delivery_street), '') is null
     or char_length(p_delivery_area) > 120 or char_length(p_delivery_street) > 240
     or char_length(coalesce(p_delivery_building, '')) > 120
     or char_length(coalesce(p_delivery_apartment, '')) > 80
     or char_length(coalesce(p_delivery_phone, '')) > 40
     or char_length(coalesce(p_delivery_notes, '')) > 1000 then
    raise exception 'Delivery details are invalid.';
  end if;
  if v_slot_start is null or v_slot_end is null or v_slot_end <= v_slot_start then raise exception 'Delivery time slot is invalid.'; end if;
  v_local_start := timezone('Asia/Dubai', v_slot_start);
  v_local_end := timezone('Asia/Dubai', v_slot_end);
  if v_local_start::date is distinct from v_local_end::date then raise exception 'Delivery time slot is invalid.'; end if;
  v_start_minutes := extract(hour from v_local_start)::integer * 60 + extract(minute from v_local_start)::integer;
  v_end_minutes := extract(hour from v_local_end)::integer * 60 + extract(minute from v_local_end)::integer;
  if not ((v_start_minutes = 600 and v_end_minutes = 690) or (v_start_minutes = 690 and v_end_minutes = 810) or (v_start_minutes = 810 and v_end_minutes = 870) or (v_start_minutes = 870 and v_end_minutes = 960) or (v_start_minutes = 960 and v_end_minutes = 1080)) then
    raise exception 'Choose a valid delivery time slot.';
  end if;
  if v_local_start::date = v_now_dubai::date and v_now_dubai::time >= time '18:30' then raise exception 'Same-day delivery booking has closed. Choose a tomorrow slot.'; end if;
  if v_slot_start <= now() then raise exception 'That delivery slot is no longer available.'; end if;
  if v_local_start::date > (v_now_dubai::date + 1) then raise exception 'Delivery time slot is invalid.'; end if;
  select s.delivery_eta_minutes into v_delivery_eta from public.stores s where s.id = p_store_id and s.is_active = true and s.deleted_at is null;
  if not found then raise exception 'This store is not available.'; end if;
  v_eta_from_slot := greatest(1, ceil(extract(epoch from (v_slot_end - now())) / 60.0)::integer);
  v_delivery_eta := v_eta_from_slot;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_variant_id := nullif(v_item->>'variant_id', '')::uuid;
    v_qty := coalesce((v_item->>'quantity')::integer, 0);
    v_size := nullif(trim(v_item->>'size'), '');
    if v_qty <= 0 or v_qty > 25 then raise exception 'Invalid quantity.'; end if;
    select * into v_product from public.products where id = v_product_id and store_id = p_store_id and is_available = true for update;
    if not found then raise exception 'A product in your cart is no longer available.'; end if;
    if v_variant_id is not null then
      select * into v_variant from public.product_variants where id = v_variant_id and product_id = v_product_id for update;
      if not found or v_variant.stock < v_qty then raise exception 'A selected colour is no longer available.'; end if;
      if v_size is not null and cardinality(v_variant.sizes) > 0 and not (v_size = any (v_variant.sizes)) then raise exception 'Selected size is no longer available.'; end if;
    elsif v_size is not null and v_product.size_stock <> '{}'::jsonb and coalesce((v_product.size_stock->>v_size)::integer, 0) < v_qty then
      raise exception '% (%) only has % left.', v_product.title, v_size, coalesce((v_product.size_stock->>v_size)::integer, 0);
    elsif v_product.stock < v_qty then
      raise exception '% only has % left.', v_product.title, v_product.stock;
    elsif v_size is not null and cardinality(v_product.sizes) > 0 and not (v_size = any (v_product.sizes)) then
      raise exception 'Selected size is no longer available.';
    end if;
    v_subtotal := v_subtotal + public.sale_price_for_product(v_product.id, v_product.price_aed) * v_qty;
  end loop;
  v_small_order_fee := case when v_subtotal < 99 then 15 else 0 end;
  v_delivery_fee := case when v_subtotal >= 199 then 0 else 7 end;
  insert into public.orders (shopper_id, store_id, status, payment_method, payment_status, subtotal_aed, small_order_fee_aed, delivery_fee_aed, service_fee_aed, total_aed, delivery_emirate, delivery_area, delivery_street, delivery_building, delivery_apartment, delivery_notes, delivery_phone, delivery_eta_minutes, delivery_slot_start, delivery_slot_end)
  values (v_user_id, p_store_id, 'placed', p_payment_method, 'pending', v_subtotal, v_small_order_fee, v_delivery_fee, v_service_fee, v_subtotal + v_small_order_fee + v_delivery_fee + v_service_fee, p_delivery_emirate, trim(p_delivery_area), trim(p_delivery_street), nullif(trim(p_delivery_building), ''), nullif(trim(p_delivery_apartment), ''), nullif(trim(p_delivery_notes), ''), nullif(trim(p_delivery_phone), ''), v_delivery_eta, v_slot_start, v_slot_end)
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_variant_id := nullif(v_item->>'variant_id', '')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    v_size := nullif(trim(v_item->>'size'), '');
    select * into v_product from public.products where id = v_product_id for update;
    if v_variant_id is not null then
      update public.product_variants set stock = stock - v_qty where id = v_variant_id and stock >= v_qty;
      if not found then raise exception 'Not enough stock for a selected colour.'; end if;
      select color_name into v_color_name from public.product_variants where id = v_variant_id;
    else
      if v_size is not null and v_product.size_stock <> '{}'::jsonb then
        update public.products set size_stock = jsonb_set(size_stock, array[v_size], to_jsonb((size_stock->>v_size)::integer - v_qty), false) where id = v_product_id and coalesce((size_stock->>v_size)::integer, 0) >= v_qty;
      else
        update public.products set stock = stock - v_qty where id = v_product_id and stock >= v_qty;
      end if;
      if not found then raise exception 'Not enough stock for the selected size.'; end if;
      v_color_name := null;
    end if;
    insert into public.order_items (order_id, product_id, variant_id, title, size, color_name, unit_price_aed, quantity, line_total_aed, customization)
    values (v_order.id, v_product_id, v_variant_id, v_product.title, v_size, v_color_name, public.sale_price_for_product(v_product.id, v_product.price_aed), v_qty, public.sale_price_for_product(v_product.id, v_product.price_aed) * v_qty, case when jsonb_typeof(v_item->'customization') = 'object' and (v_item->'customization') <> '{}'::jsonb then v_item->'customization' else null end);
  end loop;
  return v_order;
end;
$$;

revoke all on function public.place_order_with_items(uuid, public.payment_method, numeric, numeric, numeric, public.uae_emirate, text, text, text, text, text, text, integer, jsonb, uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.place_order_with_items(uuid, public.payment_method, numeric, numeric, numeric, public.uae_emirate, text, text, text, text, text, text, integer, jsonb, uuid, timestamptz, timestamptz) to service_role;

-- Returns are a same-visit decision: the customer may request one only while
-- the driver's delivery handoff code is pending. There is no 14-day window.
create or replace function public.create_return_request(
  p_order_id uuid,
  p_return_items jsonb,
  p_reason text,
  p_shopper_note text default null,
  p_refund_method text default 'original_payment_method'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_order public.orders;
  v_delivery_job public.delivery_jobs;
  v_delivery_handoff public.delivery_handoffs;
  v_item jsonb;
  v_order_item public.order_items;
  v_request public.return_requests;
  v_return_job public.return_jobs;
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
  select * into v_delivery_job from public.delivery_jobs where order_id = p_order_id order by updated_at desc nulls last limit 1;
  if not found or v_delivery_job.driver_id is null or v_delivery_job.status <> 'collected' then
    raise exception 'Returns must be handed back to the driver while they are waiting at delivery.';
  end if;
  select * into v_delivery_handoff from public.delivery_handoffs where delivery_job_id = v_delivery_job.id and handoff_type = 'delivery' and status = 'pending' for update;
  if not found or v_delivery_handoff.requested_at + interval '30 minutes' < now() then
    raise exception 'The driver waiting window has ended. This order cannot be returned now.';
  end if;
  if exists (select 1 from public.return_requests where order_id = p_order_id and status not in ('rejected', 'cancelled', 'pickup_failed')) then
    raise exception 'This order already has a return being processed.';
  end if;

  for v_item in select * from jsonb_array_elements(p_return_items) loop
    select * into v_order_item from public.order_items where id = (v_item->>'order_item_id')::uuid and order_id = p_order_id;
    if not found then raise exception 'A selected item does not belong to this order.'; end if;
    v_quantity := coalesce((v_item->>'quantity')::integer, 0);
    if v_quantity <= 0 or v_quantity > v_order_item.quantity then raise exception 'Return quantity is invalid for %.', v_order_item.title; end if;
    select coalesce(sum(old_item.quantity), 0)::integer into v_existing
    from public.return_request_items old_item join public.return_requests old_request on old_request.id = old_item.return_request_id
    where old_item.order_item_id = v_order_item.id and old_request.status not in ('rejected', 'cancelled', 'pickup_failed');
    if v_existing + v_quantity > v_order_item.quantity then raise exception 'A return quantity was already requested for %.', v_order_item.title; end if;
    v_returned_quantity := v_returned_quantity + v_quantity;
    v_price := v_price + v_order_item.unit_price_aed * v_quantity;
  end loop;
  select coalesce(sum(quantity), 0)::integer into v_order_quantity from public.order_items where order_id = p_order_id;
  v_full_return := v_returned_quantity = v_order_quantity;
  v_refund := greatest(0, v_price + case when v_full_return then v_order.small_order_fee_aed else 0 end - case when v_full_return then 10 else 0 end);
  insert into public.return_requests (order_id, shopper_id, store_id, original_delivery_job_id, status, reason, shopper_note, refund_method, quoted_refund_aed)
  values (v_order.id, v_order.shopper_id, v_order.store_id, v_delivery_job.id, 'awaiting_pickup', trim(p_reason), nullif(trim(p_shopper_note), ''), p_refund_method, v_refund)
  returning * into v_request;
  for v_item in select * from jsonb_array_elements(p_return_items) loop
    select * into v_order_item from public.order_items where id = (v_item->>'order_item_id')::uuid and order_id = p_order_id;
    insert into public.return_request_items (return_request_id, order_item_id, product_id, title, size, quantity, unit_price_aed)
    values (v_request.id, v_order_item.id, v_order_item.product_id, v_order_item.title, v_order_item.size, (v_item->>'quantity')::integer, v_order_item.unit_price_aed);
  end loop;
  insert into public.return_jobs (return_request_id, original_delivery_job_id, driver_id) values (v_request.id, v_delivery_job.id, v_delivery_job.driver_id) returning * into v_return_job;
  insert into public.return_events (return_request_id, return_job_id, event_type, actor_user_id, note)
  values (v_request.id, v_return_job.id, 'requested', auth.uid(), 'The shopper requested a return while the original driver was waiting. The same driver was assigned immediately.');
  return jsonb_build_object('id', v_request.id, 'status', v_request.status, 'return_job_id', v_return_job.id, 'quoted_refund_aed', v_refund);
end;
$$;

revoke all on function public.create_return_request(uuid, jsonb, text, text, text) from public, anon;
grant execute on function public.create_return_request(uuid, jsonb, text, text, text) to authenticated;

-- Return-specific OTPs and proof records. Delivery OTPs are never reused for
-- reverse logistics.
create table if not exists public.return_handoffs (
  id uuid primary key default gen_random_uuid(),
  return_job_id uuid not null references public.return_jobs(id) on delete cascade,
  handoff_type text not null check (handoff_type in ('customer', 'store')),
  otp_code text not null check (otp_code ~ '^[0-9]{6}$'),
  otp_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'verified', 'expired')),
  requested_at timestamptz not null default now(),
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (return_job_id, handoff_type)
);

create table if not exists public.return_proofs (
  id uuid primary key default gen_random_uuid(),
  return_job_id uuid not null references public.return_jobs(id) on delete cascade,
  storage_path text not null unique,
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  captured_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists return_handoffs_job_type_idx on public.return_handoffs(return_job_id, handoff_type, status);
create index if not exists return_proofs_job_idx on public.return_proofs(return_job_id, created_at desc);
alter table public.return_handoffs enable row level security;
alter table public.return_proofs enable row level security;
drop policy if exists "return_handoffs_participant_read" on public.return_handoffs;
create policy "return_handoffs_participant_read" on public.return_handoffs for select using (
  exists (select 1 from public.return_jobs job join public.return_requests request on request.id = job.return_request_id where job.id = return_job_id and (job.driver_id = public.current_delivery_driver_id() or request.shopper_id = auth.uid() or public.is_store_member(request.store_id)))
);
drop policy if exists "return_proofs_participant_read" on public.return_proofs;
create policy "return_proofs_participant_read" on public.return_proofs for select using (
  captured_by = auth.uid() or exists (select 1 from public.return_jobs job join public.return_requests request on request.id = job.return_request_id where job.id = return_job_id and (job.driver_id = public.current_delivery_driver_id() or request.shopper_id = auth.uid() or public.is_store_member(request.store_id)))
);
drop policy if exists "return_proofs_driver_insert" on public.return_proofs;
create policy "return_proofs_driver_insert" on public.return_proofs for insert with check (
  captured_by = auth.uid() and exists (select 1 from public.return_jobs job where job.id = return_job_id and job.driver_id = public.current_delivery_driver_id() and job.status in ('at_customer', 'at_store'))
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('return-proofs', 'return-proofs', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 8388608, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "return_proofs_storage_read" on storage.objects;
create policy "return_proofs_storage_read" on storage.objects for select using (
  bucket_id = 'return-proofs' and exists (select 1 from public.return_proofs proof join public.return_jobs job on job.id = proof.return_job_id join public.return_requests request on request.id = job.return_request_id where proof.storage_path = storage.objects.name and (job.driver_id = public.current_delivery_driver_id() or request.shopper_id = auth.uid() or public.is_store_member(request.store_id)))
);
drop policy if exists "return_proofs_storage_driver_upload" on storage.objects;
create policy "return_proofs_storage_driver_upload" on storage.objects for insert with check (
  bucket_id = 'return-proofs' and auth.role() = 'authenticated' and exists (select 1 from public.return_jobs job where job.id = (storage.foldername(storage.objects.name))[1]::uuid and job.driver_id = public.current_delivery_driver_id() and job.status in ('at_customer', 'at_store'))
);

create or replace function public.request_return_handoff(p_return_job_id uuid, p_handoff_type text)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_driver_id uuid := public.current_delivery_driver_id();
  v_job public.return_jobs;
  v_handoff public.return_handoffs;
  v_code text;
begin
  if v_driver_id is null then raise exception 'No rider profile is linked to this account.'; end if;
  if p_handoff_type not in ('customer', 'store') then raise exception 'Invalid return handoff.'; end if;
  select * into v_job from public.return_jobs where id = p_return_job_id and driver_id = v_driver_id for update;
  if not found then raise exception 'This return is not assigned to you.'; end if;
  if (p_handoff_type = 'customer' and v_job.status <> 'at_customer') or (p_handoff_type = 'store' and v_job.status <> 'at_store') then raise exception 'This return handoff is not available at the current step.'; end if;
  select * into v_handoff from public.return_handoffs where return_job_id = p_return_job_id and handoff_type = p_handoff_type for update;
  if found and v_handoff.status = 'pending' then return jsonb_build_object('id', v_handoff.id, 'handoff_type', v_handoff.handoff_type, 'status', v_handoff.status); end if;
  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  insert into public.return_handoffs(return_job_id, handoff_type, otp_code, otp_hash)
  values (p_return_job_id, p_handoff_type, v_code, encode(digest(v_code, 'sha256'), 'hex'))
  on conflict (return_job_id, handoff_type) do update set otp_code = excluded.otp_code, otp_hash = excluded.otp_hash, status = 'pending', requested_at = now(), verified_at = null, verified_by = null
  returning * into v_handoff;
  insert into public.return_events(return_request_id, return_job_id, event_type, actor_user_id, note) values (v_job.return_request_id, v_job.id, p_handoff_type || '_handoff_requested', auth.uid(), 'A return verification code was requested.');
  return jsonb_build_object('id', v_handoff.id, 'handoff_type', v_handoff.handoff_type, 'status', v_handoff.status);
end;
$$;

create or replace function public.verify_return_handoff(p_return_job_id uuid, p_handoff_type text, p_code text)
returns public.return_jobs language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_driver_id uuid := public.current_delivery_driver_id();
  v_job public.return_jobs;
  v_handoff public.return_handoffs;
begin
  if v_driver_id is null then raise exception 'No rider profile is linked to this account.'; end if;
  select * into v_job from public.return_jobs where id = p_return_job_id and driver_id = v_driver_id for update;
  if not found then raise exception 'This return is not assigned to you.'; end if;
  select * into v_handoff from public.return_handoffs where return_job_id = p_return_job_id and handoff_type = p_handoff_type and status = 'pending' for update;
  if not found then raise exception 'Request a fresh return handoff code first.'; end if;
  if encode(digest(trim(coalesce(p_code, '')), 'sha256'), 'hex') <> v_handoff.otp_hash then raise exception 'That verification code is not correct.'; end if;
  if not exists (select 1 from public.return_proofs where return_job_id = v_job.id) then raise exception 'Upload a return photo before verifying the handoff.'; end if;
  update public.return_handoffs set status = 'verified', verified_at = now(), verified_by = auth.uid() where id = v_handoff.id;
  if p_handoff_type = 'customer' then
    if v_job.status <> 'at_customer' then raise exception 'The customer handoff is no longer available.'; end if;
    update public.return_jobs set status = 'collected', collected_at = now() where id = v_job.id returning * into v_job;
    update public.return_requests set status = 'picked_up' where id = v_job.return_request_id;
  elsif p_handoff_type = 'store' then
    if v_job.status <> 'at_store' then raise exception 'The store handoff is no longer available.'; end if;
    update public.return_jobs set status = 'completed', completed_at = now() where id = v_job.id returning * into v_job;
  else raise exception 'Invalid return handoff.'; end if;
  insert into public.return_events(return_request_id, return_job_id, event_type, actor_user_id, note) values (v_job.return_request_id, v_job.id, p_handoff_type || '_handoff_verified', auth.uid(), 'The return handoff code was accepted and proof was recorded.');
  return v_job;
end;
$$;

create or replace function public.shopper_return_handoff_code(p_return_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_handoff public.return_handoffs;
begin
  select handoff.* into v_handoff from public.return_handoffs handoff join public.return_jobs job on job.id = handoff.return_job_id join public.return_requests request on request.id = job.return_request_id where request.id = p_return_request_id and request.shopper_id = auth.uid() and handoff.handoff_type = 'customer' and handoff.status = 'pending';
  if not found then return jsonb_build_object('status', 'not_requested'); end if;
  return jsonb_build_object('status', v_handoff.status, 'otp_code', v_handoff.otp_code, 'requested_at', v_handoff.requested_at);
end;
$$;

create or replace function public.store_return_handoff_code(p_return_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_handoff public.return_handoffs; v_store_id uuid;
begin
  select store_id into v_store_id from public.return_requests where id = p_return_request_id;
  if v_store_id is null or not public.is_store_member(v_store_id) then raise exception 'Store access is restricted.'; end if;
  select handoff.* into v_handoff from public.return_handoffs handoff join public.return_jobs job on job.id = handoff.return_job_id where job.return_request_id = p_return_request_id and handoff.handoff_type = 'store' and handoff.status = 'pending';
  if not found then return jsonb_build_object('status', 'not_requested'); end if;
  return jsonb_build_object('status', v_handoff.status, 'otp_code', v_handoff.otp_code, 'requested_at', v_handoff.requested_at);
end;
$$;

revoke all on function public.request_return_handoff(uuid, text) from public, anon;
revoke all on function public.verify_return_handoff(uuid, text, text) from public, anon;
revoke all on function public.shopper_return_handoff_code(uuid) from public, anon;
revoke all on function public.store_return_handoff_code(uuid) from public, anon;
grant execute on function public.request_return_handoff(uuid, text) to authenticated;
grant execute on function public.verify_return_handoff(uuid, text, text) to authenticated;
grant execute on function public.shopper_return_handoff_code(uuid) to authenticated;
grant execute on function public.store_return_handoff_code(uuid) to authenticated;

-- Founder-owned refund queue. This records what must be paid without moving
-- money; the founder explicitly marks the external payment as sent.
create or replace function public.founder_refund_data()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'refund_id', refund.id,
    'return_request_id', request.id,
    'order_number', order_row.order_number,
    'store_name', store.name,
    'shopper_name', coalesce(shopper.full_name, 'Shopper'),
    'shopper_phone', shopper.phone,
    'amount_aed', refund.amount_aed,
    'method', refund.method,
    'status', refund.status,
    'reason', request.reason,
    'created_at', refund.created_at,
    'processed_at', refund.processed_at,
    'processor_reference', refund.processor_reference,
    'processor_note', refund.processor_note
  ) order by refund.created_at desc), '[]'::jsonb)
  from public.return_refunds refund
  join public.return_requests request on request.id = refund.return_request_id
  join public.orders order_row on order_row.id = refund.order_id
  join public.stores store on store.id = request.store_id
  left join public.profiles shopper on shopper.id = refund.shopper_id
  where public.is_morni_admin();
$$;

create or replace function public.founder_mark_refund_sent(p_return_request_id uuid, p_processor_reference text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_refund public.return_refunds; v_request public.return_requests;
begin
  if not public.is_morni_admin() then raise exception 'Founder access is required.'; end if;
  if nullif(trim(coalesce(p_processor_reference, '')), '') is null then raise exception 'Add the external payment reference before marking this refund sent.'; end if;
  select * into v_request from public.return_requests where id = p_return_request_id for update;
  select * into v_refund from public.return_refunds where return_request_id = p_return_request_id for update;
  if not found then raise exception 'Refund record not found.'; end if;
  if v_refund.status = 'processed' then return jsonb_build_object('status', 'refunded', 'amount_aed', v_refund.amount_aed); end if;
  update public.return_refunds set status = 'processed', processor_reference = trim(p_processor_reference), processor_note = nullif(trim(p_note), ''), processed_at = now(), processed_by = auth.uid() where id = v_refund.id returning * into v_refund;
  update public.return_requests set status = 'refunded' where id = v_request.id;
  insert into public.return_events(return_request_id, event_type, actor_user_id, note) values (v_request.id, 'refunded', auth.uid(), coalesce(nullif(trim(p_note), ''), 'Founder marked the external refund as sent.'));
  return jsonb_build_object('status', 'refunded', 'amount_aed', v_refund.amount_aed);
end;
$$;
revoke all on function public.founder_refund_data() from public, anon;
revoke all on function public.founder_mark_refund_sent(uuid, text, text) from public, anon;
grant execute on function public.founder_refund_data() to authenticated;
grant execute on function public.founder_mark_refund_sent(uuid, text, text) to authenticated;

-- Surface the live customer handoff window to the order page.
create or replace function public.shopper_order_delivery_tracking(p_order_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_order public.orders; v_job public.delivery_jobs; v_driver public.delivery_drivers; v_handoff public.delivery_handoffs; v_return_deadline timestamptz;
begin
  select * into v_order from public.orders where id = p_order_id and shopper_id = auth.uid();
  if not found then raise exception 'Order not found.'; end if;
  select * into v_job from public.delivery_jobs where order_id = p_order_id order by updated_at desc nulls last limit 1;
  if v_job.id is null then return jsonb_build_object('status', null, 'driver_name', null, 'last_lat', null, 'last_lng', null, 'last_location_at', null, 'eta_minutes', v_order.delivery_eta_minutes, 'return_window_ends_at', null, 'can_request_return', false); end if;
  if v_job.driver_id is not null then select * into v_driver from public.delivery_drivers where id = v_job.driver_id; end if;
  select * into v_handoff from public.delivery_handoffs where delivery_job_id = v_job.id and handoff_type = 'delivery' and status = 'pending' order by requested_at desc limit 1;
  if v_handoff.id is not null then v_return_deadline := v_handoff.requested_at + interval '30 minutes'; end if;
  return jsonb_build_object('status', v_job.status, 'driver_name', v_driver.display_name, 'last_lat', v_driver.last_lat, 'last_lng', v_driver.last_lng, 'last_location_at', v_driver.last_location_at, 'eta_minutes', v_order.delivery_eta_minutes, 'accepted_at', v_job.accepted_at, 'updated_at', v_job.updated_at, 'return_window_ends_at', v_return_deadline, 'can_request_return', v_job.status = 'collected' and v_return_deadline is not null and v_return_deadline > now());
end;
$$;
revoke all on function public.shopper_order_delivery_tracking(uuid) from public, anon;
grant execute on function public.shopper_order_delivery_tracking(uuid) to authenticated;

-- The driver must prove the customer and store handoffs; a client cannot
-- bypass them by calling advance_return_job directly.
create or replace function public.advance_return_job(p_return_job_id uuid, p_status text, p_note text default null)
returns public.return_jobs
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_driver_id uuid := public.current_delivery_driver_id(); v_job public.return_jobs; v_request public.return_requests;
begin
  if v_driver_id is null then raise exception 'No rider profile is linked to this account.'; end if;
  select * into v_job from public.return_jobs where id = p_return_job_id and driver_id = v_driver_id for update;
  if not found then raise exception 'This return is not assigned to you.'; end if;
  if not ((v_job.status = 'assigned' and p_status = 'accepted') or (v_job.status = 'accepted' and p_status = 'at_customer') or (v_job.status = 'collected' and p_status = 'at_store') or (v_job.status = 'at_store' and p_status = 'failed')) then
    if v_job.status = 'at_customer' and p_status = 'collected' then raise exception 'Verify the customer return handoff before collecting the parcel.'; end if;
    raise exception 'This return status transition is not available.';
  end if;
  update public.return_jobs set status = p_status, accepted_at = case when p_status = 'accepted' then now() else accepted_at end, at_customer_at = case when p_status = 'at_customer' then now() else at_customer_at end, at_store_at = case when p_status = 'at_store' then now() else at_store_at end, failed_at = case when p_status = 'failed' then now() else failed_at end, failure_reason = case when p_status = 'failed' then nullif(trim(p_note), '') else failure_reason end where id = v_job.id returning * into v_job;
  select * into v_request from public.return_requests where id = v_job.return_request_id;
  update public.return_requests set status = case when p_status = 'at_store' then 'at_store' when p_status = 'failed' then 'pickup_failed' else status end where id = v_request.id;
  insert into public.return_events(return_request_id, return_job_id, event_type, actor_user_id, note) values (v_request.id, v_job.id, p_status, auth.uid(), nullif(trim(p_note), ''));
  return v_job;
end;
$$;
revoke all on function public.advance_return_job(uuid, text, text) from public, anon;
grant execute on function public.advance_return_job(uuid, text, text) to authenticated;

create or replace function public.driver_delivery_workspace_data()
returns jsonb language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
declare v_driver public.delivery_drivers; v_partner public.delivery_partners;
begin
  select * into v_driver from public.delivery_drivers where user_id = auth.uid();
  if not found then raise exception 'Driver workspace access is restricted.'; end if;
  select * into v_partner from public.delivery_partners where id = v_driver.partner_id;
  return jsonb_build_object(
    'driver', jsonb_build_object('id', v_driver.id, 'display_name', v_driver.display_name, 'availability', v_driver.availability, 'is_active', v_driver.is_active, 'last_lat', v_driver.last_lat, 'last_lng', v_driver.last_lng, 'last_location_at', v_driver.last_location_at),
    'partner', jsonb_build_object('name', v_partner.name, 'support_email', v_partner.support_email),
    'jobs', coalesce((select jsonb_agg(jsonb_build_object('id', job.id, 'status', job.status, 'assignment_expires_at', job.assignment_expires_at, 'order_number', order_row.order_number, 'store_name', store.name, 'store_address', coalesce(nullif(trim(pickup.address), ''), store.address), 'store_lat', coalesce(pickup.lat, store.lat), 'store_lng', coalesce(pickup.lng, store.lng), 'delivery_street', order_row.delivery_street, 'delivery_building', order_row.delivery_building, 'delivery_apartment', order_row.delivery_apartment, 'delivery_area', order_row.delivery_area, 'delivery_emirate', order_row.delivery_emirate, 'delivery_notes', order_row.delivery_notes, 'delivery_phone', coalesce(order_row.delivery_phone, shopper.phone), 'delivery_eta_minutes', order_row.delivery_eta_minutes, 'item_count', coalesce((select sum(item.quantity)::int from public.order_items item where item.order_id = order_row.id), 0), 'bag_summary', (select string_agg(item.title || case when item.size is not null then ' · ' || item.size else '' end || ' ×' || item.quantity, ', ' order by item.title) from public.order_items item where item.order_id = order_row.id), 'item_image_urls', coalesce((select jsonb_agg(item.image_url order by item.id) from public.order_items item where item.order_id = order_row.id and item.image_url is not null), '[]'::jsonb), 'pickup_handoff_status', (select handoff.status from public.delivery_handoffs handoff where handoff.delivery_job_id = job.id and handoff.handoff_type = 'pickup'), 'delivery_handoff_status', (select handoff.status from public.delivery_handoffs handoff where handoff.delivery_job_id = job.id and handoff.handoff_type = 'delivery'), 'proof_count', (select count(*)::int from public.delivery_proofs proof where proof.delivery_job_id = job.id)) order by (job.status = 'unassigned') desc, job.updated_at desc) from public.delivery_jobs job join public.orders order_row on order_row.id = job.order_id join public.stores store on store.id = order_row.store_id left join public.store_pickup_locations pickup on pickup.store_id = store.id left join public.profiles shopper on shopper.id = order_row.shopper_id where (job.driver_id = v_driver.id and job.status in ('assigned','accepted','at_pickup','collected')) or (job.driver_id is null and job.status = 'unassigned')), '[]'::jsonb),
    'return_jobs', coalesce((select jsonb_agg(jsonb_build_object('id', rjob.id, 'status', rjob.status, 'order_number', order_row.order_number, 'store_name', store.name, 'store_address', coalesce(nullif(trim(pickup.address), ''), store.address), 'store_lat', coalesce(pickup.lat, store.lat), 'store_lng', coalesce(pickup.lng, store.lng), 'delivery_street', order_row.delivery_street, 'delivery_building', order_row.delivery_building, 'delivery_apartment', order_row.delivery_apartment, 'delivery_area', order_row.delivery_area, 'delivery_emirate', order_row.delivery_emirate, 'delivery_phone', coalesce(order_row.delivery_phone, shopper.phone), 'reason', request.reason, 'shopper_note', request.shopper_note, 'customer_handoff_status', (select handoff.status from public.return_handoffs handoff where handoff.return_job_id = rjob.id and handoff.handoff_type = 'customer'), 'store_handoff_status', (select handoff.status from public.return_handoffs handoff where handoff.return_job_id = rjob.id and handoff.handoff_type = 'store'), 'proof_count', (select count(*)::int from public.return_proofs proof where proof.return_job_id = rjob.id), 'items', coalesce((select jsonb_agg(jsonb_build_object('title', item.title, 'size', item.size, 'quantity', item.quantity) order by item.title) from public.return_request_items item where item.return_request_id = request.id), '[]'::jsonb)) order by rjob.updated_at desc) from public.return_jobs rjob join public.return_requests request on request.id = rjob.return_request_id join public.orders order_row on order_row.id = request.order_id join public.stores store on store.id = request.store_id left join public.store_pickup_locations pickup on pickup.store_id = store.id left join public.profiles shopper on shopper.id = request.shopper_id where rjob.driver_id = v_driver.id and rjob.status in ('assigned','accepted','at_customer','collected','at_store')), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object('id', history_job.id, 'status', history_job.status, 'order_number', order_row.order_number, 'store_name', store.name, 'delivery_area', order_row.delivery_area, 'delivered_at', history_job.delivered_at, 'failed_at', history_job.failed_at, 'failure_reason', history_job.failure_reason, 'updated_at', history_job.updated_at) order by history_job.updated_at desc) from public.delivery_jobs history_job join public.orders order_row on order_row.id = history_job.order_id join public.stores store on store.id = order_row.store_id where history_job.driver_id = v_driver.id and history_job.status in ('delivered','failed','cancelled') and history_job.updated_at >= now() - interval '30 days'), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.driver_delivery_workspace_data() from public, anon;
grant execute on function public.driver_delivery_workspace_data() to authenticated, service_role;

-- A return taken at the door ends the original delivery attempt. Inventory is
-- intentionally restored only after the owner confirms store receipt.
create or replace function public.close_delivery_after_return_pickup()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'picked_up' and old.status is distinct from new.status then
    update public.delivery_jobs
    set status = 'cancelled', failure_reason = 'Customer returned the order during the delivery handoff.'
    where id = new.original_delivery_job_id and status in ('assigned', 'accepted', 'at_pickup', 'collected');
    update public.orders set status = 'cancelled' where id = new.order_id and status in ('placed', 'accepted', 'picking', 'out_for_delivery');
  end if;
  return new;
end;
$$;
drop trigger if exists close_delivery_after_return_pickup on public.return_requests;
create trigger close_delivery_after_return_pickup
after update of status on public.return_requests
for each row execute function public.close_delivery_after_return_pickup();

notify pgrst, 'reload schema';

notify pgrst, 'reload schema';
