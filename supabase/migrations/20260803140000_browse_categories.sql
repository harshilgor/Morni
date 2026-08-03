-- Featured marketplace browse categories
create table if not exists public.browse_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  image_url text not null,
  badge text,
  search_terms text[] not null default '{}',
  sort_order integer not null default 0,
  is_featured boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.browse_categories enable row level security;

drop policy if exists "browse_categories_public_read" on public.browse_categories;
create policy "browse_categories_public_read"
  on public.browse_categories for select
  using (true);

insert into public.browse_categories (name, slug, image_url, badge, search_terms, sort_order) values
  ('Dresses', 'dresses', 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800', null, array['dress','slip','wrap','mini','midi'], 1),
  ('Abayas', 'abayas', 'https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?w=800', null, array['abaya','crepe','embroidered'], 2),
  ('Tops', 'tops', 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800', null, array['top','shirt','knit','coord','blouse'], 3),
  ('Accessories', 'accessories', 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800', 'NEW', array['earring','necklace','ring','jewelry','accessory'], 4),
  ('Shoes', 'shoes', 'https://images.unsplash.com/photo-1543163521-1bfcec4bb41f?w=800', 'JUST LAUNCHED', array['shoe','heel','sandal','sneaker','boot'], 5),
  ('Bags', 'bags', 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800', null, array['bag','tote','clutch','purse'], 6),
  ('Jewelry', 'jewelry', 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800', null, array['jewelry','pearl','gold','necklace','earring','ring'], 7),
  ('Sets', 'sets', 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800', null, array['set','coord','matching'], 8),
  ('Evening', 'evening', 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800', 'PARTY', array['sequin','evening','party','mini'], 9)
on conflict (slug) do nothing;
