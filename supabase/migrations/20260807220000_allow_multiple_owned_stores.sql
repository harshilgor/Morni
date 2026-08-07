-- Allow an authenticated owner to create and manage more than one independent store.
-- Store membership remains the authorization boundary for every store-scoped resource.

create or replace function public.create_owned_store(
  p_name text,
  p_slug text,
  p_description text,
  p_emirate public.uae_emirate,
  p_area text,
  p_address text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_delivery_eta_minutes integer default 60,
  p_opens_at time default '10:00',
  p_closes_at time default '22:00'
)
returns public.stores
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_store public.stores;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'Store name is required.';
  end if;
  if nullif(trim(p_slug), '') is null then
    raise exception 'Store slug is required.';
  end if;
  if nullif(trim(p_area), '') is null or nullif(trim(p_address), '') is null then
    raise exception 'Area and street address are required.';
  end if;

  update public.profiles
  set role = case
    when role = 'admin' then 'admin'::public.user_role
    else 'store_owner'::public.user_role
  end
  where id = v_user_id;

  insert into public.stores (
    name,
    slug,
    description,
    emirate,
    area,
    address,
    lat,
    lng,
    is_active,
    delivery_eta_minutes,
    opens_at,
    closes_at,
    onboarding_step
  )
  values (
    trim(p_name),
    trim(p_slug),
    nullif(trim(coalesce(p_description, '')), ''),
    p_emirate,
    trim(p_area),
    trim(p_address),
    p_lat,
    p_lng,
    false,
    greatest(15, least(coalesce(p_delivery_eta_minutes, 60), 180)),
    coalesce(p_opens_at, '10:00'::time),
    coalesce(p_closes_at, '22:00'::time),
    2
  )
  returning * into v_store;

  insert into public.store_members (store_id, user_id)
  values (v_store.id, v_user_id);

  return v_store;
end;
$$;

revoke all on function public.create_owned_store(
  text, text, text, public.uae_emirate, text, text, double precision, double precision, integer, time, time
) from public;
revoke all on function public.create_owned_store(
  text, text, text, public.uae_emirate, text, text, double precision, double precision, integer, time, time
) from anon;
grant execute on function public.create_owned_store(
  text, text, text, public.uae_emirate, text, text, double precision, double precision, integer, time, time
) to authenticated;
