-- Add the Kaftan category to installations that have not received it yet.
-- Image source: Unsplash photo by Abdul Raheem Kannath, available under the Unsplash License:
-- https://unsplash.com/photos/woman-wearing-a-patterned-kaftan-with-embroidered-neckline-Gnjwk2zAiKY
insert into public.browse_categories (
  name, slug, image_url, badge, search_terms, sort_order, is_featured
)
select
  'Kaftan',
  'kaftan',
  '/categories/kaftan.jpg',
  null,
  array['kaftan', 'kaftans', 'abaya', 'modest dress', 'flowy dress'],
  18,
  true
where not exists (
  select 1 from public.browse_categories where slug = 'kaftan'
);
