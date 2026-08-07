-- Real product sales and optional storefront campaigns.
-- Base product prices remain unchanged; effective prices are calculated at read and checkout time.

alter table public.store_promotions
  add column if not exists promotion_kind text not null default 'campaign'
    check (promotion_kind in ('sale', 'campaign')),
  add column if not exists discount_type text
    check (discount_type in ('percent', 'flat_aed'));

update public.store_promotions
set
  promotion_kind = 'campaign',
  is_active = false;

create table if not exists public.promotion_products (
  promotion_id uuid not null references public.store_promotions (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (promotion_id, product_id)
);

create index if not exists promotion_products_product_idx
  on public.promotion_products (product_id);

alter table public.promotion_products enable row level security;

drop policy if exists "promotion_products_owner_access" on public.promotion_products;
create policy "promotion_products_owner_access"
  on public.promotion_products for all
  using (
    exists (
      select 1
      from public.store_promotions sp
      where sp.id = promotion_products.promotion_id
        and public.is_store_member(sp.store_id)
    )
  )
  with check (
    exists (
      select 1
      from public.store_promotions sp
      join public.products p on p.id = promotion_products.product_id
      where sp.id = promotion_products.promotion_id
        and p.store_id = sp.store_id
        and public.is_store_member(sp.store_id)
    )
  );

create or replace function public.sale_price_for_product(
  p_product_id uuid,
  p_base_price numeric
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select greatest(
        0.01,
        case sp.discount_type
          when 'percent' then round(p_base_price * (1 - sp.value_percent / 100), 2)
          when 'flat_aed' then round(p_base_price - sp.value_aed, 2)
          else p_base_price
        end
      )
      from public.promotion_products pp
      join public.store_promotions sp on sp.id = pp.promotion_id
      where pp.product_id = p_product_id
        and sp.promotion_kind = 'sale'
        and sp.is_active = true
        and coalesce(sp.starts_at, now()) <= now()
        and (sp.ends_at is null or sp.ends_at > now())
      order by
        case sp.discount_type
          when 'percent' then p_base_price * (1 - sp.value_percent / 100)
          when 'flat_aed' then p_base_price - sp.value_aed
          else p_base_price
        end asc,
        sp.created_at desc
      limit 1
    ),
    p_base_price
  );
$$;

create or replace view public.storefront_products
with (security_invoker = true)
as
select
  (
    jsonb_populate_record(
      null::public.products,
      to_jsonb(p) || jsonb_build_object(
        'price_aed', public.sale_price_for_product(p.id, p.price_aed),
        'compare_at_price_aed',
          case
            when public.sale_price_for_product(p.id, p.price_aed) < p.price_aed
              then greatest(coalesce(p.compare_at_price_aed, p.price_aed), p.price_aed)
            else p.compare_at_price_aed
          end
      )
    )
  ).*,
  public.sale_price_for_product(p.id, p.price_aed) as effective_price_aed,
  p.price_aed as base_price_aed,
  (
    select sp.title
    from public.promotion_products pp
    join public.store_promotions sp on sp.id = pp.promotion_id
    where pp.product_id = p.id
      and sp.promotion_kind = 'sale'
      and sp.is_active = true
      and coalesce(sp.starts_at, now()) <= now()
      and (sp.ends_at is null or sp.ends_at > now())
    order by public.sale_price_for_product(p.id, p.price_aed), sp.created_at desc
    limit 1
  ) as promotion_title
from public.products p;

grant select on public.storefront_products to anon, authenticated;

create or replace function public.save_product_sale(
  p_promotion_id uuid,
  p_title text,
  p_discount_type text,
  p_discount_value numeric,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_product_ids uuid[],
  p_replace_product_ids uuid[] default '{}'
)
returns public.store_promotions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_store_id uuid;
  v_promotion public.store_promotions;
