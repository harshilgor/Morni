-- Free delivery when item subtotal is AED 199 or more.
-- Mirrors apps/web/src/lib/fees.ts (FREE_DELIVERY_THRESHOLD_AED).

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
  p_shopper_id uuid default null
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
begin
  if v_user_id is null then
    v_user_id := p_shopper_id;
  elsif p_shopper_id is not null and p_shopper_id is distinct from v_user_id then
    raise exception 'You must be signed in to place an order.';
  end if;
  if v_user_id is null then
    raise exception 'You must be signed in to place an order.';
  end if;

  -- COD is the unpaid test path until an online payment provider is connected.
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

  select s.delivery_eta_minutes into v_delivery_eta
  from public.stores s
  where s.id = p_store_id
    and s.is_active = true
    and s.deleted_at is null;
  if not found then
    raise exception 'This store is not available.';
  end if;

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
    delivery_apartment, delivery_notes, delivery_phone, delivery_eta_minutes
  )
  values (
    v_user_id, p_store_id, 'placed', p_payment_method, 'pending',
    v_subtotal, v_small_order_fee, v_delivery_fee, v_service_fee,
    v_subtotal + v_small_order_fee + v_delivery_fee + v_service_fee,
    p_delivery_emirate, trim(p_delivery_area), trim(p_delivery_street),
    nullif(trim(p_delivery_building), ''), nullif(trim(p_delivery_apartment), ''),
    nullif(trim(p_delivery_notes), ''), nullif(trim(p_delivery_phone), ''), v_delivery_eta
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
      update public.products
      set stock = stock - v_qty
      where id = v_product_id and stock >= v_qty;
      if not found then
        raise exception 'Not enough stock for a selected item.';
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
  text, text, text, text, text, text, integer, jsonb, uuid
) from public, anon, authenticated;

grant execute on function public.place_order_with_items(
  uuid, public.payment_method, numeric, numeric, numeric, public.uae_emirate,
  text, text, text, text, text, text, integer, jsonb, uuid
) to service_role;

notify pgrst, 'reload schema';
