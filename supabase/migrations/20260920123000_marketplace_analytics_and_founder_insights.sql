-- Marketplace analytics infrastructure + founder command-centre insights.
-- Events/cart snapshots are written only via service_role API routes.
-- Founder RPC remains admin-only and paid-order-correct for revenue metrics.

-- ---------------------------------------------------------------------------
-- Event log (append-only)
-- ---------------------------------------------------------------------------
create table if not exists public.marketplace_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  event_name text not null,
  shopper_id uuid null references public.profiles(id) on delete set null,
  anonymous_id text null,
  session_id text null,
  product_id uuid null references public.products(id) on delete set null,
  store_id uuid null references public.stores(id) on delete set null,
  quantity integer null,
  metadata jsonb not null default '{}'::jsonb,
  source text not null default 'web',
  constraint marketplace_events_name_check check (
    event_name in (
      'product_view',
      'cart_add',
      'cart_remove',
      'cart_update',
      'checkout_start',
      'wishlist_add',
      'wishlist_remove'
    )
  ),
  constraint marketplace_events_anonymous_id_len check (
    anonymous_id is null or char_length(anonymous_id) between 8 and 64
  ),
  constraint marketplace_events_session_id_len check (
    session_id is null or char_length(session_id) between 8 and 64
  )
);

create index if not exists marketplace_events_name_time_idx
  on public.marketplace_events (event_name, occurred_at desc);
create index if not exists marketplace_events_product_name_time_idx
  on public.marketplace_events (product_id, event_name, occurred_at desc)
  where product_id is not null;
create index if not exists marketplace_events_shopper_time_idx
  on public.marketplace_events (shopper_id, occurred_at desc)
  where shopper_id is not null;
create index if not exists marketplace_events_anon_time_idx
  on public.marketplace_events (anonymous_id, occurred_at desc)
  where anonymous_id is not null;

alter table public.marketplace_events enable row level security;

revoke all on table public.marketplace_events from public, anon, authenticated;
grant select, insert on table public.marketplace_events to service_role;
grant usage, select on sequence public.marketplace_events_id_seq to service_role;

-- ---------------------------------------------------------------------------
-- Live cart snapshots (current carts sitting across devices)
-- ---------------------------------------------------------------------------
create table if not exists public.cart_snapshots (
  id uuid primary key default gen_random_uuid(),
  shopper_id uuid null references public.profiles(id) on delete set null,
  anonymous_id text not null,
  updated_at timestamptz not null default now(),
  item_count integer not null default 0,
  subtotal_aed numeric(12, 2) not null default 0,
  items jsonb not null default '[]'::jsonb,
  constraint cart_snapshots_anonymous_id_len check (char_length(anonymous_id) between 8 and 64),
  constraint cart_snapshots_item_count_nonneg check (item_count >= 0),
  constraint cart_snapshots_subtotal_nonneg check (subtotal_aed >= 0),
  constraint cart_snapshots_anonymous_unique unique (anonymous_id)
);

create unique index if not exists cart_snapshots_shopper_unique_idx
  on public.cart_snapshots (shopper_id)
  where shopper_id is not null;

create index if not exists cart_snapshots_updated_idx
  on public.cart_snapshots (updated_at desc);

alter table public.cart_snapshots enable row level security;

revoke all on table public.cart_snapshots from public, anon, authenticated;
grant select, insert, update, delete on table public.cart_snapshots to service_role;

