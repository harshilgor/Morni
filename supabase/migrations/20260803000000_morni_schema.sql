-- Morni marketplace schema
create extension if not exists "pgcrypto";

create type public.user_role as enum ('shopper', 'store_owner', 'admin');
create type public.order_status as enum (
  'placed',
  'accepted',
  'picking',
  'out_for_delivery',
  'delivered',
  'cancelled'
);
create type public.payment_method as enum ('cod', 'card', 'apple_pay', 'tabby', 'tamara');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type public.uae_emirate as enum (
  'dubai',
  'abu_dhabi',
  'sharjah',
  'ajman',
  'uaq',
  'rak',
  'fujairah'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  role public.user_role not null default 'shopper',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  emirate public.uae_emirate not null default 'dubai',
  area text not null,
  address text not null,
  lat double precision,
  lng double precision,
  logo_url text,
  cover_url text,
  is_active boolean not null default true,
  delivery_eta_minutes integer not null default 60,
  opens_at time,
  closes_at time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.store_members (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (store_id, user_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores (id) on delete cascade,
  name text not null,
  slug text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (store_id, slug)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  title text not null,
  description text,
  price_aed numeric(10, 2) not null check (price_aed >= 0),
  compare_at_price_aed numeric(10, 2),
  image_urls text[] not null default '{}',
  stock integer not null default 0 check (stock >= 0),
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null default 'Home',
  emirate public.uae_emirate not null,
  area text not null,
  street text not null,
  building text,
  apartment text,
  notes text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null default '' unique,
  shopper_id uuid not null references public.profiles (id) on delete restrict,
  store_id uuid not null references public.stores (id) on delete restrict,
  status public.order_status not null default 'placed',
  payment_method public.payment_method not null default 'cod',
  payment_status public.payment_status not null default 'pending',
  subtotal_aed numeric(10, 2) not null,
  delivery_fee_aed numeric(10, 2) not null default 0,
  total_aed numeric(10, 2) not null,
  delivery_emirate public.uae_emirate not null,
  delivery_area text not null,
  delivery_street text not null,
  delivery_building text,
  delivery_apartment text,
  delivery_notes text,
  delivery_eta_minutes integer not null default 60,
  placed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  title text not null,
  unit_price_aed numeric(10, 2) not null,
  quantity integer not null check (quantity > 0),
  line_total_aed numeric(10, 2) not null
);

create index stores_active_emirate_idx on public.stores (is_active, emirate);
create index products_store_available_idx on public.products (store_id, is_available);
create index orders_shopper_idx on public.orders (shopper_id, placed_at desc);
create index orders_store_idx on public.orders (store_id, placed_at desc);
create index store_members_user_idx on public.store_members (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger stores_updated_at before update on public.stores
for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products
for each row execute function public.set_updated_at();
create trigger orders_updated_at before update on public.orders
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.phone,
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'shopper')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.generate_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := 'MRN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  end if;
  return new;
end;
$$;

create trigger orders_number before insert on public.orders
for each row execute function public.generate_order_number();

create or replace function public.is_store_member(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.store_members sm
    where sm.store_id = p_store_id and sm.user_id = auth.uid()
  ) or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- profiles
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_select_store_peers" on public.profiles for select using (
  exists (
    select 1 from public.store_members sm
    where sm.user_id = profiles.id
      and public.is_store_member(sm.store_id)
  )
);

-- stores
create policy "stores_public_read" on public.stores for select using (is_active = true or public.is_store_member(id));
create policy "stores_owner_update" on public.stores for update using (public.is_store_member(id));
create policy "stores_admin_insert" on public.stores for insert with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'store_owner'))
);

-- store_members
create policy "store_members_read" on public.store_members for select using (
  user_id = auth.uid() or public.is_store_member(store_id)
);
create policy "store_members_admin_write" on public.store_members for insert with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  or user_id = auth.uid()
);

-- categories
create policy "categories_public_read" on public.categories for select using (
  store_id is null
  or exists (select 1 from public.stores s where s.id = categories.store_id and (s.is_active or public.is_store_member(s.id)))
);
create policy "categories_owner_write" on public.categories for all using (
  store_id is not null and public.is_store_member(store_id)
) with check (
  store_id is not null and public.is_store_member(store_id)
);

-- products
create policy "products_public_read" on public.products for select using (
  (is_available = true and exists (select 1 from public.stores s where s.id = products.store_id and s.is_active))
  or public.is_store_member(store_id)
);
create policy "products_owner_insert" on public.products for insert with check (public.is_store_member(store_id));
create policy "products_owner_update" on public.products for update using (public.is_store_member(store_id));
create policy "products_owner_delete" on public.products for delete using (public.is_store_member(store_id));

-- addresses
create policy "addresses_own" on public.addresses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- orders
create policy "orders_shopper_read" on public.orders for select using (
  shopper_id = auth.uid() or public.is_store_member(store_id)
);
create policy "orders_shopper_insert" on public.orders for insert with check (shopper_id = auth.uid());
create policy "orders_owner_update" on public.orders for update using (
  public.is_store_member(store_id) or shopper_id = auth.uid()
);

-- order_items
create policy "order_items_read" on public.order_items for select using (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and (o.shopper_id = auth.uid() or public.is_store_member(o.store_id))
  )
);
create policy "order_items_insert" on public.order_items for insert with check (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and o.shopper_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true),
       ('store-logos', 'store-logos', true)
on conflict (id) do nothing;

create policy "product_images_public_read" on storage.objects for select using (bucket_id = 'product-images');
create policy "store_logos_public_read" on storage.objects for select using (bucket_id = 'store-logos');
create policy "product_images_owner_upload" on storage.objects for insert with check (
  bucket_id = 'product-images' and auth.role() = 'authenticated'
);
create policy "store_logos_owner_upload" on storage.objects for insert with check (
  bucket_id = 'store-logos' and auth.role() = 'authenticated'
);
create policy "product_images_owner_update" on storage.objects for update using (
  bucket_id = 'product-images' and auth.role() = 'authenticated'
);
create policy "store_logos_owner_update" on storage.objects for update using (
  bucket_id = 'store-logos' and auth.role() = 'authenticated'
);
