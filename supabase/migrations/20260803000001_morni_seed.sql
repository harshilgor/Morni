-- Seed demo UAE stores and products (no auth users required)
insert into public.stores (id, name, slug, description, emirate, area, address, lat, lng, is_active, delivery_eta_minutes, opens_at, closes_at)
values
  ('11111111-1111-1111-1111-111111111111', 'Lume Boutique', 'lume-boutique', 'Curated dresses and evening wear from Dubai Design District.', 'dubai', 'Dubai Design District', 'Building 6, D3', 25.1865, 55.3012, true, 60, '10:00', '22:00'),
  ('22222222-2222-2222-2222-222222222222', 'Sand & Silk', 'sand-and-silk', 'Everyday abayas and soft separates for Jumeirah.', 'dubai', 'Jumeirah', 'Al Wasl Road 42', 25.1980, 55.2450, true, 55, '09:00', '21:00'),
  ('33333333-3333-3333-3333-333333333333', 'Noor Atelier', 'noor-atelier', 'Jewelry and accessories with same-hour pickup in Abu Dhabi.', 'abu_dhabi', 'Al Reem Island', 'Gate District Tower 2', 24.4940, 54.4070, true, 60, '10:00', '20:00');

insert into public.categories (id, store_id, name, slug, sort_order)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Dresses', 'dresses', 1),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Abayas', 'abayas', 1),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 'Jewelry', 'jewelry', 1);

insert into public.products (store_id, category_id, title, description, price_aed, compare_at_price_aed, image_urls, stock, is_available)
values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Satin Slip Dress', 'Bias-cut blush satin, midi length.', 320.00, 380.00, array['https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800'], 12, true),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Linen Wrap Dress', 'Breathable linen wrap for city evenings.', 275.00, null, array['https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800'], 8, true),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Sequin Mini', 'Party-ready black sequin mini.', 410.00, 450.00, array['https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800'], 5, true),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Soft Crepe Abaya', 'Everyday black crepe with subtle cuff detail.', 290.00, null, array['https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?w=800'], 15, true),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Embroidered Open Abaya', 'Open-front abaya with ivory embroidery.', 520.00, 580.00, array['https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800'], 6, true),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Knit Coord Set', 'Matching knit top and wide pants.', 240.00, null, array['https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800'], 10, true),
  ('33333333-3333-3333-3333-333333333333', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Pearl Drop Earrings', 'Gold-plated drops with freshwater pearls.', 180.00, null, array['https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800'], 20, true),
  ('33333333-3333-3333-3333-333333333333', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Stackable Rings Set', 'Three slim gold-tone rings.', 95.00, 120.00, array['https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800'], 25, true),
  ('33333333-3333-3333-3333-333333333333', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Layered Necklace', 'Delicate dual-chain necklace.', 210.00, null, array['https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800'], 14, true);
