-- Ensure colour variants support exact inventory per size.
-- Idempotent so it is safe for databases where the earlier migration was
-- partially applied or missing from migration history.
alter table public.product_variants
  add column if not exists size_stock jsonb not null default '{}'::jsonb;

alter table public.product_variants
  drop constraint if exists product_variants_size_stock_object;

alter table public.product_variants
  add constraint product_variants_size_stock_object
  check (jsonb_typeof(size_stock) = 'object');
