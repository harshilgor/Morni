-- storefront_products (security_invoker) computes price_aed / compare_at / promotion
-- via sale_price_for_product. Revoking EXECUTE from anon/authenticated made every
-- product detail select return 401, which the app surfaces as a 404.

grant execute on function public.sale_price_for_product(uuid, numeric)
  to anon, authenticated, service_role;
