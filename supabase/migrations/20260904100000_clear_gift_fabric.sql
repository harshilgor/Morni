-- Gift listings do not have fabric. Enforce this at the data boundary so
-- direct client writes and every publishing path stay consistent.
create or replace function public.clear_gift_product_fabric()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.categories c
    where c.id = new.category_id
      and c.slug in ('gifting', 'hamper', 'hampers')
  ) then
    new.fabric := null;
  end if;
  return new;
end;
$$;

drop trigger if exists clear_gift_product_fabric on public.products;
create trigger clear_gift_product_fabric
before insert or update of category_id, fabric on public.products
for each row execute function public.clear_gift_product_fabric();

revoke all on function public.clear_gift_product_fabric() from public;
