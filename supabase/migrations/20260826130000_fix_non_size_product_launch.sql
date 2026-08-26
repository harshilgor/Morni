-- Keep the database launch gate aligned with the seller UI: gifting products
-- are sellable without apparel sizes.
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
  if not public.is_store_member(p_store_id) then
    raise exception 'You do not have permission to launch this store.';
  end if;
  select * into v_store from public.stores where id = p_store_id;
  if not found then
    raise exception 'Store not found.';
  end if;
  select
    v_store.logo_url is not null
    and nullif(trim(v_store.area), '') is not null
    and nullif(trim(v_store.address), '') is not null
    and v_store.opens_at is not null
    and v_store.closes_at is not null
    and exists (
      select 1
      from public.products p
      left join public.categories c on c.id = p.category_id
      where p.store_id = p_store_id
        and nullif(trim(p.title), '') is not null
        and nullif(trim(coalesce(p.description, '')), '') is not null
        and p.price_aed > 0
        and coalesce(cardinality(p.image_urls), 0) > 0
        and (c.slug = 'gifting' or coalesce(cardinality(p.sizes), 0) > 0)
    )
  into v_ready;
  if not coalesce(v_ready, false) then
    raise exception 'Finish your logo, delivery details, and one complete product before launching.';
  end if;
  update public.stores
  set is_active = true,
      onboarding_step = 5,
      onboarding_completed_at = coalesce(onboarding_completed_at, now()),
      pause_note = null
  where id = p_store_id
  returning * into v_store;
  return v_store;
end;
$$;
