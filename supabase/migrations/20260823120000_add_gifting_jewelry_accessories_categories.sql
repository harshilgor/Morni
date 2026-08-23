-- Add gifting and jewelry/accessories to the home-page featured categories.
insert into public.browse_categories (
  name,
  slug,
  image_url,
  badge,
  search_terms,
  sort_order,
  is_featured
) values
  (
    'Gifting',
    'gifting',
    '/categories/gifting.jpg',
    null,
    array['gift', 'gifting', 'present', 'celebration', 'occasion']::text[],
    16,
    true
  ),
  (
    'Jewelry / Accessories',
    'jewelry-accessories',
    '/categories/jewelry-accessories.png',
    null,
    array[
      'jewelry',
      'jewellery',
      'accessory',
      'accessories',
      'necklace',
      'earring',
      'ring',
      'bracelet',
      'clutch',
      'scarf'
    ]::text[],
    17,
    true
  )
on conflict (slug) do update set
  name = excluded.name,
  image_url = excluded.image_url,
  badge = excluded.badge,
  search_terms = excluded.search_terms,
  sort_order = excluded.sort_order,
  is_featured = excluded.is_featured;
