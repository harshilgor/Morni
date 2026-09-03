-- Retire only the duplicate Zaahi Designs storefront. Keep the canonical
-- Zaahi store active and preserve all historical records for reporting.
update public.stores
set is_active = false,
    updated_at = now()
where id = '75d5c723-ea5f-4595-99e3-cb7cd9a53bae'
  and slug = 'zaahi-designs-4nfo'
  and lower(trim(name)) = 'zaahi designs';
