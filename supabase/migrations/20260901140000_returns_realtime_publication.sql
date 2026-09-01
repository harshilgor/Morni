-- Keep the returns portal live after return records change.
-- The guards make this safe to apply when a table or publication entry already exists.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if to_regclass('public.return_requests') is not null
      and not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'return_requests'
      ) then
      alter publication supabase_realtime add table public.return_requests;
    end if;

    if to_regclass('public.return_handoffs') is not null
      and not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'return_handoffs'
      ) then
      alter publication supabase_realtime add table public.return_handoffs;
    end if;

    if to_regclass('public.return_refunds') is not null
      and not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'return_refunds'
      ) then
      alter publication supabase_realtime add table public.return_refunds;
    end if;
  end if;
end
$$;
