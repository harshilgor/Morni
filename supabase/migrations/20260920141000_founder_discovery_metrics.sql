-- Discovery / friction / funnel metrics for Founder Demand tab.
-- Reads marketplace_events only; never invents numbers.

create or replace function public.founder_discovery_metrics(
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
  v_start_date date := v_today - (v_range_days - 1);
  v_start_ts timestamptz := (v_start_date::timestamp at time zone 'Asia/Dubai');
  v_has_events boolean;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'Founder workspace access is restricted to Morni administrators.';
  end if;

  select exists (
    select 1 from public.marketplace_events where occurred_at >= v_start_ts limit 1
  ) into v_has_events;

  return jsonb_build_object(
    'generated_at', now(),
    'range_days', v_range_days,
    'has_data', coalesce(v_has_events, false),
    'funnel', jsonb_build_object(
      'product_views', (select count(*)::int from public.marketplace_events where event_name = 'product_view' and occurred_at >= v_start_ts),
      'listing_impressions', (select count(*)::int from public.marketplace_events where event_name = 'listing_impression' and occurred_at >= v_start_ts),
      'listing_clicks', (select count(*)::int from public.marketplace_events where event_name = 'listing_click' and occurred_at >= v_start_ts),
      'cart_adds', (select count(*)::int from public.marketplace_events where event_name = 'cart_add' and occurred_at >= v_start_ts),
      'checkout_starts', (select count(*)::int from public.marketplace_events where event_name = 'checkout_start' and occurred_at >= v_start_ts),
      'checkout_address_complete', (select count(*)::int from public.marketplace_events where event_name = 'checkout_address_complete' and occurred_at >= v_start_ts),
      'checkout_slot_selected', (select count(*)::int from public.marketplace_events where event_name = 'checkout_slot_selected' and occurred_at >= v_start_ts),
      'checkout_place_order', (select count(*)::int from public.marketplace_events where event_name = 'checkout_place_order' and occurred_at >= v_start_ts),
      'payment_start', (select count(*)::int from public.marketplace_events where event_name = 'checkout_payment_start' and occurred_at >= v_start_ts),
      'payment_fail', (select count(*)::int from public.marketplace_events where event_name = 'checkout_payment_fail' and occurred_at >= v_start_ts),
      'payment_success', (select count(*)::int from public.marketplace_events where event_name = 'checkout_payment_success' and occurred_at >= v_start_ts)
    ),
    'search', jsonb_build_object(
      'searches', (select count(*)::int from public.marketplace_events where event_name = 'search' and occurred_at >= v_start_ts),
      'zero_results', (select count(*)::int from public.marketplace_events where event_name = 'search_zero_results' and occurred_at >= v_start_ts),
      'result_clicks', (select count(*)::int from public.marketplace_events where event_name = 'search_result_click' and occurred_at >= v_start_ts),
      'top_queries', coalesce((
        select jsonb_agg(jsonb_build_object('query', query, 'count', count) order by count desc)
        from (
          select coalesce(metadata->>'query', '') as query, count(*)::int as count
          from public.marketplace_events
          where event_name in ('search', 'search_zero_results')
            and occurred_at >= v_start_ts
            and coalesce(metadata->>'query', '') <> ''
          group by 1
          order by count desc
          limit 12
        ) q
      ), '[]'::jsonb),
      'zero_result_queries', coalesce((
        select jsonb_agg(jsonb_build_object('query', query, 'count', count) order by count desc)
        from (
          select coalesce(metadata->>'query', '') as query, count(*)::int as count
          from public.marketplace_events
          where event_name = 'search_zero_results'
            and occurred_at >= v_start_ts
            and coalesce(metadata->>'query', '') <> ''
          group by 1
          order by count desc
          limit 12
        ) q
      ), '[]'::jsonb)
    ),
    'friction', jsonb_build_object(
      'add_to_cart_blocked', (select count(*)::int from public.marketplace_events where event_name = 'add_to_cart_blocked' and occurred_at >= v_start_ts),
      'blocked_reasons', coalesce((
        select jsonb_agg(jsonb_build_object('reason', reason, 'count', count) order by count desc)
        from (
          select coalesce(metadata->>'reason', 'other') as reason, count(*)::int as count
          from public.marketplace_events
          where event_name = 'add_to_cart_blocked' and occurred_at >= v_start_ts
          group by 1
          order by count desc
          limit 8
        ) r
      ), '[]'::jsonb),
      'auth_fails', (select count(*)::int from public.marketplace_events where event_name = 'auth_fail' and occurred_at >= v_start_ts),
      'auth_logins', (select count(*)::int from public.marketplace_events where event_name = 'auth_login_success' and occurred_at >= v_start_ts),
      'auth_signups', (select count(*)::int from public.marketplace_events where event_name = 'auth_signup_success' and occurred_at >= v_start_ts)
    ),
    'surfaces', jsonb_build_object(
      'home_views', (select count(*)::int from public.marketplace_events where event_name = 'home_view' and occurred_at >= v_start_ts),
      'category_views', (select count(*)::int from public.marketplace_events where event_name = 'category_view' and occurred_at >= v_start_ts),
      'collection_views', (select count(*)::int from public.marketplace_events where event_name = 'collection_view' and occurred_at >= v_start_ts),
      'store_views', (select count(*)::int from public.marketplace_events where event_name = 'store_view' and occurred_at >= v_start_ts),
      'top_categories', coalesce((
        select jsonb_agg(jsonb_build_object('category', category, 'count', count) order by count desc)
        from (
          select coalesce(metadata->>'category', '') as category, count(*)::int as count
          from public.marketplace_events
          where event_name = 'category_view' and occurred_at >= v_start_ts
            and coalesce(metadata->>'category', '') <> ''
          group by 1 order by count desc limit 8
        ) c
      ), '[]'::jsonb)
    ),
    'acquisition', jsonb_build_object(
      'sessions', (select count(*)::int from public.marketplace_events where event_name = 'session_start' and occurred_at >= v_start_ts),
      'top_sources', coalesce((
        select jsonb_agg(jsonb_build_object('source', source, 'count', count) order by count desc)
        from (
          select coalesce(nullif(metadata->>'utm_source', ''), nullif(metadata->>'referrer', ''), 'direct') as source,
                 count(*)::int as count
          from public.marketplace_events
          where event_name = 'session_start' and occurred_at >= v_start_ts
          group by 1 order by count desc limit 8
        ) s
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.founder_discovery_metrics(integer) from public, anon;
grant execute on function public.founder_discovery_metrics(integer) to authenticated, service_role;
