-- Keep historical listings intact while requiring occasion tags for new
-- products and any listing whose occasion is edited.
create or replace function public.require_product_occasion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.occasion is null or btrim(new.occasion) = '' then
    raise exception 'Choose the best occasion for this product.';
  end if;
  return new;
end;
$$;

drop trigger if exists products_require_occasion on public.products;
create trigger products_require_occasion
  before insert or update of occasion on public.products
  for each row execute function public.require_product_occasion();
