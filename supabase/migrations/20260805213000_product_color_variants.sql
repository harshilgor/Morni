-- Color variants: per-color images, sizes, and stock
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  color_name text not null,
  color_hex text,
  image_urls text[] not null default '{}'::text[],
  sizes text[] not null default array['S', 'M', 'L']::text[],
  stock integer not null default 0 check (stock >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, color_name)
);

create index if not exists product_variants_product_idx
  on public.product_variants (product_id, sort_order);

create trigger product_variants_updated_at
  before update on public.product_variants
  for each row execute function public.set_updated_at();

alter table public.order_items
  add column if not exists color_name text,
  add column if not exists variant_id uuid references public.product_variants (id) on delete set null;

alter table public.product_variants enable row level security;

create policy "product_variants_public_read" on public.product_variants for select using (
  exists (
    select 1
    from public.products p
    join public.stores s on s.id = p.store_id
    where p.id = product_variants.product_id
      and (
        (p.is_available = true and s.is_active = true)
        or public.is_store_member(p.store_id)
      )
  )
);

create policy "product_variants_owner_insert" on public.product_variants for insert with check (
  exists (
    select 1 from public.products p
    where p.id = product_variants.product_id
      and public.is_store_member(p.store_id)
  )
);

create policy "product_variants_owner_update" on public.product_variants for update using (
  exists (
    select 1 from public.products p
    where p.id = product_variants.product_id
      and public.is_store_member(p.store_id)
  )
);

create policy "product_variants_owner_delete" on public.product_variants for delete using (
  exists (
    select 1 from public.products p
    where p.id = product_variants.product_id
      and public.is_store_member(p.store_id)
  )
);

-- Keep products.image_urls / sizes / stock in sync with first/aggregate variants
create or replace function public.sync_product_from_variants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_product_id uuid;
  first_images text[];
  all_sizes text[];
  total_stock integer;
begin
  target_product_id := coalesce(new.product_id, old.product_id);

  select
    coalesce(
      (
        select v.image_urls
        from public.product_variants v
        where v.product_id = target_product_id
        order by v.sort_order, v.created_at
        limit 1
      ),
      '{}'::text[]
    ),
    coalesce(
      (
        select array_agg(distinct size_value order by size_value)
        from public.product_variants v
        cross join lateral unnest(v.sizes) as size_value
        where v.product_id = target_product_id
      ),
      array['S', 'M', 'L']::text[]
    ),
    coalesce(
      (
        select sum(v.stock)::integer
        from public.product_variants v
        where v.product_id = target_product_id
      ),
      0
    )
  into first_images, all_sizes, total_stock;

  if exists (select 1 from public.product_variants where product_id = target_product_id) then
    update public.products
    set
      image_urls = case
        when first_images is not null and cardinality(first_images) > 0 then first_images
        else image_urls
      end,
      sizes = all_sizes,
      stock = total_stock,
      updated_at = now()
    where id = target_product_id;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists product_variants_sync_product on public.product_variants;
create trigger product_variants_sync_product
  after insert or update or delete on public.product_variants
  for each row execute function public.sync_product_from_variants();

-- Atomic checkout with variant stock validation
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
  p_delivery_eta_minutes integer,
  p_items jsonb
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
  v_unit_price numeric;
  v_title text;
  v_color_name text;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to place an order.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty.';
  end if;

  if not exists (
    select 1 from public.stores s
    where s.id = p_store_id and s.is_active = true and s.deleted_at is null
  ) then
    raise exception 'This store is not available.';
  end if;

  -- Validate every line before writing anything
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_variant_id := nullif(v_item->>'variant_id', '')::uuid;
    v_qty := coalesce((v_item->>'quantity')::integer, 0);
    v_size := nullif(trim(v_item->>'size'), '');
    v_unit_price := (v_item->>'unit_price_aed')::numeric;

    if v_qty <= 0 then
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
      where id = v_variant_id
        and product_id = v_product_id
      for update;

      if not found then
        raise exception 'A selected color is no longer available.';
      end if;

      if v_variant.stock < v_qty then
        raise exception '% (%) only has % left.', v_product.title, v_variant.color_name, v_variant.stock;
      end if;

      if v_size is not null
         and cardinality(v_variant.sizes) > 0
         and not (v_size = any (v_variant.sizes)) then
        raise exception 'Size % is not available for %.', v_size, v_variant.color_name;
      end if;
    else
      if v_product.stock < v_qty then
        raise exception '% only has % left.', v_product.title, v_product.stock;
      end if;

      if v_size is not null
         and cardinality(v_product.sizes) > 0
         and not (v_size = any (v_product.sizes)) then
        raise exception 'Size % is not available for %.', v_size, v_product.title;
      end if;
    end if;
  end loop;

  insert into public.orders (
    shopper_id,
    store_id,
    status,
    payment_method,
    payment_status,
    subtotal_aed,
    delivery_fee_aed,
    total_aed,
    delivery_emirate,
    delivery_area,
    delivery_street,
    delivery_building,
    delivery_apartment,
    delivery_notes,
    delivery_eta_minutes
  )
  values (
    v_user_id,
    p_store_id,
    'placed',
    coalesce(p_payment_method, 'cod'),
    'pending',
    p_subtotal_aed,
    coalesce(p_delivery_fee_aed, 0),
    p_total_aed,
    p_delivery_emirate,
    p_delivery_area,
    p_delivery_street,
    nullif(p_delivery_building, ''),
    nullif(p_delivery_apartment, ''),
    nullif(p_delivery_notes, ''),
    coalesce(p_delivery_eta_minutes, 60)
  )
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_variant_id := nullif(v_item->>'variant_id', '')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    v_size := nullif(trim(v_item->>'size'), '');
    v_unit_price := (v_item->>'unit_price_aed')::numeric;
    v_title := coalesce(nullif(trim(v_item->>'title'), ''), 'Item');
    v_color_name := nullif(trim(v_item->>'color_name'), '');

    if v_variant_id is not null then
      update public.product_variants
      set stock = stock - v_qty
      where id = v_variant_id
        and stock >= v_qty;

      if not found then
        raise exception 'Not enough stock for a selected color.';
      end if;

      select color_name into v_color_name
      from public.product_variants
      where id = v_variant_id;
    else
      update public.products
      set stock = stock - v_qty
      where id = v_product_id
        and stock >= v_qty;

      if not found then
        raise exception 'Not enough stock for a selected item.';
      end if;
    end if;

    insert into public.order_items (
      order_id,
      product_id,
      variant_id,
      title,
      size,
      color_name,
      unit_price_aed,
      quantity,
      line_total_aed
    )
    values (
      v_order.id,
      v_product_id,
      v_variant_id,
      v_title,
      v_size,
      v_color_name,
      v_unit_price,
      v_qty,
      v_unit_price * v_qty
    );
  end loop;

  return v_order;
end;
$$;

revoke all on function public.place_order_with_items(
  uuid, public.payment_method, numeric, numeric, numeric, public.uae_emirate,
  text, text, text, text, text, integer, jsonb
) from public;
grant execute on function public.place_order_with_items(
  uuid, public.payment_method, numeric, numeric, numeric, public.uae_emirate,
  text, text, text, text, text, integer, jsonb
) to authenticated;
