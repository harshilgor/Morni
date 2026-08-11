-- Chikankari collection for House of Nool.

insert into public.categories (id, store_id, name, slug, sort_order)
values (
  '6a400000-0000-0000-0000-000000000001',
  'b1a7815e-6321-44ca-baf6-8d06b8b53733',
  'Chikankari',
  'chikankari',
  2
)
on conflict (store_id, slug) do update set
  name = excluded.name,
  sort_order = excluded.sort_order;

insert into public.products (
  id, store_id, category_id, title, description, price_aed, compare_at_price_aed, image_urls, stock, is_available
)
values
  ('6b400000-0000-0000-0000-000000000001', 'b1a7815e-6321-44ca-baf6-8d06b8b53733', '6a400000-0000-0000-0000-000000000001', 'Crimson Pearl Chikankari Set', 'A rich crimson Chikankari kurta and trouser set with intricate ivory embroidery for polished occasions.', 299.00, 349.00, array['/seed-products/house-of-nool-chikankari/crimson-pearl-set.png'], 8, true),
  ('6b400000-0000-0000-0000-000000000002', 'b1a7815e-6321-44ca-baf6-8d06b8b53733', '6a400000-0000-0000-0000-000000000001', 'Amethyst Bloom Chikankari Kurti', 'A deep amethyst straight Chikankari kurti with tonal floral embroidery and delicate fabric-covered buttons.', 189.00, null, array['/seed-products/house-of-nool-chikankari/amethyst-bloom-kurti.png'], 12, true),
  ('6b400000-0000-0000-0000-000000000003', 'b1a7815e-6321-44ca-baf6-8d06b8b53733', '6a400000-0000-0000-0000-000000000001', 'Noir Mulberry Chikankari Kurti', 'Black cotton Chikankari kurti finished with dramatic mulberry threadwork and a contemporary split neckline.', 199.00, null, array['/seed-products/house-of-nool-chikankari/noir-mulberry-kurti.png'], 10, true),
  ('6b400000-0000-0000-0000-000000000004', 'b1a7815e-6321-44ca-baf6-8d06b8b53733', '6a400000-0000-0000-0000-000000000001', 'Blush Ivory Chikankari Kurti', 'Soft blush-pink Chikankari kurti with intricate ivory embroidery and a graceful straight silhouette.', 229.00, 269.00, array['/seed-products/house-of-nool-chikankari/blush-ivory-kurti-front-back.png', '/seed-products/house-of-nool-chikankari/blush-ivory-kurti-detail.png'], 9, true),
  ('6b400000-0000-0000-0000-000000000005', 'b1a7815e-6321-44ca-baf6-8d06b8b53733', '6a400000-0000-0000-0000-000000000001', 'Ebony Pearl Chikankari Kurti', 'An elegant black Chikankari kurti with all-over ivory floral embroidery and a refined everyday cut.', 209.00, null, array['/seed-products/house-of-nool-chikankari/ebony-pearl-kurti.png'], 11, true),
  ('6b400000-0000-0000-0000-000000000006', 'b1a7815e-6321-44ca-baf6-8d06b8b53733', '6a400000-0000-0000-0000-000000000001', 'Lime Noor Chikankari Kurti', 'A luminous lime sleeveless Chikankari kurti with tonal embroidery, styled for warm-weather days.', 219.00, null, array['/seed-products/house-of-nool-chikankari/lime-noor-kurti-standing.png', '/seed-products/house-of-nool-chikankari/lime-noor-kurti-lifestyle.png'], 10, true),
  ('6b400000-0000-0000-0000-000000000007', 'b1a7815e-6321-44ca-baf6-8d06b8b53733', '6a400000-0000-0000-0000-000000000001', 'Spring Jade Chikankari Kurti', 'Fresh jade-green Chikankari kurti with airy embroidery and subtle dotted texture for effortless daytime dressing.', 229.00, 269.00, array['/seed-products/house-of-nool-chikankari/spring-jade-kurti.png'], 7, true),
  ('6b400000-0000-0000-0000-000000000008', 'b1a7815e-6321-44ca-baf6-8d06b8b53733', '6a400000-0000-0000-0000-000000000001', 'Sky Garden Chikankari Set', 'A crisp white Chikankari kurta and trouser set with serene sky-blue embroidery.', 259.00, 305.00, array['/seed-products/house-of-nool-chikankari/sky-garden-set.png'], 8, true),
  ('6b400000-0000-0000-0000-000000000009', 'b1a7815e-6321-44ca-baf6-8d06b8b53733', '6a400000-0000-0000-0000-000000000001', 'Marigold Veil Chikankari Kurti', 'A soft ivory Chikankari kurti scattered with sunny marigold florals for a festive daytime look.', 239.00, null, array['/seed-products/house-of-nool-chikankari/marigold-veil-kurti.png'], 6, true),
  ('6b400000-0000-0000-0000-000000000010', 'b1a7815e-6321-44ca-baf6-8d06b8b53733', '6a400000-0000-0000-0000-000000000001', 'Fuchsia Heritage Chikankari Set', 'A statement fuchsia three-piece Chikankari set with a coordinating embroidered dupatta and trousers.', 329.00, 379.00, array['/seed-products/house-of-nool-chikankari/fuchsia-heritage-set.png'], 5, true),
  ('6b400000-0000-0000-0000-000000000011', 'b1a7815e-6321-44ca-baf6-8d06b8b53733', '6a400000-0000-0000-0000-000000000001', 'Cobalt Bloom Chikankari Kurti', 'A saturated cobalt-blue Chikankari kurti with tonal embroidery and button detailing at the neckline.', 199.00, null, array['/seed-products/house-of-nool-chikankari/cobalt-bloom-kurti.png'], 13, true)
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
  ('6b400000-0000-0000-0000-000000000001', 'Crimson', '#b61f2e', array['/seed-products/house-of-nool-chikankari/crimson-pearl-set.png'], array['S', 'M', 'L', 'XL'], 8, 0),
  ('6b400000-0000-0000-0000-000000000002', 'Amethyst', '#5c1f57', array['/seed-products/house-of-nool-chikankari/amethyst-bloom-kurti.png'], array['S', 'M', 'L', 'XL'], 12, 0),
  ('6b400000-0000-0000-0000-000000000003', 'Noir Mulberry', '#2a2026', array['/seed-products/house-of-nool-chikankari/noir-mulberry-kurti.png'], array['S', 'M', 'L'], 10, 0),
  ('6b400000-0000-0000-0000-000000000004', 'Blush', '#e7a6ba', array['/seed-products/house-of-nool-chikankari/blush-ivory-kurti-front-back.png', '/seed-products/house-of-nool-chikankari/blush-ivory-kurti-detail.png'], array['S', 'M', 'L', 'XL'], 9, 0),
  ('6b400000-0000-0000-0000-000000000005', 'Ebony', '#1b1b1b', array['/seed-products/house-of-nool-chikankari/ebony-pearl-kurti.png'], array['S', 'M', 'L', 'XL'], 11, 0),
  ('6b400000-0000-0000-0000-000000000006', 'Lime', '#c7d928', array['/seed-products/house-of-nool-chikankari/lime-noor-kurti-standing.png', '/seed-products/house-of-nool-chikankari/lime-noor-kurti-lifestyle.png'], array['S', 'M', 'L', 'XL'], 10, 0),
  ('6b400000-0000-0000-0000-000000000007', 'Jade', '#73a641', array['/seed-products/house-of-nool-chikankari/spring-jade-kurti.png'], array['S', 'M', 'L', 'XL'], 7, 0),
  ('6b400000-0000-0000-0000-000000000008', 'Sky Blue', '#88cddb', array['/seed-products/house-of-nool-chikankari/sky-garden-set.png'], array['S', 'M', 'L'], 8, 0),
  ('6b400000-0000-0000-0000-000000000009', 'Marigold', '#e4c65c', array['/seed-products/house-of-nool-chikankari/marigold-veil-kurti.png'], array['S', 'M', 'L'], 6, 0),
  ('6b400000-0000-0000-0000-000000000010', 'Fuchsia', '#9a2e72', array['/seed-products/house-of-nool-chikankari/fuchsia-heritage-set.png'], array['S', 'M', 'L', 'XL'], 5, 0),
  ('6b400000-0000-0000-0000-000000000011', 'Cobalt', '#1f5b98', array['/seed-products/house-of-nool-chikankari/cobalt-bloom-kurti.png'], array['S', 'M', 'L', 'XL'], 13, 0)
on conflict (product_id, color_name) do update set
  color_hex = excluded.color_hex,
  image_urls = excluded.image_urls,
  sizes = excluded.sizes,
  stock = excluded.stock,
  sort_order = excluded.sort_order;
