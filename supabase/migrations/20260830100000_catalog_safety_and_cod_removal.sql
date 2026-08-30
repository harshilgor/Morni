update public.stores
set is_active = false, pause_note = 'Store retired from the live marketplace', updated_at = now()
where lower(trim(name)) = 'tia sarees';

create or replace function public.reject_new_cod_orders()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.payment_method = 'cod' then
    raise exception 'Cash on delivery is no longer available.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
drop trigger if exists orders_reject_new_cod on public.orders;
create trigger orders_reject_new_cod before insert on public.orders
for each row execute function public.reject_new_cod_orders();

create or replace function public.normalize_non_sized_products()
returns trigger language plpgsql set search_path = public as $$
declare category_slug text;
begin
  select lower(slug) into category_slug from public.categories where id = new.category_id;
  if coalesce(category_slug, '') in ('hamper', 'hampers', 'gifting') then new.sizes := '{}'::text[]; end if;
  return new;
end;
$$;
drop trigger if exists products_normalize_non_sized on public.products;
create trigger products_normalize_non_sized before insert or update of category_id, sizes on public.products
for each row execute function public.normalize_non_sized_products();
update public.products p set sizes = '{}'
from public.categories c where c.id = p.category_id and lower(c.slug) in ('hamper', 'hampers', 'gifting')
and cardinality(coalesce(p.sizes, '{}')) > 0;

create index if not exists products_store_category_available_idx on public.products (store_id, category_id, is_available);
create index if not exists products_sizes_gin_idx on public.products using gin (sizes);
