-- Stop charging the AED 15 small-order fee. Keep the column so historical
-- orders and refunds still show what was collected.

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

  small_fee := 0;
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
