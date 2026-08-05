alter table public.products
  add column if not exists sizes text[] not null default array['S', 'M', 'L']::text[];

alter table public.order_items
  add column if not exists size text;

update public.products
set sizes = array['S', 'M', 'L']::text[]
where sizes is null or cardinality(sizes) = 0;