-- ---------------------------------------------------------------------------
-- Founder workspace: marketplace health + demand + intent (graceful empty)
-- ---------------------------------------------------------------------------
create or replace function public.founder_workspace_data(
  p_range_days integer default 7
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_range_days integer := greatest(7, least(coalesce(p_range_days, 7), 30));
  v_today date := (now() at time zone 'Asia/Dubai')::date;
  v_start_date date;
  v_prior_start date;
  v_payload jsonb;
  v_intent_has_data boolean;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'admin'
  ) then
    raise exception 'Founder workspace access is restricted to Morni administrators.';
  end if;

  v_start_date := v_today - (v_range_days - 1);
  v_prior_start := v_start_date - v_range_days;

  select exists (
    select 1
    from public.marketplace_events
    where occurred_at >= (v_start_date::timestamp at time zone 'Asia/Dubai')
    limit 1
  ) or exists (
    select 1 from public.cart_snapshots where item_count > 0 limit 1
  ) into v_intent_has_data;

  with
  active_orders as (
    select *
    from public.orders
    where status <> 'cancelled'
      and payment_status = 'paid'
  ),
  unpaid_checkout_orders as (
    select *
    from public.orders
    where status = 'placed'
      and payment_status in ('pending', 'failed')
  ),
  pending_payment_orders as (
    select *
    from unpaid_checkout_orders
    where payment_status = 'pending'
      and (placed_at at time zone 'Asia/Dubai')::date >= v_start_date
  ),
  period_unpaid as (
    select *
    from unpaid_checkout_orders
    where (placed_at at time zone 'Asia/Dubai')::date >= v_start_date
  ),
  period_orders as (
    select *
    from active_orders
    where (placed_at at time zone 'Asia/Dubai')::date >= v_start_date
  ),
  prior_period_orders as (
    select *
    from active_orders
    where (placed_at at time zone 'Asia/Dubai')::date >= v_prior_start
      and (placed_at at time zone 'Asia/Dubai')::date < v_start_date
  ),
  today_orders as (
    select *
    from active_orders
    where (placed_at at time zone 'Asia/Dubai')::date = v_today
  ),
  daily_series as (
    select day::date as day
    from generate_series(v_start_date, v_today, interval '1 day') as day
  ),
  daily_sales as (
    select
      series.day,
      coalesce(sum(order_row.total_aed), 0) as revenue,
      count(order_row.id) as orders,
      (
        select count(*)
        from public.profiles profile
        where profile.role = 'shopper'
          and (profile.created_at at time zone 'Asia/Dubai')::date = series.day
      ) as shoppers
    from daily_series series
    left join active_orders order_row
      on (order_row.placed_at at time zone 'Asia/Dubai')::date = series.day
    group by series.day
    order by series.day
  ),
  order_statuses as (
    select status, count(*) as count
    from active_orders
    where (placed_at at time zone 'Asia/Dubai')::date >= v_start_date
    group by status
  ),
  store_rollup as (
    select
      store.id,
      store.name,
      store.slug,
      store.emirate,
      store.is_active,
      store.created_at,
      (
        select count(*) from public.products product
        where product.store_id = store.id and product.is_available
      ) as live_products,
      (
        select count(*) from public.products product
        where product.store_id = store.id and product.is_available and product.stock <= 5
      ) as low_stock_products,
      (
        select count(*) from period_orders period_order
        where period_order.store_id = store.id
      ) as period_orders,
      (
        select coalesce(sum(period_order.total_aed), 0) from period_orders period_order
        where period_order.store_id = store.id
      ) as period_revenue,
      (
        select count(*) from today_orders today_order
        where today_order.store_id = store.id
      ) as today_orders,
      (
        select coalesce(sum(today_order.total_aed), 0) from today_orders today_order
        where today_order.store_id = store.id
      ) as today_revenue
    from public.stores store
  ),
  product_rollup as (
    select
      coalesce(product.id, item.product_id) as id,
      coalesce(product.title, item.title) as title,
      store.name as store_name,
      coalesce(sum(item.quantity), 0) as units,
      coalesce(sum(item.line_total_aed), 0) as revenue,
      max(product.stock) as stock
    from public.order_items item
    join period_orders order_row on order_row.id = item.order_id
    left join public.products product on product.id = item.product_id
    join public.stores store on store.id = order_row.store_id
    group by coalesce(product.id, item.product_id), coalesce(product.title, item.title), store.name
  ),
  customer_rollup as (
    select
      profile.id,
      profile.full_name,
      profile.created_at,
      coalesce(
        (
          select recent_order.delivery_phone
          from public.orders recent_order
          where recent_order.shopper_id = profile.id
            and recent_order.delivery_phone is not null
            and recent_order.payment_status = 'paid'
          order by recent_order.placed_at desc
          limit 1
        ),
        profile.phone
      ) as phone,
      count(order_row.id) as orders,
      coalesce(sum(order_row.total_aed), 0) as revenue,
      max(order_row.placed_at) as last_order_at
    from public.profiles profile
    left join active_orders order_row on order_row.shopper_id = profile.id
    where profile.role = 'shopper'
    group by profile.id
  ),
  wishlist_product_counts as (
    select
      wish.product_id as id,
      coalesce(product.title, 'Product') as title,
      store.name as store_name,
      count(*)::int as wishlist_count
    from public.wishlist_items wish
    left join public.products product on product.id = wish.product_id
    left join public.stores store on store.id = product.store_id
    group by wish.product_id, product.title, store.name
  ),
  unpaid_product_counts as (
    select
      item.product_id as id,
      coalesce(sum(item.quantity), 0)::int as unpaid_units
    from public.order_items item
    join period_unpaid order_row on order_row.id = item.order_id
    where item.product_id is not null
    group by item.product_id
  ),
  paid_product_counts as (
    select
      coalesce(product.id, item.product_id) as id,
      coalesce(sum(item.quantity), 0)::int as paid_units
    from public.order_items item
    join period_orders order_row on order_row.id = item.order_id
    left join public.products product on product.id = item.product_id
    group by coalesce(product.id, item.product_id)
  ),
  period_wishlist_adds as (
    select count(*)::int as adds
    from public.wishlist_items
    where (created_at at time zone 'Asia/Dubai')::date >= v_start_date
  ),
  view_counts as (
    select
      event_row.product_id as id,
      count(*)::int as views
    from public.marketplace_events event_row
    where event_row.event_name = 'product_view'
      and event_row.product_id is not null
      and (event_row.occurred_at at time zone 'Asia/Dubai')::date >= v_start_date
    group by event_row.product_id
  ),
  cart_add_counts as (
    select
      event_row.product_id as id,
      count(*)::int as cart_adds
    from public.marketplace_events event_row
    where event_row.event_name = 'cart_add'
      and event_row.product_id is not null
      and (event_row.occurred_at at time zone 'Asia/Dubai')::date >= v_start_date
    group by event_row.product_id
  ),
  alerts as (
    select * from (
      select
        'urgent'::text as tone,
        'Order waiting for acceptance'::text as title,
        concat(store.name, ' · ', order_row.order_number, ' has waited ', floor(extract(epoch from (now() - order_row.placed_at)) / 60)::text, ' min') as detail,
        '/founder?view=orders'::text as href,
        1 as priority,
        order_row.placed_at as happened_at
      from public.orders order_row
      join public.stores store on store.id = order_row.store_id
      where order_row.status = 'placed'
        and order_row.payment_status = 'paid'
        and order_row.placed_at < now() - interval '15 minutes'

      union all

      select
        'warning'::text,
        'Low stock needs attention'::text,
        concat(product.title, ' · ', store.name, ' has ', product.stock::text, ' left'),
        '/founder?view=catalogue'::text,
        2,
        product.updated_at
      from public.products product
      join public.stores store on store.id = product.store_id
      where product.is_available and product.stock <= 5

      union all

      select
        'default'::text,
        'New store joined Morni'::text,
        concat(store.name, ' · ', initcap(replace(store.emirate::text, '_', ' '))),
        '/founder?view=stores'::text,
        3,
        store.created_at
      from public.stores store
      where store.created_at >= now() - interval '7 days'

      union all

      select
        'warning'::text,
        'Store has no live products'::text,
        concat(store.name, ' is active but has no purchasable products'),
        '/founder?view=stores'::text,
        4,
        store.created_at
      from store_rollup store
      where store.is_active and store.live_products = 0
    ) alert_rows
    order by priority, happened_at desc
    limit 12
  )
  select jsonb_build_object(
    'generated_at', now(),
    'range_days', v_range_days,
    'metrics', jsonb_build_object(
      'today_orders', (select count(*) from today_orders),
      'today_revenue', (select coalesce(sum(total_aed), 0) from today_orders),
      'average_order_value', (select coalesce(avg(total_aed), 0) from period_orders),
      'new_shoppers', (select count(*) from public.profiles where role = 'shopper' and (created_at at time zone 'Asia/Dubai')::date = v_today),
      'new_stores', (select count(*) from public.stores where (created_at at time zone 'Asia/Dubai')::date = v_today),
      'active_stores', (select count(*) from public.stores where is_active),
      'open_orders', (select count(*) from public.orders where status in ('placed', 'accepted', 'picking', 'out_for_delivery') and payment_status = 'paid'),
      'delivery_rate', (select coalesce(round(100.0 * count(*) filter (where status = 'delivered') / nullif(count(*) filter (where status <> 'cancelled' and payment_status = 'paid'), 0), 1), 0) from public.orders where payment_status = 'paid'),
      'total_shoppers', (select count(*) from public.profiles where role = 'shopper'),
      'buyers', (select count(distinct shopper_id) from active_orders),
      'period_orders', (select count(*) from period_orders),
      'period_revenue', (select coalesce(sum(total_aed), 0) from period_orders),
      'prior_period_orders', (select count(*) from prior_period_orders),
      'prior_period_revenue', (select coalesce(sum(total_aed), 0) from prior_period_orders),
      'unpaid_checkouts', (select count(*) from period_unpaid),
      'unpaid_checkout_value', (select coalesce(sum(total_aed), 0) from period_unpaid),
      'wishlist_users', (select count(distinct shopper_id) from public.wishlist_items),
      'wishlist_items', (select count(*) from public.wishlist_items),
      'wishlist_adds_period', (select adds from period_wishlist_adds)
    ),
    'daily_sales', coalesce((
      select jsonb_agg(jsonb_build_object(
        'day', day,
        'label', to_char(day, case when v_range_days = 7 then 'Dy' else 'DD Mon' end),
        'revenue', revenue,
        'orders', orders,
        'shoppers', shoppers
      ) order by day)
      from daily_sales
    ), '[]'::jsonb),
    'status_breakdown', coalesce((
      select jsonb_object_agg(status, count) from order_statuses
    ), '{}'::jsonb),
    'recent_orders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', order_row.id,
        'order_number', order_row.order_number,
        'status', order_row.status,
        'total_aed', order_row.total_aed,
        'placed_at', order_row.placed_at,
        'store_name', store.name,
        'shopper_name', coalesce(profile.full_name, 'Shopper'),
        'customer_phone', coalesce(order_row.delivery_phone, profile.phone),
        'delivery_area', order_row.delivery_area
      ) order by order_row.placed_at desc)
      from (
        select * from public.orders order_row
        where order_row.payment_status = 'paid'
          and order_row.status <> 'cancelled'
        order by order_row.placed_at desc
        limit 24
      ) order_row
      join public.stores store on store.id = order_row.store_id
      left join public.profiles profile on profile.id = order_row.shopper_id
    ), '[]'::jsonb),
    'stores', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'name', name,
        'slug', slug,
        'emirate', emirate,
        'is_active', is_active,
        'created_at', created_at,
        'live_products', live_products,
        'low_stock_products', low_stock_products,
        'period_orders', period_orders,
        'period_revenue', period_revenue,
        'today_orders', today_orders,
        'today_revenue', today_revenue
      ) order by period_revenue desc, name)
      from store_rollup
    ), '[]'::jsonb),
    'top_products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'title', title,
        'store_name', store_name,
        'units', units,
        'revenue', revenue,
        'stock', stock
      ) order by revenue desc, units desc)
      from (select * from product_rollup order by revenue desc, units desc limit 12) ranked_products
    ), '[]'::jsonb),
    'customers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'full_name', coalesce(full_name, 'Shopper'),
        'phone', phone,
        'created_at', created_at,
        'orders', orders,
        'revenue', revenue,
        'last_order_at', last_order_at
      ) order by revenue desc, last_order_at desc nulls last)
      from (select * from customer_rollup order by revenue desc, last_order_at desc nulls last limit 20) ranked_customers
    ), '[]'::jsonb),
    'finance', jsonb_build_object(
      'gross_sales', (select coalesce(sum(total_aed), 0) from period_orders),
      'product_sales', (select coalesce(sum(subtotal_aed), 0) from period_orders),
      'delivery_fees', (select coalesce(sum(delivery_fee_aed), 0) from period_orders),
      'service_fees', (select coalesce(sum(service_fee_aed), 0) from period_orders),
      'small_order_fees', (select coalesce(sum(small_order_fee_aed), 0) from period_orders),
      'paid_orders', (select count(*) from period_orders),
      'pending_orders', (select count(*) from pending_payment_orders)
    ),
    'alerts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'tone', tone,
        'title', title,
        'detail', detail,
        'href', href
      )) from alerts
    ), '[]'::jsonb),
    'demand', jsonb_build_object(
      'funnel', jsonb_build_object(
        'wishlist_users', (select count(distinct shopper_id) from public.wishlist_items),
        'checkout_started', (select count(*) from period_unpaid),
        'paid_orders', (select count(*) from period_orders)
      ),
      'top_wishlisted', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', id,
          'title', title,
          'store_name', coalesce(store_name, 'Store'),
          'wishlist_count', wishlist_count
        ) order by wishlist_count desc)
        from (
          select * from wishlist_product_counts
          order by wishlist_count desc
          limit 12
        ) ranked
      ), '[]'::jsonb),
      'intent_without_purchase', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', ranked.id,
          'title', ranked.title,
          'store_name', coalesce(ranked.store_name, 'Store'),
          'wishlist_count', ranked.wishlist_count,
          'paid_units', ranked.paid_units
        ) order by ranked.wishlist_count desc)
        from (
          select
            wish.id,
            wish.title,
            wish.store_name,
            wish.wishlist_count,
            coalesce(paid.paid_units, 0) as paid_units
          from wishlist_product_counts wish
          left join paid_product_counts paid on paid.id = wish.id
          where coalesce(paid.paid_units, 0) = 0
            and wish.wishlist_count > 0
          order by wish.wishlist_count desc
          limit 12
        ) ranked
      ), '[]'::jsonb),
      'product_funnel', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', wish.id,
          'title', wish.title,
          'store_name', coalesce(wish.store_name, 'Store'),
          'wishlist_count', wish.wishlist_count,
          'unpaid_units', coalesce(unpaid.unpaid_units, 0),
          'paid_units', coalesce(paid.paid_units, 0)
        ) order by wish.wishlist_count desc)
        from (
          select * from wishlist_product_counts
          order by wishlist_count desc
          limit 12
        ) wish
        left join unpaid_product_counts unpaid on unpaid.id = wish.id
        left join paid_product_counts paid on paid.id = wish.id
      ), '[]'::jsonb)
    ),
    'intent', jsonb_build_object(
      'tracking_live', true,
      'has_data', coalesce(v_intent_has_data, false),
      'product_views_period', (
        select count(*)::int from public.marketplace_events
        where event_name = 'product_view'
          and (occurred_at at time zone 'Asia/Dubai')::date >= v_start_date
      ),
      'cart_adds_period', (
        select count(*)::int from public.marketplace_events
        where event_name = 'cart_add'
          and (occurred_at at time zone 'Asia/Dubai')::date >= v_start_date
      ),
      'active_users_period', (
        select count(*)::int from (
          select coalesce(shopper_id::text, anonymous_id) as actor
          from public.marketplace_events
          where (occurred_at at time zone 'Asia/Dubai')::date >= v_start_date
            and coalesce(shopper_id::text, anonymous_id) is not null
          group by coalesce(shopper_id::text, anonymous_id)
        ) actors
      ),
      'users_with_cart_snapshot', (
        select count(*)::int from public.cart_snapshots where item_count > 0
      ),
      'products_in_carts', (
        select coalesce(sum(item_count), 0)::int from public.cart_snapshots where item_count > 0
      ),
      'cart_subtotal_aed', (
        select coalesce(sum(subtotal_aed), 0) from public.cart_snapshots where item_count > 0
      ),
      'top_viewed', case when coalesce(v_intent_has_data, false) then coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', views.id,
          'title', coalesce(product.title, 'Product'),
          'store_name', coalesce(store.name, 'Store'),
          'views', views.views
        ) order by views.views desc)
        from (
          select * from view_counts order by views desc limit 12
        ) views
        left join public.products product on product.id = views.id
        left join public.stores store on store.id = product.store_id
      ), '[]'::jsonb) else '[]'::jsonb end,
      'top_carted', case when coalesce(v_intent_has_data, false) then coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', carts.id,
          'title', coalesce(product.title, 'Product'),
          'store_name', coalesce(store.name, 'Store'),
          'cart_adds', carts.cart_adds
        ) order by carts.cart_adds desc)
        from (
          select * from cart_add_counts order by cart_adds desc limit 12
        ) carts
        left join public.products product on product.id = carts.id
        left join public.stores store on store.id = product.store_id
      ), '[]'::jsonb) else '[]'::jsonb end
    )
  ) into v_payload;

  return v_payload;
end;
$$;

revoke all on function public.founder_workspace_data(integer) from public, anon;
grant execute on function public.founder_workspace_data(integer) to authenticated, service_role;
