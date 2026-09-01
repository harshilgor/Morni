-- Colour variants are the inventory unit for products with colour choices.
-- A variant can carry its own gallery, optional videos, and exact stock per size.

alter table public.product_variants
  add column if not exists video_urls text[] not null default '{}'::text[],
  add column if not exists size_stock jsonb not null default '{}'::jsonb;

alter table public.product_variants
  drop constraint if exists product_variants_size_stock_object;
alter table public.product_variants
  add constraint product_variants_size_stock_object
  check (jsonb_typeof(size_stock) = 'object');

create or replace function public.sync_variant_size_inventory()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  quantity integer;
begin
  if new.size_stock is null then new.size_stock := '{}'::jsonb; end if;
  if jsonb_typeof(new.size_stock) <> 'object' then
    raise exception 'Size stock must be an object.';
  end if;
  if exists (
    select 1 from jsonb_each_text(new.size_stock) entry
    where entry.value !~ '^[0-9]+$'
  ) then
    raise exception 'Size quantities must be whole numbers.';
  end if;
  if new.size_stock <> '{}'::jsonb then
    select coalesce(sum(entry.value::integer), 0)::integer
      into quantity
      from jsonb_each_text(new.size_stock) entry;
    new.stock := quantity;
    select coalesce(array_agg(entry.key order by entry.key), '{}'::text[])
      into new.sizes
      from jsonb_each_text(new.size_stock) entry;
  end if;
  return new;
end;
$$;

drop trigger if exists product_variants_sync_size_inventory on public.product_variants;
create trigger product_variants_sync_size_inventory
before insert or update of size_stock on public.product_variants
for each row execute function public.sync_variant_size_inventory();

create or replace function public.sync_product_from_variants()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_product_id uuid := coalesce(new.product_id, old.product_id);
  first_images text[];
  all_sizes text[];
  total_stock integer;
  all_size_stock jsonb;
