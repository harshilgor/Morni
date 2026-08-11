-- Party Wear catalog additions for the Lume Boutique demo store.
-- Local image paths are intentionally used so the demo catalog works in development and Vercel deployments.

insert into public.categories (id, store_id, name, slug, sort_order)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '11111111-1111-1111-1111-111111111111',
  'Party Wear',
  'party-wear',
  2
)
on conflict (store_id, slug) do update set
  name = excluded.name,
  sort_order = excluded.sort_order;

insert into public.products (
  id, store_id, category_id, title, description, price_aed, compare_at_price_aed, image_urls, stock, is_available
)
values
  (
    'c1000000-0000-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Midnight Sequin Gown',
    'Black sequin evening gown with a sheer waist and flowing skirt. A striking party and formal-event look.',
    349.00, 425.00, array['/seed-products/lume-party-wear/midnight-sequin-gown.jpg'], 7, true
  ),
  (
    'c1000000-0000-0000-0000-000000000002',
    '11111111-1111-1111-1111-111111111111',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Marigold Mirror Lehenga Set',
    'Festive marigold lehenga set with mirror embroidery, tassel details, and a light jacket layer.',
    529.00, 625.00, array['/seed-products/lume-party-wear/marigold-mirror-lehenga-set.jpg'], 5, true
  ),
  (
    'c1000000-0000-0000-0000-000000000003',
    '11111111-1111-1111-1111-111111111111',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Noir One-Shoulder Co-ord',
    'Black one-shoulder embellished top with wide-leg trousers and a soft drape detail for cocktail evenings.',
    289.00, 345.00, array['/seed-products/lume-party-wear/noir-one-shoulder-coord.jpg'], 9, true
  ),
  (
    'c1000000-0000-0000-0000-000000000004',
    '11111111-1111-1111-1111-111111111111',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Plum Embroidered Anarkali',
    'A richly toned plum anarkali with embroidered bodice, layered hem, and a celebratory silhouette.',
    459.00, 540.00, array['/seed-products/lume-party-wear/plum-embroidered-anarkali.jpg'], 6, true
  ),
  (
    'c1000000-0000-0000-0000-000000000005',
    '11111111-1111-1111-1111-111111111111',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Golden Hour Fusion Set',
    'Black and gold tie-front fusion top with wide-leg trousers — an effortless choice for dinner parties.',
    319.00, null, array['/seed-products/lume-party-wear/golden-hour-fusion-set.jpg'], 8, true
  ),
  (
    'c1000000-0000-0000-0000-000000000006',
    '11111111-1111-1111-1111-111111111111',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Rose Gold Ruffle Lehenga',
    'Rose-gold ruffle lehenga with a pearl-embellished blouse and fluid drape for wedding celebrations.',
    649.00, 725.00, array['/seed-products/lume-party-wear/rose-gold-ruffle-lehenga.jpg'], 4, true
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
  ('c1000000-0000-0000-0000-000000000001', 'Midnight Black', '#171717', array['/seed-products/lume-party-wear/midnight-sequin-gown.jpg'], array['S', 'M', 'L'], 7, 0),
  ('c1000000-0000-0000-0000-000000000002', 'Marigold', '#d59b16', array['/seed-products/lume-party-wear/marigold-mirror-lehenga-set.jpg'], array['S', 'M', 'L'], 5, 0),
  ('c1000000-0000-0000-0000-000000000003', 'Noir', '#161616', array['/seed-products/lume-party-wear/noir-one-shoulder-coord.jpg'], array['S', 'M', 'L', 'XL'], 9, 0),
  ('c1000000-0000-0000-0000-000000000004', 'Plum', '#4c224d', array['/seed-products/lume-party-wear/plum-embroidered-anarkali.jpg'], array['S', 'M', 'L'], 6, 0),
  ('c1000000-0000-0000-0000-000000000005', 'Black Gold', '#282222', array['/seed-products/lume-party-wear/golden-hour-fusion-set.jpg'], array['S', 'M', 'L', 'XL'], 8, 0),
  ('c1000000-0000-0000-0000-000000000006', 'Rose Gold', '#9d7b78', array['/seed-products/lume-party-wear/rose-gold-ruffle-lehenga.jpg'], array['S', 'M', 'L'], 4, 0)
on conflict (product_id, color_name) do update set
  color_hex = excluded.color_hex,
  image_urls = excluded.image_urls,
  sizes = excluded.sizes,
  stock = excluded.stock,
  sort_order = excluded.sort_order;
