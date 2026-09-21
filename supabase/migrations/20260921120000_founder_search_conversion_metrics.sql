-- Search attribution uses the existing append-only marketplace_events table.
-- Search contexts are carried in metadata.search_session_id for a bounded window.
create or replace function public.founder_search_conversion_metrics(
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
  v_start_ts timestamptz := now() - make_interval(days => v_range_days);
  v_searches integer;
  v_zero_results integer;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'Founder workspace access is restricted to Morni administrators.';
  end if;

  with search_rows as (
    select
      coalesce(nullif(trim(metadata->>'search_session_id'), ''), 'event:' || id::text) as search_session_id,
      lower(trim(coalesce(metadata->>'query', ''))) as query,
      event_name
    from public.marketplace_events
    where event_name in ('search', 'search_zero_results')
      and occurred_at >= v_start_ts
  )
  select count(*)::int, count(*) filter (where event_name = 'search_zero_results')::int
  into v_searches, v_zero_results
  from search_rows;

  return jsonb_build_object(
    'generated_at', now(),
    'range_days', v_range_days,
    'searches', coalesce(v_searches, 0),
    'zero_results', coalesce(v_zero_results, 0),
    'has_data', coalesce(v_searches, 0) > 0,
    'funnel', (
      with search_rows as (
        select
          coalesce(nullif(trim(metadata->>'search_session_id'), ''), 'event:' || id::text) as search_session_id,
          lower(trim(coalesce(metadata->>'query', ''))) as query,
          bool_or(event_name = 'search_zero_results') as is_zero_result
        from public.marketplace_events
        where event_name in ('search', 'search_zero_results') and occurred_at >= v_start_ts
        group by 1, 2
      ), actions as (
        select
          metadata->>'search_session_id' as search_session_id,
          count(*) filter (where event_name = 'search_result_click')::int as result_clicks,
          count(*) filter (where event_name = 'product_view')::int as product_views,
          count(*) filter (where event_name = 'wishlist_add')::int as wishlist_adds,
          count(*) filter (where event_name = 'cart_add')::int as cart_adds,
          count(*) filter (where event_name = 'checkout_start')::int as checkout_starts,
          count(*) filter (where event_name = 'checkout_payment_success')::int as purchases,
          coalesce(sum(case when event_name = 'checkout_payment_success' then coalesce(o.total_aed, 0) else 0 end), 0)::numeric as revenue
        from public.marketplace_events e
        left join public.orders o on o.id = case when e.metadata->>'order_id' ~* '^[0-9a-f-]{36}$' then (e.metadata->>'order_id')::uuid else null end
        where nullif(trim(e.metadata->>'search_session_id'), '') is not null
          and e.occurred_at >= v_start_ts
          and e.event_name in ('search_result_click', 'product_view', 'wishlist_add', 'cart_add', 'checkout_start', 'checkout_payment_success')
        group by 1
      )
      select jsonb_build_object(
        'searches', count(*)::int,
        'zero_results', count(*) filter (where is_zero_result)::int,
        'result_clicks', coalesce(sum(coalesce(a.result_clicks, 0)), 0)::int,
        'product_views', coalesce(sum(coalesce(a.product_views, 0)), 0)::int,
        'wishlist_adds', coalesce(sum(coalesce(a.wishlist_adds, 0)), 0)::int,
        'cart_adds', coalesce(sum(coalesce(a.cart_adds, 0)), 0)::int,
        'checkout_starts', coalesce(sum(coalesce(a.checkout_starts, 0)), 0)::int,
        'purchases', coalesce(sum(coalesce(a.purchases, 0)), 0)::int,
        'revenue', coalesce(sum(coalesce(a.revenue, 0)), 0),
        'click_searches', count(*) filter (where coalesce(a.result_clicks, 0) > 0)::int,
        'view_searches', count(*) filter (where coalesce(a.product_views, 0) > 0)::int,
        'wishlist_searches', count(*) filter (where coalesce(a.wishlist_adds, 0) > 0)::int,
        'cart_searches', count(*) filter (where coalesce(a.cart_adds, 0) > 0)::int,
        'checkout_searches', count(*) filter (where coalesce(a.checkout_starts, 0) > 0)::int,
        'purchase_searches', count(*) filter (where coalesce(a.purchases, 0) > 0)::int
      )
      from search_rows s left join actions a on a.search_session_id = s.search_session_id
    ),
    'rates', (
      with search_rows as (
        select coalesce(nullif(trim(metadata->>'search_session_id'), ''), 'event:' || id::text) as search_session_id
        from public.marketplace_events
        where event_name in ('search', 'search_zero_results') and occurred_at >= v_start_ts
        group by 1
      ), actions as (
        select metadata->>'search_session_id' as search_session_id,
          bool_or(event_name = 'search_result_click') as clicked,
          bool_or(event_name = 'product_view') as viewed,
          bool_or(event_name = 'wishlist_add') as wished,
          bool_or(event_name = 'cart_add') as carted,
          bool_or(event_name = 'checkout_start') as checked_out,
          bool_or(event_name = 'checkout_payment_success') as purchased
        from public.marketplace_events
        where nullif(trim(metadata->>'search_session_id'), '') is not null and occurred_at >= v_start_ts
        group by 1
      )
      select jsonb_build_object(
        'click', round(100.0 * count(*) filter (where a.clicked) / nullif(count(*), 0), 1),
        'view', round(100.0 * count(*) filter (where a.viewed) / nullif(count(*), 0), 1),
        'wishlist', round(100.0 * count(*) filter (where a.wished) / nullif(count(*), 0), 1),
        'cart', round(100.0 * count(*) filter (where a.carted) / nullif(count(*), 0), 1),
        'checkout', round(100.0 * count(*) filter (where a.checked_out) / nullif(count(*), 0), 1),
        'purchase', round(100.0 * count(*) filter (where a.purchased) / nullif(count(*), 0), 1),
        'zero_result', round(100.0 * v_zero_results / nullif(v_searches, 0), 1)
      ) from search_rows s left join actions a on a.search_session_id = s.search_session_id
    ),
    'top_converting_queries', (
      with search_rows as (
        select coalesce(nullif(trim(metadata->>'search_session_id'), ''), 'event:' || id::text) as search_session_id, lower(trim(coalesce(metadata->>'query', ''))) as query
        from public.marketplace_events where event_name in ('search', 'search_zero_results') and occurred_at >= v_start_ts group by 1, 2
      ), actions as (
        select metadata->>'search_session_id' as search_session_id, count(*) filter (where event_name = 'checkout_payment_success')::int as purchases, coalesce(sum(case when event_name = 'checkout_payment_success' then coalesce(o.total_aed, 0) else 0 end), 0) as revenue
        from public.marketplace_events e left join public.orders o on o.id = case when e.metadata->>'order_id' ~* '^[0-9a-f-]{36}$' then (e.metadata->>'order_id')::uuid else null end
        where nullif(trim(metadata->>'search_session_id'), '') is not null and occurred_at >= v_start_ts group by 1
      )
      select coalesce(jsonb_agg(jsonb_build_object('query', query, 'searches', searches, 'purchases', purchases, 'revenue', revenue) order by purchases desc, revenue desc, searches desc), '[]'::jsonb)
      from (select s.query, count(*)::int as searches, coalesce(sum(a.purchases), 0)::int as purchases, coalesce(sum(a.revenue), 0) as revenue from search_rows s left join actions a on a.search_session_id = s.search_session_id where s.query <> '' group by s.query order by purchases desc, revenue desc limit 8) q
    ),
    'highest_volume_queries', (
      with search_rows as (
        select coalesce(nullif(trim(metadata->>'search_session_id'), ''), 'event:' || id::text) as search_session_id, lower(trim(coalesce(metadata->>'query', ''))) as query
        from public.marketplace_events where event_name in ('search', 'search_zero_results') and occurred_at >= v_start_ts group by 1, 2
      ), actions as (
        select metadata->>'search_session_id' as search_session_id,
          bool_or(event_name = 'search_result_click') as clicked,
          bool_or(event_name = 'cart_add') as carted
        from public.marketplace_events
        where nullif(trim(metadata->>'search_session_id'), '') is not null and occurred_at >= v_start_ts
        group by 1
      )
      select coalesce(jsonb_agg(jsonb_build_object('query', query, 'searches', searches, 'click_searches', click_searches, 'cart_searches', cart_searches) order by searches desc), '[]'::jsonb)
      from (select s.query, count(*)::int as searches, count(*) filter (where a.clicked)::int as click_searches, count(*) filter (where a.carted)::int as cart_searches from search_rows s left join actions a on a.search_session_id = s.search_session_id where s.query <> '' group by s.query order by searches desc limit 8) q
    )
  );
end;
$$;

revoke all on function public.founder_search_conversion_metrics(integer) from public, anon;
grant execute on function public.founder_search_conversion_metrics(integer) to authenticated, service_role;
