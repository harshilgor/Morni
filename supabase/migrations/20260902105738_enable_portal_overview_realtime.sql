-- Keep seller overview metrics synchronized as operational records change.
-- The guards are safe for fresh databases and for environments where an entry
-- has already been enabled through the Supabase dashboard.
do $$
declare
  overview_table text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;

  foreach overview_table in array array['orders', 'products', 'product_reviews', 'wishlist_items'] loop
    if to_regclass(format('public.%I', overview_table)) is not null
      and not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = overview_table
      ) then
      execute format('alter publication supabase_realtime add table public.%I', overview_table);
    end if;
  end loop;
end
$$;
