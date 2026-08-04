alter table public.stores
  add column if not exists pause_note text;

create table if not exists public.store_promotions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  title text not null,
  description text,
  promo_type text not null check (promo_type in ('percent_off', 'bogo', 'flat_off', 'category_sale')),
  value_aed numeric(10,2),
  value_percent numeric(5,2),
  category_slug text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_promotions_store_idx on public.store_promotions (store_id, is_active, starts_at);

create trigger store_promotions_updated_at before update on public.store_promotions
for each row execute function public.set_updated_at();

alter table public.store_promotions enable row level security;

drop policy if exists "store_promotions_public_read" on public.store_promotions;
drop policy if exists "store_promotions_owner_write" on public.store_promotions;

create policy "store_promotions_public_read"
  on public.store_promotions for select
  using (
    exists (
      select 1
      from public.stores s
      where s.id = store_promotions.store_id
        and (s.is_active = true or public.is_store_member(s.id))
    )
  );

create policy "store_promotions_owner_write"
  on public.store_promotions for all
  using (public.is_store_member(store_id))
  with check (public.is_store_member(store_id));

