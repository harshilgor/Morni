-- Reassign the existing Ladies Long Kurta Set to its store's Kurtis category.
-- The update preserves the original product ID and does not create a duplicate product.

do $$
declare
  v_store_id uuid;
  v_kurtis_category_id uuid;
begin
  select store_id
  into v_store_id
  from public.products
  where id = '9c002d10-1d89-473f-9550-6d4a1eb33992';

  if v_store_id is null then
    return;
  end if;

  insert into public.categories (store_id, name, slug, sort_order)
  values (v_store_id, 'Kurtis', 'kurtis', 1)
  on conflict (store_id, slug) do update set
    name = excluded.name
  returning id into v_kurtis_category_id;

  update public.products
  set category_id = v_kurtis_category_id
  where id = '9c002d10-1d89-473f-9550-6d4a1eb33992';
end
$$;
