-- Retire jewelry/accessories from active browse surfaces without deleting
-- store categories or products that may be referenced by historical records.
-- The application also treats these slugs as retired, so stale URLs return 404.
delete from public.browse_categories
where slug in ('jewelry', 'accessories', 'jewelry-accessories');
