-- Remove unused browse categories without destroying store history.
-- Product/category rows are intentionally preserved for historical reporting.
-- Abort rather than silently detaching any currently available product.
do $$
begin
  if exists (
    select 1
    from public.products p
    join public.categories c on c.id = p.category_id
    where c.slug in ('office-wear', 'casual-wear')
      and coalesce(p.is_available, false) = true
  ) then
    raise exception 'Cannot remove browse categories: available products still use office-wear or casual-wear';
  end if;
end $$;

delete from public.browse_categories
where slug in ('office-wear', 'casual-wear');
