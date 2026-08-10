-- Private shopper preference signals used to improve the For you experience.
create table if not exists public.taste_sessions (
  id uuid primary key default gen_random_uuid(),
  shopper_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.taste_swipes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.taste_sessions (id) on delete cascade,
  shopper_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  category_slug text not null,
  decision text not null check (decision in ('liked', 'passed')),
  tags text[] not null default '{}',
  price_aed numeric(10, 2),
  created_at timestamptz not null default now(),
  unique (session_id, product_id)
);

create table if not exists public.product_feedback (
  id uuid primary key default gen_random_uuid(),
  shopper_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  feedback_type text not null check (feedback_type in ('not_interested')),
  created_at timestamptz not null default now(),
  unique (shopper_id, product_id, feedback_type)
);

create index if not exists taste_sessions_shopper_started_idx
  on public.taste_sessions (shopper_id, started_at desc);
create index if not exists taste_swipes_shopper_created_idx
  on public.taste_swipes (shopper_id, created_at desc);
create index if not exists product_feedback_shopper_idx
  on public.product_feedback (shopper_id, product_id);

alter table public.taste_sessions enable row level security;
alter table public.taste_swipes enable row level security;
alter table public.product_feedback enable row level security;

grant select, insert, update, delete on public.taste_sessions to authenticated;
grant select, insert, update, delete on public.taste_swipes to authenticated;
grant select, insert, update, delete on public.product_feedback to authenticated;

create policy "taste_sessions_own"
  on public.taste_sessions for all
  using (auth.uid() = shopper_id)
  with check (auth.uid() = shopper_id);

create policy "taste_swipes_own"
  on public.taste_swipes for all
  using (auth.uid() = shopper_id)
  with check (
    auth.uid() = shopper_id
    and exists (
      select 1
      from public.taste_sessions
      where taste_sessions.id = session_id
        and taste_sessions.shopper_id = auth.uid()
    )
  );

create policy "product_feedback_own"
  on public.product_feedback for all
  using (auth.uid() = shopper_id)
  with check (auth.uid() = shopper_id);
