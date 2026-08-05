-- Seed demo UAE store and products (no auth users required)
insert into public.stores (id, name, slug, description, emirate, area, address, lat, lng, is_active, delivery_eta_minutes, opens_at, closes_at)
values
  ('11111111-1111-1111-1111-111111111111', 'Lume Boutique', 'lume-boutique', 'Curated dresses and evening wear from Dubai Design District.', 'dubai', 'Dubai Design District', 'Building 6, D3', 25.1865, 55.3012, true, 60, '10:00', '22:00');

insert into public.categories (id, store_id, name, slug, sort_order)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Dresses', 'dresses', 1);

insert into public.products (store_id, category_id, title, description, price_aed, compare_at_price_aed, image_urls, stock, is_available)
values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Satin Slip Dress', 'Bias-cut blush satin, midi length.', 320.00, 380.00, array['https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800'], 12, true),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Linen Wrap Dress', 'Breathable linen wrap for city evenings.', 275.00, null, array['https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800'], 8, true),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Sequin Mini', 'Party-ready black sequin mini.', 410.00, 450.00, array['https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800'], 5, true);
