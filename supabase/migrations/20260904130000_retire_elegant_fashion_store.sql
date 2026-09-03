-- Remove Elegant Fashion from all public storefront surfaces while preserving
-- orders, analytics, and product history. Public catalog queries consistently
-- require stores.is_active = true, so deactivation also makes its storefront
-- and products resolve as unavailable without breaking historical references.
update public.stores
set is_active = false,
    updated_at = now()
where slug = 'elegant-fashion'
   or lower(trim(name)) = 'elegant fashion';
