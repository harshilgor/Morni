-- Preserve the exact ordered-product image even if its catalog listing changes later.
alter table public.order_items
  add column if not exists image_url text;

create or replace function public.snapshot_order_item_image()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.image_url is null then
    select coalesce(variant.image_urls[1], product.image_urls[1])
      into new.image_url
      from public.products product
      left join public.product_variants variant on variant.id = new.variant_id
     where product.id = new.product_id;
  end if;
  return new;
end;
$$;

drop trigger if exists order_items_snapshot_image on public.order_items;
create trigger order_items_snapshot_image
before insert on public.order_items
for each row execute function public.snapshot_order_item_image();

-- Make current order history useful immediately where its catalog products remain.
update public.order_items item
set image_url = coalesce(
  (select variant.image_urls[1] from public.product_variants variant where variant.id = item.variant_id),
  product.image_urls[1]
)
from public.products product
where item.product_id = product.id
  and item.image_url is null;

notify pgrst, 'reload schema';
