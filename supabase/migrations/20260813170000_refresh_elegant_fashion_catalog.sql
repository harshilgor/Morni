-- Replace Elegance Fashion's prior catalogue with the supplied Elegant Fashion kurti.
-- Product-level dependent rows cascade (or preserve historical order line details) through
-- the existing foreign-key definitions.

do $$
declare
  v_store_id uuid;
  v_category_id uuid;
begin
  select id
    into v_store_id
  from public.stores
  where slug = 'elegance-fashion-n6di';

  if v_store_id is null then
    raise exception 'Elegance Fashion store (elegance-fashion-n6di) was not found.';
  end if;

  update public.stores
  set name = 'Elegant Fashion'
  where id = v_store_id;

  -- Remove every existing product belonging to this boutique before creating the new collection.
  delete from public.products
  where store_id = v_store_id;

  select id
    into v_category_id
  from public.categories
  where store_id = v_store_id
  order by sort_order, created_at
  limit 1;

  if v_category_id is null then
    insert into public.categories (store_id, name, slug, sort_order)
    values (v_store_id, 'Kurtis', 'kurtis', 1)
    returning id into v_category_id;
  else
    update public.categories
    set name = 'Kurtis', slug = 'kurtis', sort_order = 1
    where id = v_category_id;
  end if;

  insert into public.products (
    id, store_id, category_id, title, description, price_aed, compare_at_price_aed,
    image_urls, stock, is_available
  )
  values (
    'e1000000-0000-0000-0000-000000000021',
    v_store_id,
    v_category_id,
    'Fuchsia Embroidered Kurti',
    'A vibrant fuchsia kurti with delicate silver embroidery, tassel accents, and matching straight trousers.',
    129.00,
    null,
    array['/seed-products/elegant-fashion/fuchsia-embroidered-kurti.png'],
    10,
    true
  );

  insert into public.product_variants (
    product_id, color_name, color_hex, image_urls, sizes, stock, sort_order
  )
  values (
    'e1000000-0000-0000-0000-000000000021',
    'Fuchsia',
    '#b50d7a',
    array['/seed-products/elegant-fashion/fuchsia-embroidered-kurti.png'],
    array['S', 'M', 'L', 'XL'],
    10,
    0
  );
end;
$$;
