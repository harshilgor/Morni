-- Storefront reads are dominated by active product feeds, individual store
-- catalogues, category keyword searches, and review summary lookups.

create extension if not exists pg_trgm;

create index if not exists products_available_created_idx
  on public.products (created_at desc)
  where is_available = true;

create index if not exists products_store_available_created_idx
  on public.products (store_id, created_at desc)
  where is_available = true;

create index if not exists products_title_trgm_idx
  on public.products using gin (title gin_trgm_ops)
  where is_available = true;

create index if not exists products_description_trgm_idx
  on public.products using gin (description gin_trgm_ops)
  where is_available = true;

create index if not exists stores_active_created_idx
  on public.stores (created_at desc)
  where is_active = true and deleted_at is null;

create index if not exists product_reviews_product_rating_idx
  on public.product_reviews (product_id) include (rating);
