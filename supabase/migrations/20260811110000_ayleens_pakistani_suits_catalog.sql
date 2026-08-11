-- Pakistani suits catalog for the Ayleens Collection demo boutique.

insert into public.stores (
  id, name, slug, description, emirate, area, address, lat, lng, cover_url,
  is_active, delivery_eta_minutes, opens_at, closes_at
)
values (
  'd2000000-0000-0000-0000-000000000001',
  'Ayleens Collection',
  'ayleens-collection',
  'Contemporary Pakistani lawn suits and elegant three-piece sets for everyday and occasion dressing.',
  'dubai',
  'Meena Bazaar',
  'Meena Bazaar, Bur Dubai',
  25.2582,
  55.3031,
  '/seed-products/ayleens-collection/ayleens-banner.jpg',
  true,
  60,
  '10:00',
  '22:00'
)
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  description = excluded.description,
  emirate = excluded.emirate,
  area = excluded.area,
  address = excluded.address,
  lat = excluded.lat,
  lng = excluded.lng,
  cover_url = excluded.cover_url,
  is_active = excluded.is_active,
  delivery_eta_minutes = excluded.delivery_eta_minutes,
  opens_at = excluded.opens_at,
  closes_at = excluded.closes_at;

insert into public.categories (id, store_id, name, slug, sort_order)
values (
  'd2000000-0000-0000-0000-000000000002',
  'd2000000-0000-0000-0000-000000000001',
  'Pakistani Suits',
  'pakistani-suits',
  1
)
on conflict (store_id, slug) do update set
  name = excluded.name,
  sort_order = excluded.sort_order;

insert into public.products (
  id, store_id, category_id, title, description, price_aed, compare_at_price_aed, image_urls, stock, is_available
)
values
  (
    'd2000000-0000-0000-0000-000000000011',
    'd2000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000002',
    'Saffron Garden Lawn Suit',
    'Printed Pakistani lawn three-piece suit with a saffron floral kurta, trousers, and an artful matching dupatta.',
    219.00, 269.00, array['/seed-products/ayleens-collection/saffron-garden-lawn-suit.jpg'], 12, true
  ),
  (
    'd2000000-0000-0000-0000-000000000012',
    'd2000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000002',
    'Golden Dusk Printed Suit',
    'Soft gold Pakistani suit set with a printed kurta, straight trousers, and a contrasting plum dupatta.',
    239.00, null, array['/seed-products/ayleens-collection/golden-dusk-printed-suit.jpg'], 10, true
  ),
  (
    'd2000000-0000-0000-0000-000000000013',
    'd2000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000002',
    'Mulberry Garden 3-Piece Suit',
    'Deep mulberry floral Pakistani three-piece suit with a flowing printed dupatta for polished daytime events.',
    259.00, 305.00, array['/seed-products/ayleens-collection/mulberry-garden-3-piece-suit.jpg'], 8, true
  ),
  (
    'd2000000-0000-0000-0000-000000000014',
    'd2000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000002',
    'Ivory Embroidered Lawn Suit',
    'Elegant ivory Pakistani lawn suit with delicate embroidery-inspired print and a coordinating dupatta.',
    279.00, 329.00, array['/seed-products/ayleens-collection/ivory-embroidered-lawn-suit.jpg'], 7, true
  ),
  (
    'd2000000-0000-0000-0000-000000000015',
    'd2000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000002',
    'Sage Pastel Lawn Suit',
    'Light sage Pakistani lawn three-piece set with soft florals and a breezy matching dupatta.',
    199.00, null, array['/seed-products/ayleens-collection/sage-pastel-lawn-suit.jpg'], 14, true
  ),
  (
    'd2000000-0000-0000-0000-000000000016',
    'd2000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000002',
    'Monochrome Floral Suit',
    'Monochrome floral Pakistani suit with a statement black-and-white dupatta and tailored straight trousers.',
    229.00, 275.00, array['/seed-products/ayleens-collection/monochrome-floral-suit.jpg'], 11, true
  )
on conflict (id) do update set
  category_id = excluded.category_id,
  title = excluded.title,
  description = excluded.description,
  price_aed = excluded.price_aed,
  compare_at_price_aed = excluded.compare_at_price_aed,
  image_urls = excluded.image_urls,
  stock = excluded.stock,
  is_available = excluded.is_available;

insert into public.product_variants (product_id, color_name, color_hex, image_urls, sizes, stock, sort_order)
values
  ('d2000000-0000-0000-0000-000000000011', 'Saffron', '#c89524', array['/seed-products/ayleens-collection/saffron-garden-lawn-suit.jpg'], array['S', 'M', 'L', 'XL'], 12, 0),
  ('d2000000-0000-0000-0000-000000000012', 'Golden Dusk', '#b39b60', array['/seed-products/ayleens-collection/golden-dusk-printed-suit.jpg'], array['S', 'M', 'L', 'XL'], 10, 0),
  ('d2000000-0000-0000-0000-000000000013', 'Mulberry', '#5c293d', array['/seed-products/ayleens-collection/mulberry-garden-3-piece-suit.jpg'], array['S', 'M', 'L'], 8, 0),
  ('d2000000-0000-0000-0000-000000000014', 'Ivory', '#ece4d2', array['/seed-products/ayleens-collection/ivory-embroidered-lawn-suit.jpg'], array['S', 'M', 'L'], 7, 0),
  ('d2000000-0000-0000-0000-000000000015', 'Sage', '#9ca889', array['/seed-products/ayleens-collection/sage-pastel-lawn-suit.jpg'], array['S', 'M', 'L', 'XL'], 14, 0),
  ('d2000000-0000-0000-0000-000000000016', 'Monochrome', '#2f3237', array['/seed-products/ayleens-collection/monochrome-floral-suit.jpg'], array['S', 'M', 'L', 'XL'], 11, 0)
on conflict (product_id, color_name) do update set
  color_hex = excluded.color_hex,
  image_urls = excluded.image_urls,
  sizes = excluded.sizes,
  stock = excluded.stock,
  sort_order = excluded.sort_order;
