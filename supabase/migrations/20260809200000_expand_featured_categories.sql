-- Complete the home-page featured categories catalog.
-- Existing slugs are retained so any previous category URLs continue to work.
insert into public.browse_categories (
  name,
  slug,
  image_url,
  badge,
  search_terms,
  sort_order,
  is_featured
) values
  ('Lehengas', 'lehengas', '/categories/lehengas.webp', null, array['lehenga', 'lengha', 'bridal', 'ghagra']::text[], 1, true),
  ('Sarees', 'sarees', '/categories/sarees.png', null, array['saree', 'sari', 'drape', 'silk saree']::text[], 2, true),
  ('Sharara & Gharara Sets', 'shararas', '/categories/shararas.jpg', null, array['sharara', 'gharara', 'palazzo', 'sharara set']::text[], 3, true),
  ('Salwar Kameez / Suit Sets', 'salwar-kameez', '/categories/salwar-kameez.webp', null, array['salwar', 'kameez', 'suit', 'shalwar', 'suit set']::text[], 4, true),
  ('Kurtis', 'kurtis', '/categories/kurtis.webp', null, array['kurti', 'kurta', 'tunic']::text[], 5, true),
  ('Short Kurtis', 'short-kurtis', '/categories/short-kurtis.webp', null, array['short kurti', 'short kurta', 'tunic top']::text[], 6, true),
  ('Chikankari', 'chikankari', '/categories/chikankari.jpg', null, array['chikankari', 'lucknowi', 'embroidered kurti']::text[], 7, true),
  ('Pakistani Suits', 'pakistani-suits', '/categories/pakistani-suits.jpg', null, array['pakistani suit', 'pakistani', 'lawn suit', 'three piece suit']::text[], 8, true),
  ('Indo-Western', 'indo-western', '/categories/indo-western.jpeg', null, array['indo western', 'fusion', 'cape', 'fusion set']::text[], 9, true),
  ('Co-ord Sets', 'sets', '/categories/co-ord-sets.jpg', null, array['co-ord', 'coord', 'matching set', 'two piece set']::text[], 10, true),
  ('Party Wear', 'party-wear', '/categories/party-wear.webp', 'Party', array['party', 'evening', 'sequin', 'cocktail', 'occasion']::text[], 11, true),
  ('Casual Wear', 'casual-wear', '/categories/brunch-everyday.jpg', null, array['casual', 'everyday', 'brunch', 'daywear']::text[], 12, true),
  ('Office Wear', 'office-wear', '/categories/office-wear.webp', null, array['office', 'workwear', 'work wear', 'formal']::text[], 13, true),
  ('Anarkalis', 'anarkalis', '/categories/anarkalis.jpg', null, array['anarkali', 'anarkali suit', 'flared kurta']::text[], 14, true),
  ('Ethnic Tops / Crop Tops', 'tops', '/categories/ethnic-tops-crop-tops.jpg', null, array['ethnic top', 'crop top', 'blouse', 'top']::text[], 15, true)
on conflict (slug) do update set
  name = excluded.name,
  image_url = excluded.image_url,
  badge = excluded.badge,
  search_terms = excluded.search_terms,
  sort_order = excluded.sort_order,
  is_featured = excluded.is_featured;

update public.browse_categories
set is_featured = false
where slug = 'more';
