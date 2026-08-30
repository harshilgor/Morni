create table if not exists public.bulk_imports (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'needs_review' check (status in ('uploading','analyzing','needs_review','publishing','completed','completed_with_errors','failed')),
  total_items integer not null default 0 check (total_items >= 0),
  successful_items integer not null default 0 check (successful_items >= 0),
  failed_items integer not null default 0 check (failed_items >= 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.bulk_import_items (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.bulk_imports(id) on delete cascade,
  title text not null,
  description text,
  category_slug text not null,
  price_aed numeric(10,2) not null,
  stock integer not null default 0,
  sizes text[] not null default '{}',
  image_urls text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','published','failed')),
  product_id uuid references public.products(id) on delete set null,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists bulk_imports_store_created_idx on public.bulk_imports(store_id, created_at desc);
create index if not exists bulk_import_items_import_status_idx on public.bulk_import_items(import_id, status);
alter table public.bulk_imports enable row level security;
alter table public.bulk_import_items enable row level security;
create policy "bulk_import_owner_read" on public.bulk_imports for select using (public.is_store_member(store_id));
create policy "bulk_import_item_owner_read" on public.bulk_import_items for select using (exists (select 1 from public.bulk_imports i where i.id = import_id and public.is_store_member(i.store_id)));