begin
  select
    coalesce((select v.image_urls from public.product_variants v where v.product_id = target_product_id order by v.sort_order, v.created_at limit 1), '{}'::text[]),
    coalesce((select array_agg(distinct size_value order by size_value) from public.product_variants v cross join lateral unnest(v.sizes) as size_value where v.product_id = target_product_id), '{}'::text[]),
    coalesce((select sum(v.stock)::integer from public.product_variants v where v.product_id = target_product_id), 0),
    coalesce((select jsonb_object_agg(entry.key, entry.total) from (select item.key, sum(item.value::integer)::integer as total from public.product_variants v cross join lateral jsonb_each_text(v.size_stock) item where v.product_id = target_product_id and v.size_stock <> '{}'::jsonb group by item.key) entry), '{}'::jsonb)
  into first_images, all_sizes, total_stock, all_size_stock;

  if exists (select 1 from public.product_variants where product_id = target_product_id) then
    update public.products
    set image_urls = case when cardinality(first_images) > 0 then first_images else image_urls end,
        sizes = all_sizes,
        stock = total_stock,
        size_stock = all_size_stock,
        updated_at = now()
    where id = target_product_id;
  end if;
  return coalesce(new, old);
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-videos', 'product-videos', true, 52428800, array['video/mp4', 'video/webm']::text[])
on conflict (id) do update set public = true, file_size_limit = 52428800, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "product_videos_public_read" on storage.objects;
create policy "product_videos_public_read" on storage.objects for select using (bucket_id = 'product-videos');
drop policy if exists "product_videos_member_upload" on storage.objects;
create policy "product_videos_member_upload" on storage.objects for insert to authenticated
with check (bucket_id = 'product-videos' and public.is_store_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "product_videos_member_update" on storage.objects;
create policy "product_videos_member_update" on storage.objects for update to authenticated
using (bucket_id = 'product-videos' and public.is_store_member(((storage.foldername(name))[1])::uuid))
with check (bucket_id = 'product-videos' and public.is_store_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "product_videos_member_delete" on storage.objects;
create policy "product_videos_member_delete" on storage.objects for delete to authenticated
using (bucket_id = 'product-videos' and public.is_store_member(((storage.foldername(name))[1])::uuid));

-- Checkout remains the final authority. The client display is helpful, but this
-- locked function prevents overselling when two shoppers check out together.
create or replace function public.place_order_with_items(
  p_store_id uuid, p_payment_method public.payment_method, p_subtotal_aed numeric,
  p_delivery_fee_aed numeric, p_total_aed numeric, p_delivery_emirate public.uae_emirate,
  p_delivery_area text, p_delivery_street text, p_delivery_building text,
  p_delivery_apartment text, p_delivery_notes text, p_delivery_phone text,
  p_delivery_eta_minutes integer, p_items jsonb, p_shopper_id uuid default null,
  p_delivery_slot_start timestamptz default null, p_delivery_slot_end timestamptz default null
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := coalesce(auth.uid(), p_shopper_id);
  v_order public.orders;
  item jsonb;
  product_row public.products;
  variant_row public.product_variants;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_size_name text;
  v_color_name text;
  subtotal numeric := 0;
  small_fee numeric := 0;
  delivery_fee numeric := 7;
  service_fee numeric := 3;
  local_start timestamp;
  local_end timestamp;
  start_minutes integer;
  end_minutes integer;
  now_dubai timestamp := timezone('Asia/Dubai', now());
begin
  if v_user_id is null then raise exception 'You must be signed in to place an order.'; end if;
  if auth.uid() is not null and p_shopper_id is not null and p_shopper_id is distinct from auth.uid() then raise exception 'You must be signed in to place an order.'; end if;
  if p_payment_method is null or p_payment_method not in ('cod', 'card', 'apple_pay', 'tabby', 'tamara') then raise exception 'Choose a supported payment method.'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then raise exception 'Cart must contain between 1 and 30 items.'; end if;
  if not exists (select 1 from public.stores where id = p_store_id and is_active and deleted_at is null) then raise exception 'This store is not available.'; end if;
  if nullif(trim(p_delivery_area), '') is null or nullif(trim(p_delivery_street), '') is null or char_length(p_delivery_area) > 120 or char_length(p_delivery_street) > 240 or char_length(coalesce(p_delivery_building, '')) > 120 or char_length(coalesce(p_delivery_apartment, '')) > 80 or char_length(coalesce(p_delivery_phone, '')) > 40 or char_length(coalesce(p_delivery_notes, '')) > 1000 then raise exception 'Delivery details are invalid.'; end if;
  if p_delivery_slot_start is null or p_delivery_slot_end is null or p_delivery_slot_end <= p_delivery_slot_start then raise exception 'Delivery time slot is invalid.'; end if;
  local_start := timezone('Asia/Dubai', p_delivery_slot_start);
  local_end := timezone('Asia/Dubai', p_delivery_slot_end);
  start_minutes := extract(hour from local_start)::integer * 60 + extract(minute from local_start)::integer;
  end_minutes := extract(hour from local_end)::integer * 60 + extract(minute from local_end)::integer;
  if local_start::date is distinct from local_end::date or not ((start_minutes = 600 and end_minutes = 690) or (start_minutes = 690 and end_minutes = 810) or (start_minutes = 810 and end_minutes = 870) or (start_minutes = 870 and end_minutes = 960) or (start_minutes = 960 and end_minutes = 1080)) then raise exception 'Choose a valid delivery time slot.'; end if;
  if p_delivery_slot_start <= now() then raise exception 'That delivery slot is no longer available.'; end if;
  if local_start::date > (now_dubai::date + 1) then raise exception 'Delivery time slot is invalid.'; end if;

  for item in select * from jsonb_array_elements(p_items) loop
    v_product_id := (item->>'product_id')::uuid;
    v_variant_id := nullif(item->>'variant_id', '')::uuid;
    v_quantity := coalesce((item->>'quantity')::integer, 0);
    v_size_name := nullif(trim(item->>'size'), '');
    if v_quantity <= 0 or v_quantity > 25 then raise exception 'Invalid quantity.'; end if;
    select * into product_row from public.products p where p.id = v_product_id and p.store_id = p_store_id and p.is_available for update;
    if not found then raise exception 'A product in your cart is no longer available.'; end if;
    if v_variant_id is not null then
      select * into variant_row from public.product_variants pv where pv.id = v_variant_id and pv.product_id = v_product_id for update;
      if not found then raise exception 'A selected colour is no longer available.'; end if;
      if cardinality(variant_row.sizes) > 0 and v_size_name is null then raise exception 'Choose a size for %.', variant_row.color_name; end if;
      if v_size_name is not null and cardinality(variant_row.sizes) > 0 and not (v_size_name = any(variant_row.sizes)) then raise exception 'Selected size is no longer available.'; end if;
      if variant_row.size_stock <> '{}'::jsonb then
        if v_size_name is null or coalesce((variant_row.size_stock->>v_size_name)::integer, 0) < v_quantity then raise exception '% (%) only has % left.', product_row.title, coalesce(v_size_name, variant_row.color_name), coalesce((variant_row.size_stock->>v_size_name)::integer, 0); end if;
      elsif variant_row.stock < v_quantity then raise exception '% (%) only has % left.', product_row.title, variant_row.color_name, variant_row.stock; end if;
    elsif v_size_name is not null and product_row.size_stock <> '{}'::jsonb then
      if coalesce((product_row.size_stock->>v_size_name)::integer, 0) < v_quantity then raise exception '% (%) only has % left.', product_row.title, v_size_name, coalesce((product_row.size_stock->>v_size_name)::integer, 0); end if;
    elsif product_row.stock < v_quantity then raise exception '% only has % left.', product_row.title, product_row.stock; end if;
    if v_size_name is not null and cardinality(product_row.sizes) > 0 and v_variant_id is null and not (v_size_name = any(product_row.sizes)) then raise exception 'Selected size is no longer available.'; end if;
    subtotal := subtotal + public.sale_price_for_product(product_row.id, product_row.price_aed) * v_quantity;
  end loop;

  small_fee := case when subtotal < 99 then 15 else 0 end;
  delivery_fee := case when subtotal >= 199 then 0 else 7 end;
  insert into public.orders (shopper_id, store_id, status, payment_method, payment_status, subtotal_aed, small_order_fee_aed, delivery_fee_aed, service_fee_aed, total_aed, delivery_emirate, delivery_area, delivery_street, delivery_building, delivery_apartment, delivery_notes, delivery_phone, delivery_eta_minutes, delivery_slot_start, delivery_slot_end)
  values (v_user_id, p_store_id, 'placed', p_payment_method, 'pending', subtotal, small_fee, delivery_fee, service_fee, subtotal + small_fee + delivery_fee + service_fee, p_delivery_emirate, trim(p_delivery_area), trim(p_delivery_street), nullif(trim(p_delivery_building), ''), nullif(trim(p_delivery_apartment), ''), nullif(trim(p_delivery_notes), ''), nullif(trim(p_delivery_phone), ''), p_delivery_eta_minutes, p_delivery_slot_start, p_delivery_slot_end)
  returning * into v_order;

  for item in select * from jsonb_array_elements(p_items) loop
    v_product_id := (item->>'product_id')::uuid;
    v_variant_id := nullif(item->>'variant_id', '')::uuid;
    v_quantity := (item->>'quantity')::integer;
    v_size_name := nullif(trim(item->>'size'), '');
    select * into product_row from public.products p where p.id = v_product_id for update;
    if v_variant_id is not null then
      if v_size_name is not null and (select pv.size_stock from public.product_variants pv where pv.id = v_variant_id) <> '{}'::jsonb then
        update public.product_variants set size_stock = jsonb_set(size_stock, array[v_size_name], to_jsonb((size_stock->>v_size_name)::integer - v_quantity), false) where id = v_variant_id and coalesce((size_stock->>v_size_name)::integer, 0) >= v_quantity;
      else
        update public.product_variants set stock = stock - v_quantity where id = v_variant_id and stock >= v_quantity;
      end if;
      if not found then raise exception 'Not enough stock for the selected colour and size.'; end if;
      select pv.color_name into v_color_name from public.product_variants pv where pv.id = v_variant_id;
    elsif v_size_name is not null and product_row.size_stock <> '{}'::jsonb then
      update public.products set size_stock = jsonb_set(size_stock, array[v_size_name], to_jsonb((size_stock->>v_size_name)::integer - v_quantity), false) where id = v_product_id and coalesce((size_stock->>v_size_name)::integer, 0) >= v_quantity;
      if not found then raise exception 'Not enough stock for the selected size.'; end if;
      v_color_name := null;
    else
      update public.products set stock = stock - v_quantity where id = v_product_id and stock >= v_quantity;
      if not found then raise exception 'Not enough stock.'; end if;
      v_color_name := null;
    end if;
    insert into public.order_items (order_id, product_id, variant_id, title, size, color_name, unit_price_aed, quantity, line_total_aed, customization)
    values (v_order.id, v_product_id, v_variant_id, product_row.title, v_size_name, v_color_name, public.sale_price_for_product(v_product_id, product_row.price_aed), v_quantity, public.sale_price_for_product(v_product_id, product_row.price_aed) * v_quantity, case when jsonb_typeof(item->'customization') = 'object' and item->'customization' <> '{}'::jsonb then item->'customization' else null end);
  end loop;
  return v_order;
end;
$$;

revoke all on function public.place_order_with_items(uuid, public.payment_method, numeric, numeric, numeric, public.uae_emirate, text, text, text, text, text, text, integer, jsonb, uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.place_order_with_items(uuid, public.payment_method, numeric, numeric, numeric, public.uae_emirate, text, text, text, text, text, text, integer, jsonb, uuid, timestamptz, timestamptz) to service_role;

-- Put cancelled/failed orders back into the exact colour + size bucket.
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
  if v_order.status not in ('placed', 'accepted', 'picking', 'out_for_delivery') then raise exception 'Order cannot be cancelled.'; end if;
  for item in select * from public.order_items where order_id = p_order_id order by id loop
    insert into public.order_inventory_adjustments(order_id, order_item_id, product_id, variant_id, size, quantity, reason)
    values (p_order_id, item.id, item.product_id, item.variant_id, item.size, item.quantity, 'cancelled')
    on conflict (order_id, order_item_id, reason) do nothing returning id into adjustment_id;
    if adjustment_id is null then continue; end if;
    if item.variant_id is not null and item.size is not null and exists (select 1 from public.product_variants pv where pv.id = item.variant_id and pv.size_stock <> '{}'::jsonb) then
      select coalesce((pv.size_stock->>item.size)::integer, 0) into current_qty from public.product_variants pv where pv.id = item.variant_id for update;
      update public.product_variants set size_stock = jsonb_set(size_stock, array[item.size], to_jsonb(current_qty + item.quantity), true) where id = item.variant_id;
    elsif item.variant_id is not null then
      update public.product_variants set stock = stock + item.quantity where id = item.variant_id;
    elsif item.size is not null and exists (select 1 from public.products p where p.id = item.product_id and p.size_stock <> '{}'::jsonb) then
      select coalesce((p.size_stock->>item.size)::integer, 0) into current_qty from public.products p where p.id = item.product_id for update;
      update public.products set size_stock = jsonb_set(size_stock, array[item.size], to_jsonb(current_qty + item.quantity), true) where id = item.product_id;
    else
      update public.products set stock = stock + item.quantity where id = item.product_id;
    end if;
    insert into public.store_inventory_notifications(store_id, product_id, order_id, kind, title, detail, payload)
    values (v_order.store_id, item.product_id, p_order_id, 'restored_inventory', 'Inventory restored after cancellation', format('%s × %s returned to inventory.', item.quantity, coalesce(item.size, 'standard')), jsonb_build_object('product_id', item.product_id, 'size', item.size, 'quantity', item.quantity, 'variant_id', item.variant_id));
  end loop;
  update public.orders set status = 'cancelled' where id = p_order_id returning * into v_order;
  return v_order;
end;
$$;

revoke all on function public.cancel_order_and_restore_inventory(uuid) from public, anon, authenticated;
grant execute on function public.cancel_order_and_restore_inventory(uuid) to service_role;

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
  v_variant public.product_variants;
  v_stock integer;
  v_level text;
  v_refund public.return_refunds;
begin
  select * into v_request from public.return_requests where id = p_return_request_id for update;
  if not found or not public.is_store_member(v_request.store_id) then raise exception 'Return access is restricted.'; end if;
  if v_request.status <> 'at_store' then raise exception 'The driver must mark the return as at the store first.'; end if;
  select * into v_job from public.return_jobs where return_request_id = v_request.id for update;
  if not found then raise exception 'Return pickup job not found.'; end if;
  for v_item in select * from public.return_request_items where return_request_id = v_request.id order by id loop
    if exists (select 1 from public.return_inventory_adjustments where return_request_id = v_request.id and return_request_item_id = v_item.id) then continue; end if;
    if v_item.product_id is null then
      v_level := 'unavailable';
    else
      select * into v_product from public.products where id = v_item.product_id for update;
      if not found then
        v_level := 'unavailable';
      else
        select pv.* into v_variant from public.product_variants pv join public.order_items oi on oi.variant_id = pv.id where oi.id = v_item.order_item_id for update;
        if found and v_item.size is not null and v_variant.size_stock <> '{}'::jsonb then
          v_stock := greatest(0, coalesce((v_variant.size_stock->>v_item.size)::integer, 0)) + v_item.quantity;
          update public.product_variants set size_stock = jsonb_set(size_stock, array[v_item.size], to_jsonb(v_stock), true) where id = v_variant.id;
          v_level := 'variant_size';
        elsif found then
          update public.product_variants set stock = stock + v_item.quantity where id = v_variant.id;
          v_level := 'variant';
        elsif coalesce(v_product.size_stock, '{}'::jsonb) <> '{}'::jsonb and v_item.size is not null then
          v_stock := greatest(0, coalesce((v_product.size_stock->>v_item.size)::integer, 0)) + v_item.quantity;
          update public.products set size_stock = jsonb_set(coalesce(size_stock, '{}'::jsonb), array[v_item.size], to_jsonb(v_stock), true) where id = v_product.id;
          v_level := 'size';
        else
          update public.products set stock = stock + v_item.quantity where id = v_product.id;
          v_level := 'product';
        end if;
      end if;
    end if;
    insert into public.return_inventory_adjustments(return_request_id, return_request_item_id, product_id, quantity, inventory_level) values (v_request.id, v_item.id, v_item.product_id, v_item.quantity, v_level);
  end loop;
  insert into public.return_refunds(return_request_id, order_id, shopper_id, amount_aed, method) values (v_request.id, v_request.order_id, v_request.shopper_id, v_request.quoted_refund_aed, v_request.refund_method) on conflict (return_request_id) do nothing returning * into v_refund;
  update public.return_jobs set status = 'completed', completed_at = now() where id = v_job.id;
  update public.return_requests set status = 'refund_pending', received_at = now() where id = v_request.id returning * into v_request;
  insert into public.return_events(return_request_id, return_job_id, event_type, actor_user_id, note) values (v_request.id, v_job.id, 'received', auth.uid(), coalesce(nullif(trim(p_note), ''), 'The store confirmed receipt of the returned items. Inventory was restored and the refund is ready for processing.'));
  return jsonb_build_object('id', v_request.id, 'status', v_request.status, 'refund_id', coalesce(v_refund.id, (select id from public.return_refunds where return_request_id = v_request.id)), 'refund_amount_aed', v_request.quoted_refund_aed);
end;
$$;
