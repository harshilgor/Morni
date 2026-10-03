insert into public.browse_categories
  (name, slug, image_url, badge, search_terms, sort_order, is_featured)
values
  ('Kids', 'kids', '/categories/kids.svg', null,
   array['kids', 'kid', 'children', 'child', 'boys', 'girls', 'baby', 'toddler', 'youth']::text[],
   17, true)
on conflict (slug) do update set
  name = excluded.name,
  image_url = excluded.image_url,
  badge = excluded.badge,
  search_terms = excluded.search_terms,
  sort_order = excluded.sort_order,
  is_featured = true;
