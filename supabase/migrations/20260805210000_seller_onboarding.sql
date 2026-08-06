-- Seller onboarding: persist progress, atomic create/launch, owned storage policies

alter table public.stores
  add column if not exists onboarding_step integer not null default 1
    check (onboarding_step between 1 and 5),
  add column if not exists onboarding_completed_at timestamptz;

-- Existing stores are already live — mark them as completed without changing visibility.
update public.stores
set
  onboarding_step = 5,
  onboarding_completed_at = coalesce(onboarding_completed_at, now())
where onboarding_completed_at is null
  and (
    is_active = true
    or exists (
      select 1 from public.products p where p.store_id = stores.id
    )
  );

-- Atomic store creation: promote role + insert inactive store + membership.
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

  if exists (
    select 1 from public.store_members where user_id = v_user_id
  ) then
    raise exception 'You already have a store. Continue setup or open the portal.';
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

-- Guarded launch: brand + delivery + complete first product required.
create or replace function public.launch_owned_store(p_store_id uuid)
returns public.stores
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_store public.stores;
  v_ready boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.store_members
    where store_id = p_store_id
      and user_id = v_user_id
  ) and not exists (
    select 1 from public.profiles where id = v_user_id and role = 'admin'
  ) then
    raise exception 'You do not have permission to launch this store.';
  end if;

  select * into v_store from public.stores where id = p_store_id;
  if not found then
    raise exception 'Store not found.';
  end if;

  select
    v_store.logo_url is not null
    and v_store.cover_url is not null
    and nullif(trim(v_store.description), '') is not null
    and nullif(trim(v_store.area), '') is not null
    and nullif(trim(v_store.address), '') is not null
    and v_store.opens_at is not null
    and v_store.closes_at is not null
    and exists (
      select 1
      from public.products p
      where p.store_id = p_store_id
        and nullif(trim(p.title), '') is not null
        and nullif(trim(coalesce(p.description, '')), '') is not null
        and p.price_aed > 0
        and coalesce(cardinality(p.image_urls), 0) > 0
        and coalesce(cardinality(p.sizes), 0) > 0
    )
  into v_ready;

  if not coalesce(v_ready, false) then
    raise exception 'Finish branding, delivery details, and one complete product before launching.';
  end if;

  update public.stores
  set
    is_active = true,
    onboarding_step = 5,
    onboarding_completed_at = coalesce(onboarding_completed_at, now()),
    pause_note = null
  where id = p_store_id
  returning * into v_store;

  return v_store;
end;
$$;

revoke all on function public.launch_owned_store(uuid) from public;
revoke all on function public.launch_owned_store(uuid) from anon;
grant execute on function public.launch_owned_store(uuid) to authenticated;

-- Tighten storage: owners can only write/delete under their store_id folder.
drop policy if exists "product_images_owner_upload" on storage.objects;
drop policy if exists "store_logos_owner_upload" on storage.objects;
drop policy if exists "product_images_owner_update" on storage.objects;
drop policy if exists "store_logos_owner_update" on storage.objects;
drop policy if exists "product_images_owner_delete" on storage.objects;
drop policy if exists "store_logos_owner_delete" on storage.objects;

create policy "product_images_member_upload" on storage.objects for insert with check (
  bucket_id = 'product-images'
  and auth.role() = 'authenticated'
  and public.is_store_member(((storage.foldername(name))[1])::uuid)
);

create policy "store_logos_member_upload" on storage.objects for insert with check (
  bucket_id = 'store-logos'
  and auth.role() = 'authenticated'
  and public.is_store_member(((storage.foldername(name))[1])::uuid)
);

create policy "product_images_member_update" on storage.objects for update using (
  bucket_id = 'product-images'
  and auth.role() = 'authenticated'
  and public.is_store_member(((storage.foldername(name))[1])::uuid)
);

create policy "store_logos_member_update" on storage.objects for update using (
  bucket_id = 'store-logos'
  and auth.role() = 'authenticated'
  and public.is_store_member(((storage.foldername(name))[1])::uuid)
);

create policy "product_images_member_delete" on storage.objects for delete using (
  bucket_id = 'product-images'
  and auth.role() = 'authenticated'
  and public.is_store_member(((storage.foldername(name))[1])::uuid)
);

create policy "store_logos_member_delete" on storage.objects for delete using (
  bucket_id = 'store-logos'
  and auth.role() = 'authenticated'
  and public.is_store_member(((storage.foldername(name))[1])::uuid)
);
