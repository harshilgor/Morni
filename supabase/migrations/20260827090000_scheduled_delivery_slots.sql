-- Scheduled delivery windows chosen at checkout.

alter table public.products
  add column if not exists size_stock jsonb not null default '{}'::jsonb;

alter table public.orders
  add column if not exists delivery_slot_start timestamptz,
  add column if not exists delivery_slot_end timestamptz;

comment on column public.orders.delivery_slot_start is
  'Dubai-local delivery window start chosen by the shopper at checkout.';
comment on column public.orders.delivery_slot_end is
  'Dubai-local delivery window end chosen by the shopper at checkout.';

create index if not exists orders_delivery_slot_start_idx
  on public.orders (delivery_slot_start);

-- Replace checkout RPC so new orders require a bookable delivery window.
drop function if exists public.place_order_with_items(
  uuid, public.payment_method, numeric, numeric, numeric, public.uae_emirate,
  text, text, text, text, text, text, integer, jsonb, uuid
);

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
  if v_user_id is null then
    v_user_id := p_shopper_id;
  elsif p_shopper_id is not null and p_shopper_id is distinct from v_user_id then
    raise exception 'You must be signed in to place an order.';
  end if;
  if v_user_id is null then
    raise exception 'You must be signed in to place an order.';
  end if;

  if p_payment_method is null or p_payment_method not in ('cod', 'card', 'apple_pay', 'tabby', 'tamara') then
    raise exception 'Choose a supported payment method.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    raise exception 'Cart must contain between 1 and 30 items.';
  end if;
  if nullif(trim(p_delivery_area), '') is null
     or nullif(trim(p_delivery_street), '') is null
     or char_length(p_delivery_area) > 120
     or char_length(p_delivery_street) > 240
     or char_length(coalesce(p_delivery_building, '')) > 120
     or char_length(coalesce(p_delivery_apartment, '')) > 80
     or char_length(coalesce(p_delivery_phone, '')) > 40
     or char_length(coalesce(p_delivery_notes, '')) > 1000 then
    raise exception 'Delivery details are invalid.';
  end if;

  if v_slot_start is null or v_slot_end is null then
    raise exception 'Choose a delivery time slot.';
  end if;
  if v_slot_end <= v_slot_start then
    raise exception 'Delivery time slot is invalid.';
  end if;

  v_local_start := timezone('Asia/Dubai', v_slot_start);
  v_local_end := timezone('Asia/Dubai', v_slot_end);
  if v_local_start::date is distinct from v_local_end::date then
    raise exception 'Delivery time slot is invalid.';
  end if;

  v_start_minutes := extract(hour from v_local_start)::integer * 60
    + extract(minute from v_local_start)::integer;
  v_end_minutes := extract(hour from v_local_end)::integer * 60
    + extract(minute from v_local_end)::integer;

  if not (
    (v_start_minutes = 600 and v_end_minutes = 690)
    or (v_start_minutes = 690 and v_end_minutes = 810)
    or (v_start_minutes = 810 and v_end_minutes = 870)
    or (v_start_minutes = 870 and v_end_minutes = 960)
    or (v_start_minutes = 960 and v_end_minutes = 1080)
  ) then
    raise exception 'Choose a valid delivery time slot.';
  end if;

  -- Same-day bookings close at 6:30 PM Dubai; later windows must be tomorrow+.
  if v_local_start::date = v_now_dubai::date
     and v_now_dubai::time >= time '18:30' then
    raise exception 'Same-day delivery booking has closed. Choose a tomorrow slot.';
  end if;
  if v_slot_start <= now() then
    raise exception 'That delivery slot is no longer available.';
  end if;
  if v_local_start::date > (v_now_dubai::date + 1) then
    raise exception 'Delivery time slot is invalid.';
  end if;

  select s.delivery_eta_minutes into v_delivery_eta
  from public.stores s
  where s.id = p_store_id
    and s.is_active = true
    and s.deleted_at is null;
  if not found then
    raise exception 'This store is not available.';
  end if;

  v_eta_from_slot := greatest(
    1,
    ceil(extract(epoch from (v_slot_end - now())) / 60.0)::integer
  );
  v_delivery_eta := v_eta_from_slot;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_variant_id := nullif(v_item->>'variant_id', '')::uuid;
    v_qty := coalesce((v_item->>'quantity')::integer, 0);
    v_size := nullif(trim(v_item->>'size'), '');

    if v_qty <= 0 or v_qty > 25 then
      raise exception 'Invalid quantity.';
    end if;

    select * into v_product
    from public.products
    where id = v_product_id
      and store_id = p_store_id
      and is_available = true
    for update;
    if not found then
      raise exception 'A product in your cart is no longer available.';
    end if;

    if v_variant_id is not null then
      select * into v_variant
      from public.product_variants
      where id = v_variant_id and product_id = v_product_id
      for update;
      if not found or v_variant.stock < v_qty then
        raise exception 'A selected colour is no longer available.';
      end if;
      if v_size is not null and cardinality(v_variant.sizes) > 0
         and not (v_size = any (v_variant.sizes)) then
        raise exception 'Selected size is no longer available.';
      end if;
    elsif v_size is not null and v_product.size_stock <> '{}'::jsonb and coalesce((v_product.size_stock->>v_size)::integer, 0) < v_qty then
      raise exception '% (%) only has % left.', v_product.title, v_size, coalesce((v_product.size_stock->>v_size)::integer, 0);
    elsif v_product.stock < v_qty then
      raise exception '% only has % left.', v_product.title, v_product.stock;
    elsif v_size is not null and cardinality(v_product.sizes) > 0
       and not (v_size = any (v_product.sizes)) then
      raise exception 'Selected size is no longer available.';
    end if;

    v_subtotal := v_subtotal + public.sale_price_for_product(v_product.id, v_product.price_aed) * v_qty;
  end loop;

  v_small_order_fee := case when v_subtotal < 99 then 15 else 0 end;
  v_delivery_fee := case when v_subtotal >= 199 then 0 else 7 end;

  insert into public.orders (
    shopper_id, store_id, status, payment_method, payment_status,
    subtotal_aed, small_order_fee_aed, delivery_fee_aed, service_fee_aed, total_aed,
    delivery_emirate, delivery_area, delivery_street, delivery_building,
    delivery_apartment, delivery_notes, delivery_phone, delivery_eta_minutes,
    delivery_slot_start, delivery_slot_end
  )
  values (
    v_user_id, p_store_id, 'placed', p_payment_method, 'pending',
    v_subtotal, v_small_order_fee, v_delivery_fee, v_service_fee,
    v_subtotal + v_small_order_fee + v_delivery_fee + v_service_fee,
    p_delivery_emirate, trim(p_delivery_area), trim(p_delivery_street),
    nullif(trim(p_delivery_building), ''), nullif(trim(p_delivery_apartment), ''),
    nullif(trim(p_delivery_notes), ''), nullif(trim(p_delivery_phone), ''), v_delivery_eta,
    v_slot_start, v_slot_end
  )
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_variant_id := nullif(v_item->>'variant_id', '')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    v_size := nullif(trim(v_item->>'size'), '');
    select * into v_product from public.products where id = v_product_id for update;

    if v_variant_id is not null then
      update public.product_variants
      set stock = stock - v_qty
      where id = v_variant_id and stock >= v_qty;
      if not found then
        raise exception 'Not enough stock for a selected colour.';
      end if;
      select color_name into v_color_name from public.product_variants where id = v_variant_id;
    else
      if v_size is not null and v_product.size_stock <> '{}'::jsonb then
        update public.products
        set size_stock = jsonb_set(size_stock, array[v_size], to_jsonb((size_stock->>v_size)::integer - v_qty), false)
        where id = v_product_id and coalesce((size_stock->>v_size)::integer, 0) >= v_qty;
      else
        update public.products set stock = stock - v_qty where id = v_product_id and stock >= v_qty;
      end if;
      if not found then
        raise exception 'Not enough stock for the selected size.';
      end if;
      v_color_name := null;
    end if;

    insert into public.order_items (
      order_id, product_id, variant_id, title, size, color_name,
      unit_price_aed, quantity, line_total_aed
    )
    values (
      v_order.id, v_product_id, v_variant_id, v_product.title, v_size, v_color_name,
      public.sale_price_for_product(v_product.id, v_product.price_aed), v_qty,
      public.sale_price_for_product(v_product.id, v_product.price_aed) * v_qty
    );
  end loop;

  return v_order;
end;
$$;

revoke all on function public.place_order_with_items(
  uuid, public.payment_method, numeric, numeric, numeric, public.uae_emirate,
  text, text, text, text, text, text, integer, jsonb, uuid, timestamptz, timestamptz
) from public, anon, authenticated;

grant execute on function public.place_order_with_items(
  uuid, public.payment_method, numeric, numeric, numeric, public.uae_emirate,
  text, text, text, text, text, text, integer, jsonb, uuid, timestamptz, timestamptz
) to service_role;

notify pgrst, 'reload schema';
