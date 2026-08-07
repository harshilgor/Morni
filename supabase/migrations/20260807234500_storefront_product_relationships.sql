-- Preserve PostgREST relationship inference while exposing effective storefront prices.
create or replace view public.storefront_products
with (security_invoker = true)
as
select
  p.id,
  p.store_id,
  p.category_id,
  p.title,
  p.description,
  public.sale_price_for_product(p.id, p.price_aed)::numeric(10,2) as price_aed,
  case
    when public.sale_price_for_product(p.id, p.price_aed) < p.price_aed
      then greatest(coalesce(p.compare_at_price_aed, p.price_aed), p.price_aed)
    else p.compare_at_price_aed
  end::numeric(10,2) as compare_at_price_aed,
  p.image_urls,
  p.stock,
  p.is_available,
  p.created_at,
  p.updated_at,
  p.sizes,
  public.sale_price_for_product(p.id, p.price_aed) as effective_price_aed,
  p.price_aed as base_price_aed,
  (
    select sp.title
    from public.promotion_products pp
    join public.store_promotions sp on sp.id = pp.promotion_id
    where pp.product_id = p.id
      and sp.promotion_kind = 'sale'
      and sp.is_active = true
      and coalesce(sp.starts_at, now()) <= now()
      and (sp.ends_at is null or sp.ends_at > now())
    order by public.sale_price_for_product(p.id, p.price_aed), sp.created_at desc
    limit 1
  ) as promotion_title
from public.products p;

grant select on public.storefront_products to anon, authenticated;
