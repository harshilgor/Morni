create table if not exists public.checkout_requests (
  id uuid primary key default gen_random_uuid(),
  shopper_id uuid not null references public.profiles(id) on delete cascade,
  idempotency_key text not null,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (shopper_id, idempotency_key)
);

create index if not exists checkout_requests_created_idx on public.checkout_requests(created_at);
alter table public.checkout_requests enable row level security;
revoke all on public.checkout_requests from anon, authenticated;
