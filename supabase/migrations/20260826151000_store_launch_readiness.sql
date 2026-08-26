-- Keep seller launch feedback aligned with the database launch gate.
-- The UI can ask for the current blockers immediately before launching,
-- avoiding stale client-side checklists and opaque generic errors.
create or replace function public.get_owned_store_launch_readiness(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store public.stores;
  v_blockers text[] := array[]::text[];
  v_has_product boolean;
begin
  if auth.uid() is null or not public.is_store_member(p_store_id) then
    raise exception 'You do not have permission to inspect this store.';
  end if;

  select * into v_store from public.stores where id = p_store_id;
  if not found then
    raise exception 'Store not found.';
  end if;

  if v_store.logo_url is null then v_blockers := array_append(v_blockers, 'Add a store logo.'); end if;
  if nullif(trim(v_store.area), '') is null or nullif(trim(v_store.address), '') is null then
    v_blockers := array_append(v_blockers, 'Complete the delivery area and address.');
  end if;
  if v_store.opens_at is null or v_store.closes_at is null then
    v_blockers := array_append(v_blockers, 'Set store opening hours.');
  end if;

  select exists (
    select 1
    from public.products p
    left join public.categories c on c.id = p.category_id
    where p.store_id = p_store_id
      and nullif(trim(p.title), '') is not null
      and nullif(trim(coalesce(p.description, '')), '') is not null
      and p.price_aed > 0
      and coalesce(cardinality(p.image_urls), 0) > 0
      and (c.slug = 'gifting' or coalesce(cardinality(p.sizes), 0) > 0)
  ) into v_has_product;

  if not v_has_product then
    v_blockers := array_append(v_blockers, 'Add one complete product with a photo and valid price.');
  end if;

  return jsonb_build_object(
    'ready', cardinality(v_blockers) = 0,
    'blockers', to_jsonb(v_blockers)
  );
end;
$$;

revoke all on function public.get_owned_store_launch_readiness(uuid) from public, anon;
grant execute on function public.get_owned_store_launch_readiness(uuid) to authenticated;
