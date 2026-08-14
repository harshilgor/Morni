-- Founder workspace: one guarded aggregate endpoint for the Morni team.
-- The browser only receives this summary after the database confirms the
-- current user is an administrator.

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
  v_payload jsonb;
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

  with
  active_orders as (
    select *
    from public.orders
    where status <> 'cancelled'
  ),
  period_orders as (
    select *
    from active_orders
    where (placed_at at time zone 'Asia/Dubai')::date >= v_start_date
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
    from public.orders
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
      count(order_row.id) as orders,
      coalesce(sum(order_row.total_aed), 0) as revenue,
      max(order_row.placed_at) as last_order_at
    from public.profiles profile
    left join active_orders order_row on order_row.shopper_id = profile.id
    where profile.role = 'shopper'
    group by profile.id
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
      'open_orders', (select count(*) from public.orders where status in ('placed', 'accepted', 'picking', 'out_for_delivery')),
      'delivery_rate', (select coalesce(round(100.0 * count(*) filter (where status = 'delivered') / nullif(count(*) filter (where status <> 'cancelled'), 0), 1), 0) from public.orders)
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
        'delivery_area', order_row.delivery_area
      ) order by order_row.placed_at desc)
      from (
        select * from public.orders order_row order by order_row.placed_at desc limit 24
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
      'paid_orders', (select count(*) from period_orders where payment_status = 'paid'),
      'pending_orders', (select count(*) from period_orders where payment_status = 'pending')
    ),
    'alerts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'tone', tone,
        'title', title,
        'detail', detail,
        'href', href
      )) from alerts
    ), '[]'::jsonb)
  ) into v_payload;

  return v_payload;
end;
$$;

revoke all on function public.founder_workspace_data(integer) from public, anon;
grant execute on function public.founder_workspace_data(integer) to authenticated;
