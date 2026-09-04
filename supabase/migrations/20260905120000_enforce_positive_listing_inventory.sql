-- A listing cannot be published without inventory. When inventory is later
-- exhausted, keep the record for the owner/history but unlist it atomically.
create or replace function public.enforce_listing_inventory()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.is_available = true and coalesce(new.stock, 0) <= 0 then
    if tg_op = 'INSERT' or coalesce(old.is_available, false) = false then
      raise exception 'A product must have at least 1 unit in stock before it can be listed.' using errcode = 'check_violation';
    end if;
    new.is_available := false;
  end if;
  return new;
end;
$$;

drop trigger if exists products_enforce_listing_inventory on public.products;
create trigger products_enforce_listing_inventory
before insert or update of stock, is_available, size_stock on public.products
for each row execute function public.enforce_listing_inventory();

-- Repair any existing zero-stock rows without deleting products or history.
update public.products
set is_available = false, updated_at = now()
where is_available = true and coalesce(stock, 0) <= 0;

