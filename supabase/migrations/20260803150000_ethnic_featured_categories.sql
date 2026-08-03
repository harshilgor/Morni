-- Ethnic / occasion featured categories for Morni
update public.browse_categories set is_featured = false;

insert into public.browse_categories (name, slug, image_url, badge, search_terms, sort_order, is_featured) values
  ('Lehengas', 'lehengas', 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800', null, array['lehenga','lengha','bridal','ghagra']::text[], 1, true),
  ('Shararas', 'shararas', 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=800', null, array['sharara','gharara','palazzo']::text[], 2, true),
  ('Salwar Kameez', 'salwar-kameez', 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800', null, array['salwar','kameez','suit','shalwar']::text[], 3, true),
  ('Kurtis', 'kurtis', 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800', null, array['kurti','kurta','tunic']::text[], 4, true),
  ('Party Wear', 'party-wear', 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800', 'PARTY', array['party','evening','sequin','cocktail','occasion']::text[], 5, true),
  ('Indo-Western', 'indo-western', 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800', null, array['indo','western','fusion','coord','cape','dress']::text[], 6, true),
  ('More', 'more', 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800', null, array[]::text[], 7, true)
on conflict (slug) do update set
  name = excluded.name,
  image_url = excluded.image_url,
  badge = excluded.badge,
  search_terms = excluded.search_terms,
  sort_order = excluded.sort_order,
  is_featured = true;
