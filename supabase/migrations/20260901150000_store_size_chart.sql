-- Allow each store owner to publish their own sizing reference image.
alter table public.stores
  add column if not exists size_chart_url text;

notify pgrst, 'reload schema';
