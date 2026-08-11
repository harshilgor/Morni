-- Add the supplied co-ord sets to the Elegance Fashion boutique.
-- Images are served from the app's public directory so they work in local and Vercel environments.

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

  insert into public.categories (id, store_id, name, slug, sort_order)
  values (
    'e1000000-0000-0000-0000-000000000001',
    v_store_id,
    'Co-ord Sets',
    'co-ord-sets',
    1
  )
  on conflict (store_id, slug) do update set
    name = excluded.name,
    sort_order = excluded.sort_order
  returning id into v_category_id;

  insert into public.products (
    id, store_id, category_id, title, description, price_aed, compare_at_price_aed,
    image_urls, stock, is_available
  )
  values
    (
      'e1000000-0000-0000-0000-000000000011',
      v_store_id,
      v_category_id,
      'Fuchsia Embroidered Co-ord Set',
      'A vibrant fuchsia two-piece set with delicate silver embroidery, tassel detailing, and matching straight trousers.',
      169.00,
      209.00,
      array['/seed-products/elegance-fashion/fuchsia-embroidered-coord-set.png'],
      8,
      true
    ),
    (
      'e1000000-0000-0000-0000-000000000012',
      v_store_id,
      v_category_id,
      'Noir Embroidered Co-ord Set',
      'A black satin-look embroidered kurta with ivory wide-leg trousers for an elegant, elevated everyday look.',
      179.00,
      219.00,
      array['/seed-products/elegance-fashion/noir-embroidered-coord-set.png'],
      6,
      true
    )
  on conflict (id) do update set
    store_id = excluded.store_id,
    category_id = excluded.category_id,
    title = excluded.title,
    description = excluded.description,
    price_aed = excluded.price_aed,
    compare_at_price_aed = excluded.compare_at_price_aed,
    image_urls = excluded.image_urls,
    stock = excluded.stock,
    is_available = excluded.is_available;

  insert into public.product_variants (
    product_id, color_name, color_hex, image_urls, sizes, stock, sort_order
  )
  values
    (
      'e1000000-0000-0000-0000-000000000011',
      'Fuchsia',
      '#b70f78',
      array['/seed-products/elegance-fashion/fuchsia-embroidered-coord-set.png'],
      array['S', 'M', 'L', 'XL'],
      8,
      0
    ),
    (
      'e1000000-0000-0000-0000-000000000012',
      'Noir & Ivory',
      '#1f1f1f',
      array['/seed-products/elegance-fashion/noir-embroidered-coord-set.png'],
      array['S', 'M', 'L', 'XL'],
      6,
      0
    )
  on conflict (product_id, color_name) do update set
    color_hex = excluded.color_hex,
    image_urls = excluded.image_urls,
    sizes = excluded.sizes,
    stock = excluded.stock,
    sort_order = excluded.sort_order;
end;
$$;