begin
  if v_user_id is null then
    raise exception 'You must be signed in.';
  end if;
  if nullif(trim(p_title), '') is null then
    raise exception 'Sale name is required.';
  end if;
  if p_discount_type not in ('percent', 'flat_aed') then
    raise exception 'Choose a supported discount type.';
  end if;
  if p_discount_value is null or p_discount_value <= 0 then
    raise exception 'Discount value must be greater than zero.';
  end if;
  if p_discount_type = 'percent' and p_discount_value >= 100 then
    raise exception 'Percentage discounts must be below 100 percent.';
  end if;
  if cardinality(p_product_ids) is null or cardinality(p_product_ids) = 0 then
    raise exception 'Choose at least one product.';
  end if;
  if p_ends_at is not null and p_ends_at <= coalesce(p_starts_at, now()) then
    raise exception 'End time must be after the start time.';
  end if;

  select p.store_id into v_store_id
  from public.products p
  where p.id = p_product_ids[1];

  if v_store_id is null or not public.is_store_member(v_store_id) then
    raise exception 'You do not have permission to manage these products.';
  end if;
  if exists (
    select 1
    from public.products p
    where p.id = any(p_product_ids)
      and p.store_id <> v_store_id
  ) then
    raise exception 'A sale can only contain products from one store.';
  end if;

  if p_promotion_id is not null then
    select * into v_promotion
    from public.store_promotions
    where id = p_promotion_id
      and store_id = v_store_id
      and promotion_kind = 'sale';

    if not found then
      raise exception 'Sale not found.';
    end if;
  end if;

  if exists (
    select 1
    from public.promotion_products pp
    join public.store_promotions sp on sp.id = pp.promotion_id
    where pp.product_id = any(p_product_ids)
      and sp.promotion_kind = 'sale'
      and sp.store_id = v_store_id
      and sp.id <> coalesce(p_promotion_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and sp.is_active = true
      and (sp.ends_at is null or sp.ends_at > now())
      and pp.product_id <> all(coalesce(p_replace_product_ids, '{}'))
  ) then
    raise exception 'Resolve every conflicting product before saving this sale.';
  end if;

  delete from public.promotion_products pp
  using public.store_promotions sp
  where pp.promotion_id = sp.id
    and pp.product_id = any(coalesce(p_replace_product_ids, '{}'))
    and sp.store_id = v_store_id
    and sp.promotion_kind = 'sale'
    and sp.id <> coalesce(p_promotion_id, '00000000-0000-0000-0000-000000000000'::uuid);

  if p_promotion_id is null then
    insert into public.store_promotions (
      store_id, title, promo_type, promotion_kind, discount_type,
      value_percent, value_aed, starts_at, ends_at, is_active
    )
    values (
      v_store_id,
      trim(p_title),
      case when p_discount_type = 'percent' then 'percent_off' else 'flat_off' end,
      'sale',
      p_discount_type,
      case when p_discount_type = 'percent' then p_discount_value else null end,
      case when p_discount_type = 'flat_aed' then p_discount_value else null end,
      coalesce(p_starts_at, now()),
      p_ends_at,
      true
    )
    returning * into v_promotion;
  else
    update public.store_promotions
    set
      title = trim(p_title),
      promo_type = case when p_discount_type = 'percent' then 'percent_off' else 'flat_off' end,
      discount_type = p_discount_type,
      value_percent = case when p_discount_type = 'percent' then p_discount_value else null end,
      value_aed = case when p_discount_type = 'flat_aed' then p_discount_value else null end,
      starts_at = coalesce(p_starts_at, now()),
      ends_at = p_ends_at,
      is_active = true
    where id = p_promotion_id
    returning * into v_promotion;

    delete from public.promotion_products where promotion_id = v_promotion.id;
  end if;

  insert into public.promotion_products (promotion_id, product_id)
  select v_promotion.id, product_id
  from unnest(p_product_ids) as product_id;

  return v_promotion;
end;
$$;

revoke all on function public.save_product_sale(
  uuid, text, text, numeric, timestamptz, timestamptz, uuid[], uuid[]
) from public;
grant execute on function public.save_product_sale(
  uuid, text, text, numeric, timestamptz, timestamptz, uuid[], uuid[]
) to authenticated;

create or replace function public.active_store_campaign(p_store_id uuid)
returns setof public.store_promotions
language sql
stable
security definer
set search_path = public
as $campaign$
  select sp.*
  from public.store_promotions sp
  where sp.store_id = p_store_id
    and sp.promotion_kind = 'campaign'
    and sp.is_active = true
    and coalesce(sp.starts_at, now()) <= now()
    and (sp.ends_at is null or sp.ends_at > now())
  order by sp.created_at desc
  limit 1;
$campaign$;

revoke all on function public.active_store_campaign(uuid) from public;
grant execute on function public.active_store_campaign(uuid) to anon, authenticated;

-- Checkout always writes database-calculated effective prices.
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
  v_subtotal numeric := 0;
  v_delivery_fee numeric := greatest(coalesce(p_delivery_fee_aed, 0), 0);
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

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_variant_id := nullif(v_item->>'variant_id', '')::uuid;
    v_qty := coalesce((v_item->>'quantity')::integer, 0);
    v_size := nullif(trim(v_item->>'size'), '');

    if v_qty <= 0 then
      raise exception 'Invalid quantity.';
    end if;

    select * into v_product
    from public.products
    where id = v_product_id and store_id = p_store_id and is_available = true
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
        raise exception 'A selected color is no longer available.';
      end if;
      if v_size is not null and cardinality(v_variant.sizes) > 0 and not (v_size = any (v_variant.sizes)) then
        raise exception 'Selected size is no longer available.';
      end if;
    elsif v_product.stock < v_qty then
      raise exception '% only has % left.', v_product.title, v_product.stock;
    elsif v_size is not null and cardinality(v_product.sizes) > 0 and not (v_size = any (v_product.sizes)) then
      raise exception 'Selected size is no longer available.';
    end if;

    v_subtotal := v_subtotal + public.sale_price_for_product(v_product.id, v_product.price_aed) * v_qty;
  end loop;

  insert into public.orders (
    shopper_id, store_id, status, payment_method, payment_status,
    subtotal_aed, delivery_fee_aed, total_aed,
    delivery_emirate, delivery_area, delivery_street, delivery_building,
    delivery_apartment, delivery_notes, delivery_eta_minutes
  )
  values (
    v_user_id, p_store_id, 'placed', coalesce(p_payment_method, 'cod'), 'pending',
    v_subtotal, v_delivery_fee, v_subtotal + v_delivery_fee,
    p_delivery_emirate, p_delivery_area, p_delivery_street,
    nullif(p_delivery_building, ''), nullif(p_delivery_apartment, ''),
    nullif(p_delivery_notes, ''), coalesce(p_delivery_eta_minutes, 60)
  )
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_variant_id := nullif(v_item->>'variant_id', '')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    v_size := nullif(trim(v_item->>'size'), '');
    v_title := coalesce(nullif(trim(v_item->>'title'), ''), 'Item');
    v_color_name := nullif(trim(v_item->>'color_name'), '');
    select * into v_product from public.products where id = v_product_id for update;
    v_unit_price := public.sale_price_for_product(v_product.id, v_product.price_aed);

    if v_variant_id is not null then
      update public.product_variants
      set stock = stock - v_qty
      where id = v_variant_id and stock >= v_qty;
      if not found then raise exception 'Not enough stock for a selected color.'; end if;
      select color_name into v_color_name from public.product_variants where id = v_variant_id;
    else
      update public.products
      set stock = stock - v_qty
      where id = v_product_id and stock >= v_qty;
      if not found then raise exception 'Not enough stock for a selected item.'; end if;
    end if;

    insert into public.order_items (
      order_id, product_id, variant_id, title, size, color_name,
      unit_price_aed, quantity, line_total_aed
    )
    values (
      v_order.id, v_product_id, v_variant_id, v_title, v_size, v_color_name,
      v_unit_price, v_qty, v_unit_price * v_qty
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
