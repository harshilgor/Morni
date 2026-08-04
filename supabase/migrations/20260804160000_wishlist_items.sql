-- Wishlist items (favorites) for shoppers
create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  shopper_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (shopper_id, product_id)
);

alter table public.wishlist_items enable row level security;

create index if not exists wishlist_items_product_id_idx on public.wishlist_items (product_id);

drop policy if exists "wishlist_items_select_own" on public.wishlist_items;
drop policy if exists "wishlist_items_insert_own" on public.wishlist_items;
drop policy if exists "wishlist_items_delete_own" on public.wishlist_items;
drop policy if exists "wishlist_items_update_own" on public.wishlist_items;

create policy "wishlist_items_select_own"
  on public.wishlist_items for select
  using (shopper_id = auth.uid());

create policy "wishlist_items_insert_own"
  on public.wishlist_items for insert
  with check (shopper_id = auth.uid());

create policy "wishlist_items_delete_own"
  on public.wishlist_items for delete
  using (shopper_id = auth.uid());

-- No updates policy needed (toggle is insert/delete)

