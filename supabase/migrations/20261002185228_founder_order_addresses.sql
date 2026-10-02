-- Only Morni administrators can read delivery addresses across boutiques.
create or replace function public.founder_recent_order_addresses()
returns table (
  order_id uuid,
  delivery_street text,
  delivery_building text,
  delivery_apartment text,
  delivery_area text,
  delivery_emirate text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid() and profile.role = 'admin'
  ) then
    raise exception 'Founder workspace access is restricted to Morni administrators.';
  end if;

  return query
  select order_row.id, order_row.delivery_street, order_row.delivery_building,
    order_row.delivery_apartment, order_row.delivery_area, order_row.delivery_emirate::text
  from public.orders order_row
  where order_row.payment_status = 'paid'
    and order_row.status <> 'cancelled'
  order by order_row.placed_at desc
  limit 24;
end;
$$;

revoke all on function public.founder_recent_order_addresses() from public, anon;
grant execute on function public.founder_recent_order_addresses() to authenticated, service_role;
