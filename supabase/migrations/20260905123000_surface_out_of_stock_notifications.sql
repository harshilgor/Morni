alter table public.store_inventory_notifications
  drop constraint if exists store_inventory_notifications_kind_check;
alter table public.store_inventory_notifications
  add constraint store_inventory_notifications_kind_check
  check (kind in ('legacy_size_inventory', 'restored_inventory', 'out_of_stock'));

-- Keep one actionable notification per product and preserve the product row.
insert into public.store_inventory_notifications (store_id, product_id, kind, title, detail, payload)
select p.store_id, p.id, 'out_of_stock', 'Restock product before relisting',
  case when cardinality(coalesce(p.sizes, '{}'::text[])) > 0
    then format('%s is out of stock. Add quantities for: %s.', p.title, array_to_string(p.sizes, ', '))
    else format('%s is out of stock. Add at least 1 unit to relist it.', p.title)
  end,
  jsonb_build_object('sizes', coalesce(p.sizes, '{}'::text[]), 'stock', coalesce(p.stock, 0))
from public.products p
where coalesce(p.stock, 0) <= 0
  and not exists (select 1 from public.store_inventory_notifications n where n.product_id = p.id and n.kind = 'out_of_stock' and n.status = 'pending');

create or replace function public.enforce_listing_inventory()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.is_available = true and coalesce(new.stock, 0) <= 0 then
    if tg_op = 'INSERT' or coalesce(old.is_available, false) = false then
      raise exception 'A product must have at least 1 unit in stock before it can be listed.' using errcode = 'check_violation';
    end if;
    new.is_available := false;
    insert into public.store_inventory_notifications (store_id, product_id, kind, title, detail, payload)
    values (new.store_id, new.id, 'out_of_stock', 'Restock product before relisting',
      case when cardinality(coalesce(new.sizes, '{}'::text[])) > 0
        then format('%s is out of stock. Add quantities for: %s.', new.title, array_to_string(new.sizes, ', '))
        else format('%s is out of stock. Add at least 1 unit to relist it.', new.title)
      end, jsonb_build_object('sizes', coalesce(new.sizes, '{}'::text[]), 'stock', 0))
    on conflict do nothing;
  end if;
  return new;
end; $$;
