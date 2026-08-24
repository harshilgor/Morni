-- Restore backend (service_role) access to the application tables.
--
-- The Data API roles (anon, authenticated) intentionally reach data through
-- views (e.g. storefront_products) and SECURITY DEFINER RPCs, so they are not
-- granted direct table access. The trusted server-side service_role key, used
-- by the Next.js /api routes through the admin client, must be able to read and
-- write these tables directly.
--
-- Newer Supabase projects do not auto-expose new tables to the Data API roles,
-- so tables created by earlier migrations left service_role without
-- SELECT/INSERT/UPDATE/DELETE. That broke server-side checkout — the orders API
-- reads public.products with the admin client and returned "Unable to verify
-- your bag." — along with any other admin-client table operation.
--
-- service_role is server-only (never exposed to the browser) and already
-- bypasses RLS, so granting it full table access matches Supabase's default
-- posture without widening the client-facing surface.

grant usage on schema public to service_role;

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

-- Cover tables and sequences added by future migrations too.
alter default privileges in schema public
  grant all privileges on tables to service_role;
alter default privileges in schema public
  grant all privileges on sequences to service_role;

notify pgrst, 'reload schema';
